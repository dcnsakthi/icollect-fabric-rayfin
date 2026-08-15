# Issues to raise with the Rayfin team

Findings from building iCollect, a Fabric-hosted React app that reads and writes Warehouse
and SQL database tables and keeps its own audit trail in the Rayfin-managed database.

Each entry carries a problem statement, the evidence behind it, and a proposed solution.
Entries are split by where they belong, because several of the sharpest limitations are
Fabric platform behaviour rather than anything Rayfin controls. Filing those against Rayfin
would waste everyone's time.

The last section records what turned out to be working correctly, so nobody re-investigates
ground already covered.

---

## Contents

- [Environment](#environment)
- [Summary](#summary)
- [Rayfin issues](#rayfin-issues)
- [Fabric platform issues](#fabric-platform-issues)
- [Why GraphQL is the only write path](#why-graphql-is-the-only-write-path)
- [Checked and found working](#checked-and-found-working)

---

## Environment

| Component | Version |
|---|---|
| `@microsoft/rayfin-cli` | ^1.34.0 |
| `@microsoft/rayfin-core` | ^1.34.0 |
| `@microsoft/rayfin-data` | ^1.34.0 |
| `@microsoft/rayfin-client` | ^1.34.0 |
| `@microsoft/rayfin-auth-provider-fabric` | ^1.34.0 |
| Template | `blankapp` |
| Front end | React 19, Vite 7, TypeScript 5.8 |
| Data plane | Fabric API for GraphQL, Warehouse and SQL database sources |

---

## Summary

| ID | Title | File against | Severity |
|---|---|---|---|
| R1 | Entity authorization is operation-level only, with no row scoping | Rayfin | High |
| R2 | No server-side connector to Fabric data sources | Rayfin | High |
| R3 | `rayfin up` silently skips schema changes | Rayfin | Medium |
| R4 | Query filter API is undiscoverable from the public surface | Rayfin | Medium |
| R5 | No batch or transactional writes | Rayfin | Medium |
| R6 | Destructive migrations are all-or-nothing behind `--force` | Rayfin | Medium |
| R7 | Redeploy removes prior asset bundles, breaking open sessions | Rayfin | Low, needs repro |
| R8 | Narrow Node engine range surfaces as a raw `EBADENGINE` | Rayfin | Low |
| R9 | CLI exits 1 with no explanation when run outside the project root | Rayfin | Low |
| F1 | Lakehouse tables cannot be written through GraphQL | Fabric | High |
| F2 | Warehouse key constraints are `NOT ENFORCED` | Fabric | High |
| F3 | Warehouse has no `DEFAULT` constraints | Fabric | Medium |
| F4 | `ALTER TABLE ADD` accepts nullable columns only | Fabric | Low |
| F5 | Keyless tables get no update or delete mutation | Fabric | Medium |
| F6 | GraphQL introspection does not reveal the backing data source | Fabric | Low |

---

## Rayfin issues

### R1. Entity authorization is operation-level only, with no row scoping

**Problem statement.** The only authorization primitive we could find is
`@authenticated([...])`, which grants or denies an operation for every authenticated user.
There appears to be no way to express "a user may read only the rows they created" or "only
these principals may insert into this entity". Any per-user visibility therefore has to be
implemented in the browser, where it is a display convention rather than a control.

**Evidence.** In `rayfin/data/auditEntry.ts` the audit log is declared
`@authenticated(['create', 'read'])`. That correctly makes the trail append-only, which is
the property that makes it worth having. But `read` is granted to every authenticated user,
so the Audit page's "show only my actions" behaviour is a query the client chooses to send,
not a boundary. Anyone can query the whole trail through the data plane.

The same gap bites harder in `rayfin/data/appAdmin.ts`, which stores who may reach the Admin
page. It needs `create`, `read`, and `delete` for administrators to manage the list, which
means every authenticated user can insert themselves as an administrator through the data
plane and bypass the UI entirely. We shipped it anyway, documented as delegation among
trusted colleagues rather than a privilege boundary, because there was no alternative.

**Impact.** Any app with per-user or per-role data visibility cannot enforce it in Rayfin.
For a governance-facing app this is the single largest gap: the audit trail is tamper-proof
against modification but not against disclosure, and the admin list is advisory.

**Proposed solution.** A row-level policy attached to the entity and evaluated server side,
for example:

```ts
@entity()
@authenticated(['create', 'read'])
@rowPolicy({ read: (user, row) => row.actionedBy === user.email })
export class AuditEntry { /* ... */ }
```

If a full policy engine is too large a step, two smaller primitives would cover most of the
need: an owner-column declaration that automatically scopes reads and writes, and a
principal allowlist that can be evaluated against the caller's token claims.

---

### R2. No server-side connector to Fabric data sources

**Problem statement.** A Rayfin app has a managed backend, but that backend is only reachable
for the app's own entities. Business data living in a Fabric Warehouse, SQL database, or
Lakehouse can only be reached from the browser, which restricts every app to whatever the
Fabric API for GraphQL exposes. See
[Why GraphQL is the only write path](#why-graphql-is-the-only-write-path) for the full
reasoning.

**Evidence.** iCollect calls the GraphQL endpoint directly from the SPA with the user's
delegated token, in `src/services/fabricGraphql.ts`. Everything the GraphQL layer cannot do,
the app cannot do: no transactions, no server-enforced uniqueness, no set-based updates, no
Lakehouse writes, and no access to tables the GraphQL item has not been configured to expose.

**Impact.** Rayfin markets itself as the way to build data apps on Fabric, but the data those
apps most want to write is only reachable through a surface Rayfin does not own or wrap. Each
app re-implements token acquisition, schema introspection, and query construction against
that surface. iCollect has roughly 600 lines doing exactly this.

**Proposed solution.** A first-class Fabric data source binding, declared alongside the
existing entity definitions, that runs in the app backend and connects over TDS using the
signed-in user's identity through on-behalf-of flow. That single change would remove the
browser's protocol limitation, restore transactions and server-enforced constraints, and let
Rayfin present one data API for both app-owned and Fabric-owned data.

A smaller intermediate step: ship a supported client for the Fabric API for GraphQL, with
introspection, typed queries, and mutation building, so every app stops writing its own.

---

### R3. `rayfin up` silently skips schema changes

**Problem statement.** `rayfin up` deploys code but does not apply entity schema changes.
Those require the separate `rayfin up db apply`. Nothing warns you when the entity
definitions have drifted from the deployed schema, so a deploy appears to succeed while the
new entity does not exist, and the failure only shows up at runtime as a query error.

**Evidence.** Adding the `AppAdmin` entity required `npx rayfin up db apply --yes` before
`npx rayfin up --yes`. Running only the latter produced a clean success with an app that
could not read the new entity.

**Impact.** A silent, deferred failure. In CI this ships a broken build with a green light.

**Proposed solution.** Compare the local entity definitions against the deployed schema during
`rayfin up` and either apply automatically, prompt, or fail with a clear instruction. At
minimum, print a warning naming the drifted entities. A `rayfin up --with-db` convenience flag
would also remove the ordering trap.

---

### R4. Query filter API is undiscoverable from the public surface

**Problem statement.** The query builder supports server-side filtering through `.where()`
with a rich operator set, but nothing in the template, the generated code, or the exported
types leads you to it. We found it only by reading compiled declaration files inside
`node_modules`.

**Evidence.** The filter surface lives in
`node_modules/@microsoft/rayfin-data/dist/graphql/types.d.ts` and supports `eq`, `neq`, `gt`,
`gte`, `lt`, `lte`, `contains`, `notContains`, `startsWith`, `endsWith`, `isNull`, `in`, plus
`and` and `or` composition. The scaffolded code only ever demonstrates
`.select().orderBy().first().execute()`.

**Impact.** Before finding `.where()`, iCollect downloaded 500 audit rows and filtered them in
the browser. Because an update writes one audit row per changed column, that ceiling was
reached far sooner than the row count suggested, and the page silently showed an incomplete
history. Any developer following the template will write the same bug.

**Proposed solution.** Document `.where()` with the operator table, show one filtered query in
the template, and export `FilterInput` and the field filter types from the package entry point
so they are reachable through editor completion.

---

### R5. No batch or transactional writes

**Problem statement.** `GraphQLEntityClient` exposes `create`, `update`, and `delete` for a
single row. There is no batch insert and no transaction scope, so a multi-row operation is a
loop of independent writes with no rollback.

**Evidence.** The CSV bulk upload in `src/pages/DataPage.tsx` loops `create()` per row. If row
four fails, rows one through three are already committed and there is no way to undo them.
The same shape appears in `auditService.write()`, which writes one row per changed column.

**Impact.** Partial writes on any failure, and a round trip per row. For a bulk import,
correctness and performance both suffer.

**Proposed solution.** Add `createMany` and `deleteMany`, and a transaction scope such as
`client.transaction(async (tx) => { ... })` that commits or rolls back as a unit.

---

### R6. Destructive migrations are all-or-nothing behind `--force`

**Problem statement.** Renaming an entity field is refused as data loss, and the only escape
is `--force`, which accepts losing the column's data. The CLI clearly recognises the operation
as a rename, so it should be able to preserve the data.

**Evidence.** The refusal reads:

```text
Performing Rename column 'x' to 'y' ... would result in data loss
but force mode is not enabled.
```

**Impact.** Renaming a field on an entity holding production data is effectively impossible.
The workaround is to add the new field, migrate values with application code, and leave the
old field behind forever.

**Proposed solution.** Support a rename directive in the entity definition, for example
`@renamedFrom('oldName')`, so the migration engine can emit a rename rather than a
drop-and-add. Failing that, distinguish "renames that can preserve data" from genuine data
loss and gate them behind separate flags, so `--force` does not have to mean "I accept losing
data" in cases where nothing needs to be lost.

---

### R7. Redeploy removes prior asset bundles, breaking open sessions

**Problem statement.** Each deploy emits new content-hashed bundles and the previous ones stop
being served. A browser tab that was open before the deploy will request a chunk that no
longer exists and fail, with no built-in recovery.

**Evidence.** Cache headers are correct, so this is not a caching bug. See
[Checked and found working](#checked-and-found-working). The failure mode is asset lifetime,
not cache policy. We did not manage to reproduce the blank page during this round of work, so
this needs a clean repro before filing.

**Impact.** In an app deployed during working hours, users with an open tab hit a broken lazy
load until they reload.

**Proposed solution.** Retain the previous deployment's assets for a grace period. Separately,
document a client-side chunk-load-error handler that triggers a reload, since that pattern is
needed regardless.

---

### R8. Narrow Node engine range surfaces as a raw `EBADENGINE`

**Problem statement.** The CLI declares support for Node 20, 22, and 24. A newer major emits
npm's generic `EBADENGINE` warning, which does not say what to do.

**Proposed solution.** Detect the unsupported major at CLI startup and print the supported
range with a suggested action, instead of relying on the package manager's warning.

---

### R9. CLI exits 1 with no explanation when run outside the project root

**Problem statement.** Running any `rayfin` command from a folder above the project exits with
code 1. It cost real time before the pattern became obvious.

**Evidence.** `npx rayfin up db apply --yes` in the parent folder exits 1; the same command in
the project root succeeds. Capture the exact stderr when filing, since it was not recorded
here.

**Proposed solution.** Search upward for `rayfin/rayfin.yml`, and either run against the
project found or fail with a message naming the current directory and what was expected.

---

## Fabric platform issues

These are not Rayfin defects. They constrain what any Fabric-hosted app can do and are worth
raising through Fabric product feedback rather than the Rayfin repository. Each is confirmed
against current Microsoft Learn documentation.

### F1. Lakehouse tables cannot be written through GraphQL

A Lakehouse is exposed to the API for GraphQL through its SQL analytics endpoint, and that
endpoint "operates in read-only mode over Delta tables, you can't insert, update, or delete
data through it. To modify data, switch to the lakehouse and use Apache Spark."
([Learn](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-sql-analytics-endpoint))

Consequence: interactive data entry against a Lakehouse is impossible from a browser app.
Only a Warehouse or SQL database can be written. iCollect documents Lakehouse as read-only for
this reason.

### F2. Warehouse key constraints are `NOT ENFORCED`

`PRIMARY KEY` and `UNIQUE` are supported only with `NONCLUSTERED` and `NOT ENFORCED`, and
`FOREIGN KEY` only with `NOT ENFORCED`.
([Learn](https://learn.microsoft.com/en-us/fabric/data-warehouse/table-constraints))

Consequence: the database will not reject a duplicate. iCollect checks for duplicates in the
application before inserting, which catches an operator's mistake but cannot see a concurrent
insert from another session. Any uniqueness guarantee in a Fabric Warehouse app is advisory.

### F3. Warehouse has no `DEFAULT` constraints

"SQL analytics endpoint and Warehouse don't support default constraints at this time."
([Learn](https://learn.microsoft.com/en-us/fabric/data-warehouse/table-constraints))

Consequence: every column value, including created and modified timestamps, has to be written
explicitly by the client. There is no server-side fallback if a client omits one.

### F4. `ALTER TABLE ADD` accepts nullable columns only

Only a subset of `ALTER TABLE` is supported: adding nullable columns, dropping columns, and
adding or dropping `NOT ENFORCED` constraints.
([Learn](https://learn.microsoft.com/en-us/fabric/data-warehouse/tsql-surface-area))

Consequence: schema evolution on the source tables is a multi-step backfill rather than a
single statement.

### F5. Keyless tables get no update or delete mutation

Fabric generates GraphQL mutations from the source schema. A table with no primary key gets no
way to address a single row, so no update or delete mutation is generated.

Consequence: such a table is insert-and-read only, and no amount of application configuration
can change that. This is arguably correct behaviour, but it is worth documenting prominently,
because the resulting app-level symptom ("this table is read-only") gives no hint that the
cause is a missing key at the source. iCollect surfaces the explanation in its Admin page and
troubleshooting guide because users could not otherwise work it out.

### F6. GraphQL introspection does not reveal the backing data source

The generated schema exposes entity names and fields but not which Warehouse, SQL database, or
Lakehouse each entity resolves to. iCollect reads the GraphQL API item's own definition
through the Fabric REST API to recover that mapping, purely so it can tell the user which data
store they are editing.

Proposed: expose the source binding as schema metadata, for example a directive on each type.

---

## Why GraphQL is the only write path

This question came up repeatedly, so it is worth setting out precisely. The constraint is a
stack of three separate limits, and only the last one is a Fabric decision.

### The browser cannot speak the database protocol

Warehouse, SQL database in Fabric, and the SQL analytics endpoint all expose TDS over TCP
1433. TDS is a binary protocol over a raw TCP socket. A browser has no raw TCP sockets: script
in a page can open HTTP requests and WebSockets, and nothing else. No amount of Fabric
configuration changes this, and it applies equally to every cloud database.

Fabric's own documentation frames direct connections as an alternative to GraphQL, describing
them as applications connecting "directly to lakehouses or warehouses using SQL drivers (ODBC,
JDBC)".
([Learn](https://learn.microsoft.com/en-us/fabric/data-engineering/api-graphql-overview))
Those drivers are native libraries. They run in a server process, not in a page.

So the real statement is not "Fabric will not let a browser write SQL". It is "a browser
cannot open a database connection to anything, so a server-side component is mandatory".

### iCollect has no server-side component of its own

A Rayfin app is a static SPA plus a managed backend that serves the app's own entities. There
is no place in that model to put a TDS connection: no custom server route, no function, no
supported way to run application code with a database driver next to the data. That is issue
[R2](#r2-no-server-side-connector-to-fabric-data-sources), and it is the one gap that, if
closed, dissolves most of this section.

Without it, the app is limited to the HTTP surfaces Fabric publishes:

| Surface | Reachable from a browser | Row-level writes |
|---|---|---|
| API for GraphQL | Yes | Yes, on Warehouse and SQL database |
| OneLake DFS REST API | Yes | No, file-level only |
| Livy and Spark job REST APIs | Yes | Batch and asynchronous, not interactive |
| Fabric REST APIs | Yes | No, control plane only |
| TDS on port 1433 | No | Not applicable |

The API for GraphQL is the only entry in that table that both a browser can call and that
performs a single-row insert, update, or delete. That is the whole answer.

### What that costs

Routing every write through GraphQL inherits its limits, and they are not small:

- No transactions. Each mutation is independent, so a multi-row operation cannot be atomic.
- No set-based operations. There is no "update every row where status is pending". Each row is
  a separate round trip.
- Mutations exist only where the source schema permits them, so a keyless table is insert-only
  ([F5](#f5-keyless-tables-get-no-update-or-delete-mutation)).
- Lakehouse tables cannot be written at all
  ([F1](#f1-lakehouse-tables-cannot-be-written-through-graphql)).
- Constraint enforcement stays advisory, because the underlying Warehouse constraints are
  `NOT ENFORCED` ([F2](#f2-warehouse-key-constraints-are-not-enforced)).
- Only the tables an administrator has added to the GraphQL item are reachable, which is a
  reasonable governance boundary but also an extra configuration step per table.

### What we would ask for

In priority order:

1. A server-side Fabric data source binding in Rayfin, connecting over TDS with the caller's
   delegated identity. This removes the browser protocol limit and restores transactions,
   set-based writes, and server-enforced constraints in one move.
2. Failing that, transaction and batch support in the API for GraphQL, so at least multi-row
   operations become atomic.
3. A supported Rayfin client for the API for GraphQL, so apps stop hand-rolling introspection
   and mutation building.

---

## Checked and found working

Recorded so these are not investigated again or filed in error.

### Static hosting cache headers are correct

Measured against the live deployment:

| Resource | `Cache-Control` |
|---|---|
| `/` (index.html) | `no-cache` |
| `/assets/main-*.js` | `public, max-age=31536000, immutable` |
| `/assets/main-*.css` | `public, max-age=31536000, immutable` |

All carry ETags. This is exactly the right policy for content-hashed assets, so any
stale-bundle symptom is about asset retention on redeploy, not caching. See
[R7](#r7-redeploy-removes-prior-asset-bundles-breaking-open-sessions).

### `showPicker()` and hidden inputs

While debugging a date picker that would not open, we suspected Chromium refuses
`showPicker()` on a visually hidden (`sr-only`) input, and separately that a deferred blur
handler was unmounting the editor before the click landed. An isolated browser probe disproved
both: `showPicker()` returned normally on a 1x1 clipped input, and with a realistic 120 ms
click the focus check correctly saw the button and kept the editor alive. Neither is a bug in
Rayfin, Chromium, or the app. The editor was rebuilt on native `date` and `datetime-local`
inputs for other reasons.

### Query pagination exists

`executePaginated()` and `after(cursor)` are available on the query builder. They are subject
to the same discoverability problem as `.where()`
([R4](#r4-query-filter-api-is-undiscoverable-from-the-public-surface)) but the capability is
there.

### `db apply` handles additive changes cleanly

Adding the `AppAdmin` entity applied without warnings or `--force`. The friction is the
separate command ([R3](#r3-rayfin-up-silently-skips-schema-changes)), not the migration engine.
