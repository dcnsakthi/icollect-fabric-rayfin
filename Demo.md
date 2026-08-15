# iCollect demo guide

A scene-by-scene script for demonstrating iCollect end to end. Each scene pairs the words
to say with the exact clicks that should be happening while you say them.

Quoted blocks are the voice-over. Everything outside them is direction: what to click,
what to point at, and what to do when the demo does not cooperate.

---

## Contents

- [At a glance](#at-a-glance)
- [Before you start](#before-you-start)
- [The script](#the-script)
  - [Scene 1: Why this exists](#scene-1-why-this-exists)
  - [Scene 2: Signing in as yourself](#scene-2-signing-in-as-yourself)
  - [Scene 3: The Home page](#scene-3-the-home-page)
  - [Scene 4: Finding the rows that matter](#scene-4-finding-the-rows-that-matter)
  - [Scene 5: Correcting a value](#scene-5-correcting-a-value)
  - [Scene 6: Adding rows, one at a time and in bulk](#scene-6-adding-rows-one-at-a-time-and-in-bulk)
  - [Scene 7: Handing data to someone else](#scene-7-handing-data-to-someone-else)
  - [Scene 8: The audit trail](#scene-8-the-audit-trail)
  - [Scene 9: Who decides what is editable](#scene-9-who-decides-what-is-editable)
  - [Scene 10: Closing](#scene-10-closing)
- [Short version](#short-version)
- [Questions you will get](#questions-you-will-get)
- [If something breaks](#if-something-breaks)
- [Resetting between runs](#resetting-between-runs)
- [Three-minute video voice-over](#three-minute-video-voice-over)

---

## At a glance

| | |
|---|---|
| Full run | 12 to 14 minutes, plus questions |
| Short run | 5 minutes (see [Short version](#short-version)) |
| Audience | Data platform owners, analytics leads, governance and compliance stakeholders |
| Prerequisites | A Fabric workspace with a Warehouse, a GraphQL API item bound to it, and an Entra SPA registration (see the README) |
| Tone | Show the guardrails as prominently as the features. The audit trail is the product, not a footnote |

The demo has one argument running through it: Fabric already holds the data and already
holds the permissions, so a data entry experience should add neither a second copy nor a
second permission model. Every scene should reinforce that.

---

## Before you start

Work through this list. Half of these are the difference between a smooth demo and a
scramble.

### Data

- Pick one table with a primary key, at least 50 rows, and a mix of column types. A date
  column and a numeric column make Scene 5 land, because the typed editors only show up
  when the schema has them.
- Know one row you will edit and what you will change it to. Rehearse the exact value.
- Have a second table that is intentionally read-only for Scene 9. A table with no primary
  key is ideal, since the platform, not the configuration, is what blocks it.

### Configuration

- On the Admin page, enable the demo table and switch on insert, update, and delete.
- Leave the second table disabled or read-only.
- Confirm `VITE_ADMIN_EMAILS` includes your demo account, or leave it empty so every user
  qualifies. Scene 8 needs the **Show others** toggle to be visible.

### Files

- Download the CSV template from the demo table ahead of time, fill in two or three rows,
  and save it somewhere you can find in a file picker under pressure. Do not author this
  live.

### Environment

- Sign in once before the audience joins so the consent prompt is already dealt with. A
  first-time consent screen inside a popup is the most common way this demo stalls.
- Hard refresh with `Ctrl+Shift+R`. Bundles are content-hashed, and a cached `index.html`
  pointing at a bundle that no longer exists renders a blank page.
- Set browser zoom to about 110 percent. The grid is dense.
- Close unrelated tabs. The header and every audit row carry your email address.
- Decide in advance whether you are comfortable showing your own account on screen. If not,
  use a dedicated demo identity, because there is no way to hide it in the UI.

### Warm the audit trail

Make a handful of edits, one export, and a delete the day before. Scene 3 and Scene 8 are
flat against an empty log, and the whole point of the seven-day default is that it should
have something in it.

---

## The script

### Scene 1: Why this exists

**Duration** about 60 seconds. **On screen** a title slide, or the Fabric portal with your
workspace open. Do not open iCollect yet.

> Hello everyone, and welcome to iCollect. This is Sakthivel Nachimuthu (Sakthi) from ISD EAG Architect, Singapore.
>
> Most of you already know Fabric as a unified data platform for AI transformation. It
> brings the full spectrum of data professional tooling into one governed, open platform
> on a single capacity model, and everything that lands there is immediately available to
> your analytics and AI tools.
>
> Where it gets interesting is what happens when that data needs to change. Today, if you
> need to update something sitting in a Warehouse, a SQL database, or a Lakehouse, you
> reach for a pipeline, a dataflow, a Spark job, or a SQL script. Those are all batch. They
> assume the correction arrives as a file, on a schedule, from a process.
>
> But a lot of corrections do not arrive that way. They arrive as a person who knows the
> data is wrong. And right now that person has no way to fix it in place. So they export to
> Excel, they fix it there, and they hand it back to someone who can run a load. The
> correction lives outside the platform for as long as that round trip takes, and nobody
> can tell you afterwards who changed what.
>
> That gap is where iCollect fits. It is a governed, editable grid over tables that already
> live in Fabric, so the person closest to the data can correct it directly, and every one
> of those corrections is recorded.

If you are showing the Fabric portal, hover over the Warehouse and the GraphQL API item as
you name them. The audience should leave this scene knowing iCollect reads through the API
for GraphQL and holds no copy of the business data.

### Scene 2: Signing in as yourself

**Duration** about 45 seconds. **On screen** the iCollect sign-in page, then Home.

Navigate to the app. Land on the sign-in screen and pause there before clicking.

> Notice what this screen is not asking for. There is no iCollect account, no password, no
> invitation. It signs you in with your Entra identity and then calls Fabric as you, using
> your delegated token.
>
> That has a consequence worth stating plainly: iCollect grants no access of its own. If
> you cannot see a workspace in Fabric, you will not see it here. If you can only read a
> table in Fabric, you can only read it here. There is no second permission model to keep
> in step, and no service account quietly holding more rights than the person at the
> keyboard.

Click **Sign in**. If you pre-authenticated, this completes without a prompt.

> And that is the whole sign-in.

### Scene 3: The Home page

**Duration** about 60 seconds. **On screen** `/`.

> This is the landing page. Four quick actions, and underneath them the three rules the app
> holds itself to.

Point at each principle panel in turn as you read it.

> Nothing is edited by accident: edit mode is off by default, and a table is only writable
> once an admin has enabled that specific operation. Every change is attributable. And your
> Fabric permissions still apply.

Scroll to **Your recent changes**.

> This is my own activity from the last thirty days, pulled straight out of the audit trail
> and colour coded by action type. Green for inserts, blue for updates, red for deletes,
> purple for exports. The same colours follow you onto the audit screen.
>
> One detail worth calling out. The trail records one entry per column, so a single edit
> across twelve columns writes twelve rows. This view groups those back into one line, so
> what you read here is one row changed, not twelve. The audit page will show you the raw
> entries when you want that level of detail.

If your recent activity list is empty, say so and move on rather than apologising for it.
It fills as you work through the demo, and you will come back to it at the close.

### Scene 4: Finding the rows that matter

**Duration** about 90 seconds. **On screen** `/data`.

Click **Browse and edit data**.

> Two pickers: workspace, then GraphQL source.

Select your workspace, then your source. Let the tabs appear.

> These are the tables an administrator has turned on for this source. Not everything the
> source exposes, only what has been deliberately enabled. That is the first narrowing.

Open your demo table.

> Here is the grid. Every column header carries its data type underneath, which matters
> more than it sounds like it should, because it tells you before you start typing whether
> a column expects a date, a number, or free text.

Click the information button at the left of the toolbar.

> And this is the table profile: the workspace, the source, the backing data store, and the
> full column list. When you are three tables into an investigation, this is how you confirm
> you are looking at what you think you are looking at.

Close the dialog. Type into the global search box.

> Search runs across every column at once.

Now use a per-column filter, then click a column header to sort.

> Per-column filters narrow it further, and any header sorts. Down at the bottom, the count
> tells you how many rows survived the filters out of how many were loaded.

Point at the row count.

> That number matters for the next two things I am going to do, so keep it in mind.

### Scene 5: Correcting a value

**Duration** about 2 minutes. This is the centre of the demo. Slow down.

Attempt to double-click a cell while Edit mode is still off.

> Nothing happens, and that is deliberate. The grid is read-only until I say otherwise.

Turn on **Edit mode**. The pill turns indigo.

> Now it is live, and the toolbar has grown: New row and Bulk Upload have appeared, because
> this table allows inserts.

Double-click a text cell. Type a correction. Press `Tab` or click away.

> The cell is staged in amber. Nothing has been written yet.

Now double-click a date column.

> Here is where the column types pay off. A date column gives me a picker rather than
> asking me to guess the format.

Open the picker, choose a date, close it. Then double-click a numeric column.

> And a numeric column gives me a spinner and rejects anything that is not a number.

Save the changes.

> Watch two things: the banner at the top, and the cells themselves.

Let the save complete.

> The banner confirms what was written and to which table. And the cells that saved
> successfully flash green. If any of them had been rejected, those specific cells would
> have flashed red, so you would know exactly which value the source refused rather than
> being told the save failed and left to work it out.

Navigate to `/audit`.

> And the correction is already here. Not a summary of it: the table, the row, the column,
> the value before, the value after, who did it, and when. One entry per column I touched.

Point at the `oldValue` and `newValue` columns specifically. This is the moment governance
stakeholders are waiting for, so do not rush past it.

Navigate back to `/data`.

### Scene 6: Adding rows, one at a time and in bulk

**Duration** about 90 seconds.

Click **New row**.

> A form built from the live schema, with the same typed editors as the grid.

Fill in the required fields and save.

> Before that insert goes anywhere, iCollect checks the key columns against what is already
> loaded and refuses an obvious duplicate.

Pause here and be straight about the limitation. Skipping it costs you credibility with
anyone who knows the platform.

> I want to be precise about that check, because it is a convenience and not a guarantee.
> Warehouse primary keys in Fabric are declarative, marked NOT ENFORCED, so the database
> will not stop a duplicate for you. iCollect checks in the application, which means it
> cannot see a row another user is inserting at the same moment. It catches the mistake you
> are about to make. It is not a constraint.

Now click **Template**.

> For anything larger than a handful of rows, Template downloads a CSV with the exact
> columns this table expects, generated from the live schema rather than from documentation
> that drifted.

Click **Bulk Upload** and select your prepared file.

> And the upload writes those rows through the same path as a manual insert, which means
> every one of them is audited individually.

> One honest note: the rows go in one at a time and there is no transaction around them. If
> row four fails, rows one through three are already committed. For a correction workflow
> that is usually what you want. For anything that has to be all or nothing, use a pipeline.

### Scene 7: Handing data to someone else

**Duration** about 45 seconds.

Apply a filter that visibly reduces the row count.

> Say a downstream team asks for just these rows.

Open **Export** and choose **Download CSV**.

> The export contains exactly what is on screen. The filters, the sort, the search: all of
> it is honoured. What you see is what leaves.

Let the banner confirm, then navigate to `/audit`.

> And taking data out is itself an auditable event. The trail records the format and the row
> count, so if someone asks later who pulled an extract of this table and how much of it
> they took, the answer is here.

### Scene 8: The audit trail

**Duration** about 2 minutes. **On screen** `/audit`.

> This is the full activity log, and it opens somewhere specific: my own actions, over the
> last seven days.

Point at the time filter, which reads **Last 7 days**.

> That default exists because the most common question is what did I just do, not what has
> everyone done since the beginning of time.

Open the time filter and show the presets.

> Twenty-four hours through to a year, and a custom range when you need a specific window.

Choose **Custom date range**, set a start and end date, click **Apply**.

> This filter runs in the query, not in the browser, so widening it fetches more rather than
> filtering down what was already downloaded.

Now point at the **Show others** toggle.

> And this is the scope control. It is off, so I am looking at myself. It only appears for
> administrators.

Switch it on. The list widens to include other actors.

> Now I can see everyone.

Be honest about what this control is.

> To be clear about what that toggle does and does not do: it changes what the query asks
> for. The audit table itself is readable by any signed-in user, so this is a view scoped
> for convenience, not a security boundary. If you need per-user visibility enforced, that
> belongs on the server.

Walk the action types.

> Six action types, each with its own colour. Inserts, updates, deletes and exports you have
> seen. There is also view, which fires once when a table is first loaded in a session, and
> login, which records the pages someone opened.

Point at the columns.

> And the columns are the interesting part: the table, the row key, the column name, the old
> value, and the new value. For a whole-table action like an export there is no single row
> or column, so those read as an asterisk.

Now the sentence that carries the compliance argument.

> Two properties make this trail worth having. First, it is insert-and-read only. The
> database grants create and read on this table and nothing else, so the people being
> audited cannot rewrite or erase their own history, and neither can I. Second, it lives
> outside the Warehouse, in the application's own store, so somebody with write access to
> the business data still cannot touch the record of what they did to it.

Then the boundary, stated before anyone has to ask.

> And the limit: this records what happened through iCollect. If someone changes the same
> table directly in SQL or through a pipeline, that will not appear here. This is a record
> of this application's activity, not a change data capture feed for the Warehouse.

### Scene 9: Who decides what is editable

**Duration** about 90 seconds. **On screen** `/admin`.

> Everything I have shown so far was allowed because of this screen.

Point at the table list.

> One row per table. The key columns iCollect detected, and switches for enabled, insert,
> update, and delete.

Find your read-only table, where the switches are disabled.

> Look at this one. The switches are greyed out, and no administrator can turn them on. That
> table has no primary key, so the GraphQL source exposes no update or delete mutation for
> it. The operation is not restricted; it does not exist. Configuration cannot conjure it
> into being.

Return to your demo table and turn off **Enabled**.

> Now watch what that does.

Navigate to `/data` and reload the page.

> The table is gone. Not read-only: absent. Enabled is the master switch, and visibility on
> this page is opt-in, so a table nobody has turned on does not appear at all.

Turn it back on, reload, and confirm it returns.

> The rule these switches follow is the one to remember. They can only narrow what Fabric
> and the source already permit. They can never widen it. So the worst an administrator can
> do here is lock something down.

Click a table name to open the profile dialog.

> And clicking through gives you the same profile you saw on the Data page: the backing
> source and the full column list.

### Scene 10: Closing

**Duration** about 60 seconds. **On screen** `/`, back on Home, with your recent changes now
populated by the demo.

> So, back where we started, and this list has filled up with everything I just did.
>
> Three gates decided all of it, and each one can only narrow the last. Fabric permissions
> decide what you can see at all. The source schema decides what is technically possible,
> which is why a table with no key can never be edited. And the admin switches decide what
> this app is willing to write.
>
> What that adds up to is this. The corrections happened in Fabric, against the same tables
> your reports and your copilots are reading, so the fix is visible immediately rather than
> after the next load. Nothing was copied into a spreadsheet and nothing was copied back.
> And every change carries the column, the previous value, the new value, the person, and
> the timestamp, in a log that the people being audited cannot edit.
>
> No new permission model. No CRUD application to build. Point it at a GraphQL source, set
> the switches, and the data entry experience exists.
>
> Happy to take questions.

---

## Short version

For a five-minute slot, run Scenes 1, 5, 8, and 10. That is the argument, the proof, the
governance, and the close. Prepare by opening the demo table with Edit mode already on so
you do not spend time on the pickers.

If you have seven minutes, add Scene 9. The point that configuration can only narrow, never
widen, is the one that most often decides whether a governance stakeholder is comfortable.

---

## Questions you will get

**Is this not just another CRUD application?**

The difference is what it does not carry. There is no user store, no role table, no access
list, and no copy of the business data. It reads and writes through the Fabric API for
GraphQL using the signed-in user's token, so Fabric enforces access on every call. What
would normally be months of building and then maintaining an access model becomes
configuration.

**Where does the data actually live?**

Business data never leaves its Warehouse, SQL database, or Lakehouse. The application's own
store holds three things only: the audit trail, the per-table configuration, and lookup
values. That separation is deliberate, because it is what stops an audited user from
rewriting their own history.

**Can it work against a Lakehouse?**

You can read from one. Writes need a Warehouse, because Lakehouse SQL endpoints are
read-only. That is a platform characteristic, not an application limitation.

**What happens when two people edit the same row?**

Last write wins. There is no optimistic concurrency check today. Warehouse keys are NOT
ENFORCED, so the duplicate check runs in the application and cannot see a concurrent insert
from another session. For high-contention tables, that is worth knowing before you roll it
out.

**Can someone bypass the UI and read the whole audit trail?**

Yes. The audit table grants read to every authenticated user, so the scoping on the Audit
page is a view, not a boundary. What nobody can do, through the UI or otherwise, is modify
or delete an entry: the table grants only create and read.

**Does it capture changes made outside the app?**

No. It records what iCollect did. A pipeline, a Spark job, or a direct SQL statement against
the same table will not appear. Pair it with platform-level change tracking if you need
complete coverage.

**How do we control who can edit what?**

Three layers, applied in order, each only able to narrow the previous one: Fabric
permissions, then what the GraphQL source actually exposes, then the per-table admin
switches. A table with no primary key cannot be made editable by any amount of
configuration.

**What does it cost to run?**

It is a static single-page application hosted in Fabric plus a small managed database for
the audit trail and configuration. There is no compute tier to size and no server to keep
running.

---

## If something breaks

| Symptom | What to do, live |
|---|---|
| Sign-in popup hangs or looks blank | It is almost certainly a consent prompt trapped in the popup. Close it, sign in in a separate tab, come back. Prevent it by authenticating before the demo. |
| Blank page, tab title still showing | Cached `index.html` requesting a bundle that no longer exists. `Ctrl+Shift+R`. |
| Audit page shows nothing | Check the time filter first; the default is seven days. Then check whether Show others needs to be on. Talk through it rather than hiding it, because both controls are features. |
| No table tabs on the Data page | Nothing is enabled for that source. Open Admin, enable a table, come back and reload. |
| A cell flashes red on save | Read the banner aloud and keep going. A visible, specific failure is a better demo than a silent one; that is the point of the red flash. |
| "Does not expose an update operation" | The table has no primary key. Use it: this is exactly the Scene 9 point about the source, not the configuration, being the constraint. |

The general rule: when something fails, explain it rather than clicking around it. Most of
these failures are the guardrails working, and narrating them is more persuasive than a
demo where nothing ever goes wrong.

---

## Resetting between runs

- Undo the edits from Scene 5 so the same cells are available next time. Rehearse from the
  same starting values.
- Delete the rows added in Scene 6, both the manual one and the bulk upload.
- Re-enable any table you switched off in Scene 9.
- Leave the audit trail alone. It cannot be cleaned up anyway, and a trail with history in
  it demonstrates better than an empty one.
- Remember that your resets are themselves audited. If you delete the demo rows an hour
  before presenting, those deletes will be sitting at the top of the seven-day view. Either
  reset the day before, or use them: a delete is one of the six action types you need to
  show.

---

## Three-minute video voice-over

Hello everyone, and welcome to iCollect.

Most of you already know Fabric as a unified data platform for AI transformation. It brings
the full spectrum of data professional tooling into one governed, open platform on a single
capacity model, and everything that lands there is immediately available to your analytics
and AI tools.

Where it gets interesting is what happens when that data needs to change. Today, to update
something sitting in a Warehouse, a SQL database, or a Lakehouse, you reach for a pipeline,
a dataflow, a Spark job, or a SQL script. Those are all batch. They assume the correction
arrives as a file, on a schedule, from a process.

But many corrections do not arrive that way. They arrive as a person who knows the data is
wrong. That person exports to Excel, fixes it there, and hands it back to someone who can
run a load. The correction sits outside the platform for as long as that round trip takes,
and afterwards nobody can tell you who changed what.

That gap is where iCollect fits: a governed, editable grid over tables that already live in
Fabric.

Start with what the sign-in does not ask for. There is no iCollect account and no password.
It signs you in with your Entra identity and then calls Fabric as you. If you cannot see a
workspace in Fabric, you will not see it here.

Pick a workspace and a source, and the tables an administrator has enabled appear. Search
runs across every column at once. Filters narrow it further.

The grid stays read-only until I turn on edit mode. Now I can correct a cell. A date column
gives me a picker rather than asking me to guess the format, and a numeric column gives me
a spinner. I save, and the cells that succeeded flash green. Any cell the source rejected
would flash red, so I would know exactly which value failed rather than being told the save
did not work.

For more than a handful of rows, I download a template generated from the live schema, fill
it in, and upload. And when a downstream team asks for an extract, the export contains
exactly what is on screen: the filters, the sort, all of it.

Every one of those actions is already in the audit trail. Not a summary of them: the table,
the row, the column, the value before, the value after, who did it, and when. Taking data
out is recorded too, with the format and the row count.

Two things make that trail worth having. It is insert-and-read only, so the people being
audited cannot rewrite or erase their own history. And it lives outside the Warehouse, so
someone with write access to the business data still cannot touch the record of what they
did to it.

None of this happened by accident. Fabric permissions decide what you can see at all. The
source schema decides what is technically possible, which is why a table with no key can
never be edited. And the administrator switches decide what this app is willing to write.
Each gate can only narrow the one before it.

So the corrections landed in Fabric, against the same tables your reports and your copilots
are already reading. Nothing was copied into a spreadsheet and nothing was copied back. And
every change carries a name and a timestamp.

That is iCollect.
