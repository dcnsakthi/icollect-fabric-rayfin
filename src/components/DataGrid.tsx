import { useEffect, useMemo, useState } from 'react';

import { ValueEditor } from '@/components/ValueEditor';
import type { FabricTable, Row } from '@/services/fabricGraphql';

type SortDirection = 'asc' | 'desc';

/** A row plus only the columns whose values were staged for change. */
export interface RowEdit {
  row: Row;
  changes: Row;
}

/** Outcome of the last save, so the grid can mark the cells it touched. */
export interface SaveFlash {
  saved: RowEdit[];
  failed: RowEdit[];
}

interface DataGridProps {
  table: FabricTable;
  rows: Row[];
  editMode: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  lookups: Record<string, string[]>;
  onSaveEdits: (edits: RowEdit[]) => void;
  onDeleteRows: (rows: Row[]) => void;
  onAddLookup: (column: string, value: string) => void;
  /** Lets the page export exactly what the grid is showing. Must be stable. */
  onVisibleRowsChange?: (rows: Row[]) => void;
  /** Rendered at the left of the toolbar, before the grid's own actions. */
  toolbarStart?: React.ReactNode;
  /** Rendered at the right of the toolbar, after the grid's own actions. */
  toolbarEnd?: React.ReactNode;
  /** Cells to mark green or red after a save. Cleared by the page.  */
  flash?: SaveFlash | null;
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function DataGrid({
  table,
  rows,
  editMode,
  canUpdate,
  canDelete,
  lookups,
  onSaveEdits,
  onDeleteRows,
  onAddLookup,
  onVisibleRowsChange,
  toolbarStart,
  toolbarEnd,
  flash = null,
}: Readonly<DataGridProps>) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ column: string; direction: SortDirection } | null>(
    null
  );
  const [editing, setEditing] = useState<{ key: string; column: string } | null>(
    null
  );
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, Row>>({});

  // Memoised so `visible` keeps a stable identity; otherwise the effect below
  // would fire on every render and loop through the parent's state update.
  const columns = useMemo(
    () => table.columns.map((c) => c.name),
    [table.columns]
  );

  const scalarOf = useMemo(() => {
    const byName = new Map(table.columns.map((c) => [c.name, c.scalar]));
    return (column: string): string => byName.get(column) ?? 'String';
  }, [table.columns]);

  const keyFields = table.keyFields;

  // Identity has to survive sorting and filtering, so it comes from the row's
  // own values rather than its position.
  const keyOf = useMemo(() => {
    return (row: Row): string =>
      keyFields.length
        ? keyFields.map((field) => textOf(row[field])).join('\u241f')
        : JSON.stringify(row);
  }, [keyFields]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const matched = rows.filter((row) => {
      const searchable =
        !needle ||
        columns.some((column) => textOf(row[column]).toLowerCase().includes(needle));
      if (!searchable) return false;

      return Object.entries(filters).every(([column, value]) => {
        if (!value.trim()) return true;
        return textOf(row[column]).toLowerCase().includes(value.trim().toLowerCase());
      });
    });

    if (!sort) return matched;

    return [...matched].sort((a, b) => {
      const left = textOf(a[sort.column]);
      const right = textOf(b[sort.column]);
      const numeric = Number(left) - Number(right);
      const result =
        left !== '' && right !== '' && !Number.isNaN(numeric)
          ? numeric
          : left.localeCompare(right);
      return sort.direction === 'asc' ? result : -result;
    });
  }, [rows, columns, search, filters, sort]);

  useEffect(() => {
    onVisibleRowsChange?.(visible);
  }, [visible, onVisibleRowsChange]);

  const selectedRows = rows.filter((row) => selected.has(keyOf(row)));
  const visibleSelectedCount = visible.filter((row) =>
    selected.has(keyOf(row))
  ).length;
  const allVisibleSelected =
    visible.length > 0 && visibleSelectedCount === visible.length;
  const changedKeys = Object.keys(edits);
  const showSelection = editMode && canDelete;

  // Keyed off the row's own values, so it still matches after a reload.
  const flashed = useMemo(() => {
    const map = new Map<string, { columns: Set<string>; failed: boolean }>();
    const add = (list: RowEdit[], failed: boolean): void => {
      for (const { row, changes } of list) {
        map.set(keyOf(row), { columns: new Set(Object.keys(changes)), failed });
      }
    };
    add(flash?.saved ?? [], false);
    add(flash?.failed ?? [], true);
    return map;
  }, [flash, keyOf]);

  function toggleAllVisible(): void {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((row) => next.delete(keyOf(row)));
      else visible.forEach((row) => next.add(keyOf(row)));
      return next;
    });
  }

  function toggleRow(key: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSort(column: string): void {
    setSort((current) =>
      current?.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    );
  }

  function valueOf(row: Row, column: string): unknown {
    const staged = edits[keyOf(row)];
    return staged && column in staged ? staged[column] : row[column];
  }

  function beginEdit(row: Row, column: string): void {
    if (!editMode || !canUpdate) return;
    setEditing({ key: keyOf(row), column });
    setDraft(textOf(valueOf(row, column)));
  }

  /** Edits are staged, not written, so a whole screen of corrections saves as one action. */
  function stageEdit(row: Row, column: string): void {
    setEditing(null);

    const key = keyOf(row);
    const original = textOf(row[column]);

    setEdits((current) => {
      const staged: Row = { ...current[key] };
      if (draft === original) delete staged[column];
      else staged[column] = draft;

      const next = { ...current };
      if (Object.keys(staged).length) next[key] = staged;
      else delete next[key];
      return next;
    });
  }

  function saveEdits(): void {
    const pending: RowEdit[] = [];
    for (const row of rows) {
      const changes = edits[keyOf(row)];
      if (changes) pending.push({ row, changes });
    }
    setEdits({});
    setEditing(null);
    onSaveEdits(pending);
  }

  function deleteSelected(): void {
    const targets = selectedRows;
    setSelected(new Set());
    onDeleteRows(targets);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all columns…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {toolbarStart}

          {showSelection && selectedRows.length ? (
            <button
              type="button"
              onClick={deleteSelected}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Delete ({selectedRows.length})
            </button>
          ) : null}

          {editMode && canUpdate && changedKeys.length ? (
            <>
              <button
                type="button"
                onClick={saveEdits}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
              >
                Save ({changedKeys.length})
              </button>
              <button
                type="button"
                onClick={() => setEdits({})}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Discard
              </button>
            </>
          ) : null}

          {toolbarEnd}
        </div>
      </div>

      <div className="min-h-64 flex-1 overflow-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {showSelection ? (
                <th className="w-10 px-3 py-2 border-b border-gray-200">
                  <input
                    type="checkbox"
                    aria-label="Select all matching rows"
                    checked={allVisibleSelected}
                    ref={(node) => {
                      if (node) {
                        node.indeterminate =
                          !allVisibleSelected && visibleSelectedCount > 0;
                      }
                    }}
                    onChange={toggleAllVisible}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleSort(column)}
                    className="block font-medium whitespace-nowrap text-gray-700 hover:text-gray-900"
                  >
                    {column}
                    {table.keyFields.includes(column) ? ' 🔑' : ''}
                    {sort?.column === column
                      ? sort.direction === 'asc'
                        ? ' ▲'
                        : ' ▼'
                      : ''}
                  </button>
                  <span className="block text-[10px] font-normal tracking-wide text-gray-400 uppercase">
                    {scalarOf(column)}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {showSelection ? (
                <th className="border-b border-gray-200" />
              ) : null}
              {columns.map((column) => (
                <th key={column} className="px-2 pb-2 border-b border-gray-200">
                  <input
                    value={filters[column] ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        [column]: event.target.value,
                      }))
                    }
                    placeholder="Filter"
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs font-normal"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const rowKey = keyOf(row);
              const staged = edits[rowKey];

              return (
                <tr key={rowKey} className="odd:bg-white even:bg-gray-50">
                  {showSelection ? (
                    <td className="px-3 py-1.5 border-b border-gray-100">
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected.has(rowKey)}
                        onChange={() => toggleRow(rowKey)}
                      />
                    </td>
                  ) : null}

                  {columns.map((column) => {
                    const isEditing =
                      editing?.key === rowKey && editing.column === column;
                    const isChanged = Boolean(staged && column in staged);
                    const options = lookups[column];
                    const mark = flashed.get(rowKey);
                    const flashedCell = mark?.columns.has(column) ? mark : null;

                    let cellStyle = '';
                    if (isEditing) {
                      cellStyle = 'bg-indigo-50 ring-2 ring-inset ring-indigo-400';
                    } else if (isChanged) {
                      cellStyle = 'bg-amber-50 ring-1 ring-inset ring-amber-300';
                    } else if (flashedCell?.failed) {
                      cellStyle = 'bg-red-50 ring-1 ring-inset ring-red-200';
                    } else if (flashedCell) {
                      cellStyle = 'bg-emerald-50 ring-1 ring-inset ring-emerald-200';
                    }

                    return (
                      <td
                        key={column}
                        onDoubleClick={() => beginEdit(row, column)}
                        className={`px-3 py-1.5 border-b border-gray-100 whitespace-nowrap ${cellStyle}`}
                      >
                        {isEditing ? (
                          options ? (
                            <select
                              autoFocus
                              value={draft}
                              onChange={(event) => {
                                const next = event.target.value;
                                if (next === '__add__') {
                                  const created = window.prompt(
                                    `New value for ${column}`
                                  );
                                  if (created) {
                                    onAddLookup(column, created);
                                    setDraft(created);
                                  }
                                  return;
                                }
                                setDraft(next);
                              }}
                              onBlur={() => stageEdit(row, column)}
                              className="rounded border border-indigo-400 px-2 py-1 text-sm"
                            >
                              <option value="">(empty)</option>
                              {options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                              <option value="__add__">+ Add new value…</option>
                            </select>
                          ) : (
                            <ValueEditor
                              autoFocus
                              scalar={scalarOf(column)}
                              value={draft}
                              onChange={setDraft}
                              onCommit={() => stageEdit(row, column)}
                              onCancel={() => setEditing(null)}
                            />
                          )
                        ) : (
                          <span
                            className={
                              editMode && canUpdate ? 'cursor-text' : undefined
                            }
                          >
                            {textOf(valueOf(row, column))}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        {visible.length} of {rows.length} rows
        {selectedRows.length ? ` · ${selectedRows.length} selected` : ''}
        {changedKeys.length ? ` · ${changedKeys.length} unsaved` : ''}
        {editMode && canUpdate ? ' · double-click a cell to edit' : ''}
      </p>
    </div>
  );
}
