import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataGrid, type RowEdit, type SaveFlash } from '@/components/DataGrid';
import { ExportMenu } from '@/components/ExportMenu';
import { StatusBanner } from '@/components/StatusBanner';
import { TableProfileDialog } from '@/components/TableProfileDialog';
import { ValueEditor } from '@/components/ValueEditor';
import { useAuth } from '@/hooks/AuthContext';
import { useStatus } from '@/hooks/useStatus';
import {
  recordDelete,
  recordExport,
  recordInsert,
  recordUpdate,
  recordView,
  type AuditContext,
} from '@/services/auditService';
import {
  downloadCsv,
  downloadJson,
  download,
  parseCsv,
  templateCsv,
} from '@/services/exportService';
import { isFabricDataPlaneConfigured } from '@/services/fabricAuth';
import {
  deriveGraphqlEndpoint,
  listGraphqlApis,
  listWorkspaces,
  loadTableBindings,
  sourceKey,
  type FabricItem,
  type FabricWorkspace,
  type TableBinding,
} from '@/services/fabricDiscovery';
import {
  createRow,
  deleteRow,
  fetchRows,
  introspect,
  updateRow,
  type FabricTable,
  type Row,
} from '@/services/fabricGraphql';
import {
  isTableEnabled,
  listTableConfigs,
  permissionsFor,
  type TableConfigRecord,
} from '@/services/tableConfigService';

const PAGE_SIZE = 200;

function countLabel(count: number): string {
  return `${count} row${count === 1 ? '' : 's'}`;
}

function emptyMessage(total: number, enabled: number, opened: number): string {
  if (!total && !opened) {
    return 'Choose a workspace and a GraphQL source to browse its tables.';
  }
  if (!enabled) {
    return 'No tables are enabled for this source. Turn one on from the Admin page.';
  }
  return 'Select a table.';
}

export function DataPage() {
  const { user } = useAuth();
  const loginHint = user?.email;

  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [apis, setApis] = useState<FabricItem[]>([]);
  const [apiId, setApiId] = useState('');
  const [tables, setTables] = useState<FabricTable[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [rowsByTable, setRowsByTable] = useState<Record<string, Row[]>>({});
  const [visibleRows, setVisibleRows] = useState<Row[]>([]);
  const [configs, setConfigs] = useState<TableConfigRecord[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [newRow, setNewRow] = useState<Row | null>(null);
  const [bindings, setBindings] = useState<Map<string, TableBinding>>(new Map());
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [flash, setFlash] = useState<SaveFlash | null>(null);
  const { busy, error, notice, setError, run } = useStatus();

  const handleVisibleRows = useCallback((next: Row[]) => setVisibleRows(next), []);

  const api = apis.find((a) => a.id === apiId);
  const workspaceName =
    workspaces.find((w) => w.id === workspaceId)?.displayName ?? '';
  const endpoint = useMemo(
    () => (workspaceId && apiId ? deriveGraphqlEndpoint(workspaceId, apiId) : ''),
    [workspaceId, apiId]
  );
  const key = workspaceId && apiId ? sourceKey(workspaceId, apiId) : '';

  // Admin's Enabled switch decides what the page offers, not just what it allows.
  const visibleTables = useMemo(
    () => tables.filter((t) => isTableEnabled(configs, key, t.entityName)),
    [tables, configs, key]
  );
  const table = visibleTables.find((t) => t.entityName === activeTab);
  const rows = table ? (rowsByTable[table.entityName] ?? []) : [];

  // Admin config narrows what the source allows; it can never widen it.
  const configured = table
    ? permissionsFor(configs, key, table.entityName)
    : { canInsert: false, canUpdate: false, canDelete: false };
  const permissions = {
    canInsert: configured.canInsert && Boolean(table?.createMutation),
    canUpdate: configured.canUpdate && Boolean(table?.updateMutation),
    canDelete: configured.canDelete && Boolean(table?.deleteMutation),
  };

  useEffect(() => {
    if (!notice && !error) setFlash(null);
  }, [notice, error]);

  useEffect(() => {
    if (!isFabricDataPlaneConfigured()) {
      setError(
        'Fabric data plane is not configured. Set VITE_FABRIC_GRAPHQL_CLIENT_ID in .env and restart the dev server.'
      );
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
    setOpenTabs([]);
    setActiveTab('');
    setVisibleRows([]);
    if (!id) return;
    void run(async () => setApis(await listGraphqlApis(id, loginHint)));
  }

  function selectApi(id: string): void {
    setApiId(id);
    setTables([]);
    setOpenTabs([]);
    setActiveTab('');
    setVisibleRows([]);
    setBindings(new Map());
    setBindingError(null);
    if (!id) return;
    void run(async () => {
      const found = await introspect(
        deriveGraphqlEndpoint(workspaceId, id),
        loginHint
      );
      setTables(found);
      // Best effort: losing the binding degrades the profile dialog, nothing else.
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

  function openTable(entityName: string): void {
    setActiveTab(entityName);
    setNewRow(null);
    setOpenTabs((current) =>
      current.includes(entityName) ? current : [...current, entityName]
    );
    const target = visibleTables.find((t) => t.entityName === entityName);
    if (!target || rowsByTable[entityName]) return;
    void run(async () => {
      const loaded = await fetchRows(endpoint, target, PAGE_SIZE, loginHint);
      setRowsByTable((current) => ({ ...current, [entityName]: loaded }));
      // Logged once per table per session, since this only runs on first load.
      await recordView(auditContext(target), loaded.length);
    });
  }

  function reload(target: FabricTable): Promise<void> {
    return fetchRows(endpoint, target, PAGE_SIZE, loginHint).then((loaded) =>
      setRowsByTable((current) => ({ ...current, [target.entityName]: loaded }))
    );
  }

  function auditContext(target: FabricTable): AuditContext {
    return {
      sourceKey: key,
      schemaName: api?.displayName ?? '',
      tableName: target.entityName,
      keyFields: target.keyFields,
      actionedBy: user?.email ?? 'unknown',
    };
  }

  /** Exports leave the app with data, so they are logged like any other action. */
  function exportRows(format: 'CSV' | 'JSON' | 'CSV template'): void {
    if (!table) return;
    if (format === 'CSV') downloadCsv(table.entityName, columns, visibleRows);
    if (format === 'JSON') downloadJson(table.entityName, visibleRows);
    if (format === 'CSV template') {
      download(
        `${table.entityName}-template.csv`,
        templateCsv(columns),
        'text/csv;charset=utf-8'
      );
    }
    void recordExport(
      auditContext(table),
      format,
      format === 'CSV template' ? 0 : visibleRows.length
    ).catch(() => undefined);
  }

  /** One mutation per row, one audit entry per column, so the trail stays column-level. */
  function saveEdits(pending: RowEdit[]): void {
    if (!table || !pending.length) return;
    void run(async () => {
      const saved: RowEdit[] = [];
      try {
        for (const edit of pending) {
          await updateRow(endpoint, table, edit.row, edit.changes, loginHint);
          await recordUpdate(auditContext(table), edit.row, edit.changes);
          saved.push(edit);
        }
      } finally {
        // A row part-way through may have committed, so the grid has to re-read
        // the server before it can mark anything green or red.
        await reload(table);
        setFlash({
          saved,
          failed: pending.filter((edit) => !saved.includes(edit)),
        });
      }
      return `Updated ${countLabel(pending.length)} in ${table.entityName}.`;
    });
  }

  function removeRows(targets: Row[]): void {
    if (!table || !targets.length) return;
    const prompt =
      targets.length === 1
        ? 'Delete this row? This cannot be undone.'
        : `Delete ${targets.length} rows? This cannot be undone.`;
    if (!window.confirm(prompt)) return;

    void run(async () => {
      for (const row of targets) {
        await deleteRow(endpoint, table, row, loginHint);
        await recordDelete(auditContext(table), row);
      }
      await reload(table);
      return `Deleted ${countLabel(targets.length)} from ${table.entityName}.`;
    });
  }

  function saveNewRow(): void {
    if (!table || !newRow) return;
    const duplicate = table.keyFields.length
      ? rows.some((existing) =>
          table.keyFields.every(
            (field) => String(existing[field] ?? '') === String(newRow[field] ?? '')
          )
        )
      : false;

    if (duplicate) {
      setError(
        `A row with the same ${table.keyFields.join(' + ')} already exists. Warehouse keys are NOT ENFORCED, so this check runs in the app and cannot see concurrent inserts.`
      );
      return;
    }

    void run(async () => {
      await createRow(endpoint, table, newRow, loginHint);
      await recordInsert(auditContext(table), newRow);
      setNewRow(null);
      await reload(table);
      return `Added ${countLabel(1)} to ${table.entityName}.`;
    });
  }

  function uploadCsv(file: File): void {
    if (!table) return;
    void run(async () => {
      const parsed = parseCsv(await file.text());
      for (const row of parsed) {
        await createRow(endpoint, table, row, loginHint);
        await recordInsert(auditContext(table), row);
      }
      await reload(table);
      return `Imported ${countLabel(parsed.length)} into ${table.entityName}.`;
    });
  }

  const columns = table?.columns.map((c) => c.name) ?? [];

  function newRowScalar(column: string): string {
    return table?.columns.find((c) => c.name === column)?.scalar ?? 'String';
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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

        {table ? (
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              editMode
                ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={editMode}
              onChange={(event) => setEditMode(event.target.checked)}
            />
            Edit mode
          </label>
        ) : null}
      </div>

      <StatusBanner busy={busy} error={error} notice={notice} />

      {visibleTables.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleTables.map((candidate) => (
            <button
              key={candidate.entityName}
              type="button"
              onClick={() => openTable(candidate.entityName)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                activeTab === candidate.entityName
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {candidate.entityName}
            </button>
          ))}
        </div>
      ) : null}

      {table ? (
        <>
          {editMode && !permissions.canInsert && !permissions.canUpdate ? (
            <p className="text-sm text-amber-700">
              This table is read-only. Enable it on the Admin page to allow edits.
            </p>
          ) : null}

          {newRow ? (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {columns.map((column) => (
                  <label key={column} className="text-xs text-gray-700">
                    <span className="block mb-1">{column}</span>
                    <ValueEditor
                      scalar={newRowScalar(column)}
                      value={String(newRow[column] ?? '')}
                      onChange={(next) =>
                        setNewRow((current) => ({
                          ...current,
                          [column]: next,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveNewRow}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                >
                  Save row
                </button>
                <button
                  type="button"
                  onClick={() => setNewRow(null)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <DataGrid
            table={table}
            rows={rows}
            editMode={editMode}
            canUpdate={permissions.canUpdate}
            canDelete={permissions.canDelete}
            lookups={{}}
            onSaveEdits={saveEdits}
            onDeleteRows={removeRows}
            onAddLookup={() => undefined}
            onVisibleRowsChange={handleVisibleRows}
            flash={flash}
            toolbarStart={
              <>
                <button
                  type="button"
                  onClick={() => setShowProfile(true)}
                  title={`About ${table.entityName}`}
                  aria-label={`About ${table.entityName}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100 hover:text-teal-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                </button>

                {editMode && permissions.canInsert ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setNewRow(Object.fromEntries(columns.map((c) => [c, ''])))
                      }
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                    >
                      New row
                    </button>
                    <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                      <span>Bulk Upload</span>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadCsv(file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </>
                ) : null}
              </>
            }
            toolbarEnd={
              <>
                <button
                  type="button"
                  onClick={() => exportRows('CSV template')}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Template
                </button>
                <ExportMenu onExport={exportRows} />
              </>
            }
          />
        </>
      ) : (
        <p className="text-sm text-gray-500">
          {emptyMessage(tables.length, visibleTables.length, openTabs.length)}
        </p>
      )}

      {showProfile && table ? (
        <TableProfileDialog
          table={table}
          workspaceName={workspaceName}
          sourceName={api?.displayName ?? ''}
          binding={bindings.get(table.entityName)}
          bindingError={bindingError}
          onClose={() => setShowProfile(false)}
        />
      ) : null}
    </div>
  );
}
