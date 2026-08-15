import { useEffect, useState } from 'react';

import { AdminUsers } from '@/components/AdminUsers';
import { InfoTip } from '@/components/InfoTip';
import { StatusBanner } from '@/components/StatusBanner';
import { TableProfileDialog } from '@/components/TableProfileDialog';
import { useAuth } from '@/hooks/AuthContext';
import { useStatus } from '@/hooks/useStatus';
import { isFabricDataPlaneConfigured } from '@/services/fabricAuth';
import {
  deriveGraphqlEndpoint,
  listGraphqlApis,
  listWorkspaceUsers,
  listWorkspaces,
  loadTableBindings,
  sourceKey,
  type FabricItem,
  type FabricUser,
  type FabricWorkspace,
  type TableBinding,
} from '@/services/fabricDiscovery';
import { introspect, type FabricTable } from '@/services/fabricGraphql';
import {
  listTableConfigs,
  upsertTableConfig,
  type TableConfigRecord,
} from '@/services/tableConfigService';

type Flag = 'isEnabled' | 'allowInsert' | 'allowUpdate' | 'allowDelete';

interface FlagSpec {
  key: Flag;
  label: string;
  info: string;
  /** Whether the source can perform this at all; false disables the switch. */
  supported?: (table: FabricTable) => boolean;
  unsupportedReason?: string;
}

const FLAGS: FlagSpec[] = [
  {
    key: 'isEnabled',
    label: 'Enabled',
    info: 'Master switch for this table. While off, the table stays readable and exportable but iCollect will not write to it, regardless of the other three switches.',
  },
  {
    key: 'allowInsert',
    label: 'Insert',
    info: 'Permits new rows. Requires the source to expose a create mutation. Duplicate-key checks run in the app, so they cannot detect a concurrent insert from another user.',
    supported: (table) => Boolean(table.createMutation),
    unsupportedReason: 'This source exposes no create mutation for the table.',
  },
  {
    key: 'allowUpdate',
    label: 'Update',
    info: 'Permits inline cell edits. Requires key columns: Fabric only generates an update mutation for a table it can address by key. Add a primary key at the source, then refresh the GraphQL API.',
    supported: (table) => Boolean(table.updateMutation),
    unsupportedReason:
      'No key columns, so Fabric generated no update mutation for this table.',
  },
  {
    key: 'allowDelete',
    label: 'Delete',
    info: 'Permits row deletion. Needs key columns for the same reason as update. Deletions are written to the audit log, but the app cannot restore the row in the source.',
    supported: (table) => Boolean(table.deleteMutation),
    unsupportedReason:
      'No key columns, so Fabric generated no delete mutation for this table.',
  },
];

function supportedOperations(table: FabricTable): string {
  return (
    [
      table.createMutation ? 'insert' : null,
      table.updateMutation ? 'update' : null,
      table.deleteMutation ? 'delete' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'read-only'
  );
}

/** Splits `dbo.asset_details` into its schema and object name. */
function splitSourceObject(sourceObject: string): {
  schema: string;
  name: string;
} {
  const cut = sourceObject.lastIndexOf('.');
  return cut === -1
    ? { schema: '', name: sourceObject }
    : { schema: sourceObject.slice(0, cut), name: sourceObject.slice(cut + 1) };
}

export function AdminPage() {
  const { user } = useAuth();
  const loginHint = user?.email;

  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [apis, setApis] = useState<FabricItem[]>([]);
  const [apiId, setApiId] = useState('');
  const [tables, setTables] = useState<FabricTable[]>([]);
  const [bindings, setBindings] = useState<Map<string, TableBinding>>(new Map());
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<TableConfigRecord[]>([]);
  const [profileTable, setProfileTable] = useState<FabricTable | null>(null);
  const [users, setUsers] = useState<FabricUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const { busy, error, notice, setError, run } = useStatus();

  const api = apis.find((a) => a.id === apiId);
  const workspaceName =
    workspaces.find((w) => w.id === workspaceId)?.displayName ?? '';
  const key = workspaceId && apiId ? sourceKey(workspaceId, apiId) : '';

  useEffect(() => {
    if (!isFabricDataPlaneConfigured()) {
      setError('Fabric data plane is not configured.');
      return;
    }
    void run(async () => {
      setWorkspaces(await listWorkspaces(loginHint));
      setConfigs(await listTableConfigs());
    });
  }, [run, setError, loginHint]);

  function selectWorkspace(id: string): void {
    setWorkspaceId(id);
    setApiId('');
    setApis([]);
    setTables([]);
    setBindings(new Map());
    setBindingError(null);
    setUsers([]);
    setUsersError(null);
    if (!id) return;
    void run(async () => {
      setApis(await listGraphqlApis(id, loginHint));
      // Best effort: listing role assignments needs Member or higher, so a
      // Contributor can still configure tables, just not name administrators.
      try {
        setUsers(await listWorkspaceUsers(id, loginHint));
      } catch {
        setUsers([]);
        setUsersError(
          'Fabric would not list this workspace users. Naming an administrator needs the Member role or higher on the workspace.'
        );
      }
    });
  }

  function selectApi(id: string): void {
    setApiId(id);
    setTables([]);
    setBindings(new Map());
    setBindingError(null);
    if (!id) return;
    void run(async () => {
      setTables(
        await introspect(deriveGraphqlEndpoint(workspaceId, id), loginHint)
      );
      // Best effort: the schema tells us the entities, only the item definition
      // tells us which warehouse or database is behind them. Losing it degrades
      // the profile dialog rather than the page.
      try {
        setBindings(await loadTableBindings(workspaceId, id, loginHint));
      } catch (error_) {
        setBindings(new Map());
        setBindingError(
          error_ instanceof Error ? error_.message : String(error_)
        );
      }
    });
  }

  function configFor(tableName: string): TableConfigRecord | undefined {
    return configs.find((c) => c.sourceKey === key && c.tableName === tableName);
  }

  function toggle(table: FabricTable, flag: Flag): void {
    const existing = configFor(table.entityName);
    const binding = bindings.get(table.entityName);
    const next = {
      sourceKey: key,
      sourceName: api?.displayName ?? '',
      schemaName: binding
        ? splitSourceObject(binding.sourceObject).schema
        : (api?.displayName ?? ''),
      tableName: table.entityName,
      isEnabled: existing?.isEnabled ?? false,
      allowInsert: existing?.allowInsert ?? false,
      allowUpdate: existing?.allowUpdate ?? false,
      allowDelete: existing?.allowDelete ?? false,
      keyColumns: JSON.stringify(table.keyFields),
      updatedBy: user?.email ?? 'unknown',
    };
    next[flag] = !next[flag];

    // Never persist a permission the source cannot perform, so a stale config
    // can't promise an edit that would fail at the endpoint.
    for (const spec of FLAGS) {
      if (spec.supported && !spec.supported(table)) next[spec.key] = false;
    }

    void run(async () => {
      await upsertTableConfig(existing, next);
      setConfigs(await listTableConfigs());
      const label = FLAGS.find((spec) => spec.key === flag)?.label ?? flag;
      return `${label} ${next[flag] ? 'enabled' : 'disabled'} for ${table.entityName}.`;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Fabric permissions decide what each user can see. These switches only
        narrow what iCollect is willing to write — they cannot grant access
        Fabric has not already granted.
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Workspace</span>
          <select
            value={workspaceId}
            onChange={(event) => selectWorkspace(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 min-w-56"
          >
            <option value="">Select a workspace…</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-gray-600 mb-1">GraphQL source</span>
          <select
            value={apiId}
            onChange={(event) => selectApi(event.target.value)}
            disabled={!apis.length}
            className="rounded-md border border-gray-300 px-3 py-1.5 min-w-56 disabled:bg-gray-100"
          >
            <option value="">Select a source…</option>
            {apis.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <StatusBanner busy={busy} error={error} notice={notice} />

      {tables.length ? (
        <div className="min-h-64 w-full flex-1 overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700">
                  Table
                  <InfoTip
                    label="About the table column"
                    text="Hover a name for its data source and key columns. Click it to open the full column profile."
                  />
                </th>
                <th className="hidden border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700 md:table-cell">
                  Key columns
                  <InfoTip
                    label="About key columns"
                    text="The row identity Fabric uses for update and delete. Derived from the delete mutation's arguments. Without one, only insert and read are possible."
                  />
                </th>
                <th className="hidden border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700 sm:table-cell">
                  Source supports
                  <InfoTip
                    label="About source support"
                    text="What the GraphQL endpoint actually exposes for this table. The switches below can only narrow this, never extend it."
                  />
                </th>
                {FLAGS.map((flag) => (
                  <th
                    key={flag.key}
                    className="border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  >
                    {flag.label}
                    <InfoTip label={`About ${flag.label}`} text={flag.info} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const config = configFor(table.entityName);
                const binding = bindings.get(table.entityName);
                const hover = [
                  `Workspace: ${workspaceName}`,
                  `GraphQL source: ${api?.displayName ?? ''}`,
                  binding
                    ? `Data source: ${binding.sourceTypeLabel} · ${binding.sourceItemName}`
                    : 'Data source: not reported by the API definition',
                  binding
                    ? `Object: ${binding.sourceObject} (${binding.sourceObjectType})`
                    : null,
                  `Key columns: ${table.keyFields.join(', ') || 'none'}`,
                  `Columns: ${table.columns.length}`,
                  `Supports: ${supportedOperations(table)}`,
                ]
                  .filter(Boolean)
                  .join('\n');

                return (
                  <tr
                    key={table.entityName}
                    className="odd:bg-white even:bg-gray-50"
                  >
                    <td className="border-b border-gray-100 px-3 py-2">
                      <button
                        type="button"
                        title={hover}
                        onClick={() => setProfileTable(table)}
                        className="text-left font-medium text-indigo-700 underline-offset-2 hover:underline"
                      >
                        {table.entityName}
                      </button>
                    </td>
                    <td className="hidden border-b border-gray-100 px-3 py-2 text-gray-500 md:table-cell">
                      {table.keyFields.join(', ') || '— none detected —'}
                    </td>
                    <td className="hidden border-b border-gray-100 px-3 py-2 text-gray-500 sm:table-cell">
                      {supportedOperations(table)}
                    </td>
                    {FLAGS.map((flag) => {
                      const supported = flag.supported
                        ? flag.supported(table)
                        : true;
                      return (
                        <td
                          key={flag.key}
                          className="border-b border-gray-100 px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            disabled={!supported}
                            title={
                              supported ? undefined : flag.unsupportedReason
                            }
                            checked={supported && (config?.[flag.key] ?? false)}
                            onChange={() => toggle(table, flag.key)}
                            className="disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Choose a workspace and source to configure its tables.
        </p>
      )}

      <AdminUsers
        users={users}
        usersError={usersError}
        workspaceSelected={Boolean(workspaceId)}
        currentUserEmail={user?.email}
        run={run}
      />

      {profileTable ? (
        <TableProfileDialog
          table={profileTable}
          workspaceName={workspaceName}
          sourceName={api?.displayName ?? ''}
          binding={bindings.get(profileTable.entityName)}
          bindingError={bindingError}
          onClose={() => setProfileTable(null)}
        />
      ) : null}
    </div>
  );
}
