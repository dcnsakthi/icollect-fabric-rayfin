import { useCallback, useEffect, useMemo, useState } from 'react';

import { ExportMenu, type ExportFormat } from '@/components/ExportMenu';
import { StatusBanner } from '@/components/StatusBanner';
import {
  TimeRangeFilter,
  presetRange,
  type TimeRange,
} from '@/components/TimeRangeFilter';
import { ACTION_STYLES } from '@/auditStyles';
import { useAdmins } from '@/hooks/AdminContext';
import { useAuth } from '@/hooks/AuthContext';
import { useStatus } from '@/hooks/useStatus';
import {
  listAudit,
  recordExport,
  type AuditRecord,
} from '@/services/auditService';
import { downloadCsv, downloadJson } from '@/services/exportService';

/**
 * `listAudit` casts rows blindly, so a column's runtime type is not guaranteed —
 * a Date reaching JSX directly crashes the whole render (React error #31).
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value.toString();
  }
  return JSON.stringify(value) ?? '';
}

type SortDirection = 'asc' | 'desc';

const COLUMNS: {
  key: keyof AuditRecord;
  label: string;
  type: string;
  wide?: boolean;
}[] = [
  { key: 'actionedAt', label: 'Actioned At', type: 'DateTime' },
  { key: 'actionedBy', label: 'Actioned By', type: 'String' },
  { key: 'actionType', label: 'Action Type', type: 'String' },
  { key: 'tableName', label: 'Table Name', type: 'String' },
  { key: 'rowKey', label: 'Row Key', type: 'String', wide: true },
  { key: 'columnName', label: 'Column Name', type: 'String' },
  { key: 'oldValue', label: 'Old Value', type: 'String', wide: true },
  { key: 'newValue', label: 'New Value', type: 'String', wide: true },
];

/** The audit log is its own source, so its exports get a stable key of their own. */
const AUDIT_SOURCE_KEY = 'icollect/audit';

/** A single edit writes one row per column, so a window needs far more headroom than it looks. */
const READ_LIMIT = 1000;

function sortMarker(active: boolean, direction: SortDirection): string {
  if (!active) return '';
  return direction === 'asc' ? ' ▲' : ' ▼';
}

export function AuditPage() {
  const { user } = useAuth();
  const { isAdmin: admin } = useAdmins();
  const [entries, setEntries] = useState<AuditRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showOthers, setShowOthers] = useState(false);
  const [range, setRange] = useState<TimeRange>(() => presetRange('7d'));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{
    column: keyof AuditRecord;
    direction: SortDirection;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { busy, error, notice, run } = useStatus();

  const email = user?.email;
  const mineOnly = !admin || !showOthers;

  const reload = useCallback(
    () =>
      run(async () => {
        setEntries(
          await listAudit({
            from: range.from,
            to: range.to,
            actionedBy: mineOnly ? (email ?? 'unknown') : undefined,
            limit: READ_LIMIT,
          })
        );
        setLoaded(true);
      }),
    [run, range, mineOnly, email]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const matched = entries.filter((entry) => {
      const searchable =
        !needle ||
        COLUMNS.some((column) =>
          cellText(entry[column.key]).toLowerCase().includes(needle)
        );
      if (!searchable) return false;

      return Object.entries(filters).every(([key, value]) => {
        if (!value.trim()) return true;
        return cellText(entry[key as keyof AuditRecord])
          .toLowerCase()
          .includes(value.trim().toLowerCase());
      });
    });

    if (!sort) return matched;

    return [...matched].sort((a, b) => {
      const left = cellText(a[sort.column]);
      const right = cellText(b[sort.column]);
      const result = left.localeCompare(right);
      return sort.direction === 'asc' ? result : -result;
    });
  }, [entries, search, filters, sort]);

  function toggleSort(column: keyof AuditRecord): void {
    setSort((current) =>
      current?.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    );
  }

  function exportRows(format: ExportFormat): void {
    const keys = COLUMNS.map((column) => column.key);
    const rows = visible.map((entry) =>
      Object.fromEntries(keys.map((key) => [key, cellText(entry[key])]))
    );

    if (format === 'CSV') downloadCsv('audit', keys, rows);
    else downloadJson('audit', rows);

    void run(async () => {
      // Taking the log out is itself an auditable action.
      await recordExport(
        {
          sourceKey: AUDIT_SOURCE_KEY,
          schemaName: 'iCollect',
          tableName: 'AuditEntry',
          keyFields: ['id'],
          actionedBy: user?.email ?? 'unknown',
        },
        format,
        visible.length
      );
      return `Exported ${visible.length} row${
        visible.length === 1 ? '' : 's'
      } from AuditEntry as ${format}.`;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all columns…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        {admin ? (
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              showOthers
                ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={showOthers}
              onChange={(event) => setShowOthers(event.target.checked)}
            />
            Show others
          </label>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <TimeRangeFilter value={range} onChange={setRange} />
          <ExportMenu onExport={exportRows} />
        </div>
      </div>

      <StatusBanner
        busy={busy}
        error={error}
        notice={notice}
        busyLabel="Loading activity history…"
      />

      {loaded && !entries.length && !error ? (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
          <p className="font-medium text-gray-900">
            No activity in the selected period.
          </p>
          <p className="mt-1">
            {mineOnly
              ? 'This shows your own actions only. Widen the time filter, or ask an admin to review the full trail.'
              : 'Widen the time filter to look further back.'}{' '}
            The log fills in when a row is inserted, edited, or deleted, and when
            a table is viewed or exported through iCollect. Changes made directly
            in the Warehouse, SQL database, or any other tool are not captured
            here.
          </p>
        </div>
      ) : null}

      {entries.length ? (
        <div className="min-h-64 flex-1 overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-left border-b border-gray-200"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="block font-medium whitespace-nowrap text-gray-700 hover:text-gray-900"
                    >
                      {column.label}
                      {sortMarker(
                        sort?.column === column.key,
                        sort?.direction ?? 'asc'
                      )}
                    </button>
                    <span className="block text-[10px] font-normal tracking-wide text-gray-400 uppercase">
                      {column.type}
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-2 pb-2 border-b border-gray-200"
                  >
                    <input
                      value={filters[column.key] ?? ''}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          [column.key]: event.target.value,
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
              {visible.map((entry) => (
                <tr key={entry.id} className="odd:bg-white even:bg-gray-50">
                  {COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className={`border-b border-gray-100 px-3 py-1.5 ${
                        column.wide ? 'max-w-56 truncate' : 'whitespace-nowrap'
                      } ${
                        column.key === 'actionType'
                          ? `font-medium ${ACTION_STYLES[entry.actionType] ?? 'text-gray-700'}`
                          : ''
                      }`}
                    >
                      {cellText(entry[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {entries.length ? (
        <p className="text-xs text-gray-500">
          {visible.length} of {entries.length} rows
        </p>
      ) : null}

      {loaded && entries.length && !visible.length ? (
        <p className="text-sm text-gray-500">
          No entries match “{search}”.
        </p>
      ) : null}
    </div>
  );
}
