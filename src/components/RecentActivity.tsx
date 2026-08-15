import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ACTION_STYLES } from '@/auditStyles';
import { listAudit, type AuditRecord } from '@/services/auditService';

const TRACKED = new Set(['insert', 'update', 'delete', 'export']);
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
/** A batch writes one entry per row, so nearby entries are one user action. */
const BATCH_WINDOW_MS = 2 * 60 * 1000;
const MAX_ENTRIES = 8;

const VERBS: Record<string, { label: string; preposition: string }> = {
  insert: { label: 'Inserted', preposition: 'into' },
  update: { label: 'Updated', preposition: 'in' },
  delete: { label: 'Deleted', preposition: 'from' },
  export: { label: 'Exported', preposition: 'from' },
};

interface Activity {
  id: string;
  action: string;
  table: string;
  rows: number;
  at: Date;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function timeAgo(at: Date, now: number): string {
  const seconds = Math.round((at.getTime() - now) / 1000);
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) return relative.format(Math.round(seconds), 'second');
  if (magnitude < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (magnitude < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}

/** Exports record their size in the value rather than as one entry per row. */
function exportedRows(entry: AuditRecord): number {
  return Number(/(\d+)\s+row/.exec(entry.newValue ?? '')?.[1] ?? 1);
}

function group(entries: AuditRecord[]): Activity[] {
  const activities: Activity[] = [];
  let current: { keys: Set<string>; rows: number } | null = null;

  for (const entry of entries) {
    const last = activities.at(-1);
    const sameAction =
      last &&
      current &&
      last.action === entry.actionType &&
      last.table === entry.tableName &&
      last.at.getTime() - entry.actionedAt.getTime() < BATCH_WINDOW_MS;

    if (sameAction && current && last) {
      if (entry.actionType === 'export') {
        current.rows += exportedRows(entry);
      } else if (!current.keys.has(entry.rowKey)) {
        current.keys.add(entry.rowKey);
        current.rows += 1;
      }
      last.rows = current.rows;
      continue;
    }

    current = {
      keys: new Set([entry.rowKey]),
      rows: entry.actionType === 'export' ? exportedRows(entry) : 1,
    };
    activities.push({
      id: entry.id,
      action: entry.actionType,
      table: entry.tableName,
      rows: current.rows,
      at: entry.actionedAt,
    });
  }

  return activities;
}

export function RecentActivity({ email }: Readonly<{ email?: string }>) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!email) return;

    listAudit({
      from: new Date(Date.now() - MONTH_MS),
      actionedBy: email,
      limit: 500,
    })
      .then((entries) =>
        setActivities(
          group(entries.filter((entry) => TRACKED.has(entry.actionType))).slice(
            0,
            MAX_ENTRIES
          )
        )
      )
      .catch(() => setFailed(true));
  }, [email]);

  if (failed) return null;

  const now = Date.now();

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
          Your recent changes
        </h2>
        <Link
          to="/audit"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          View full audit trail →
        </Link>
      </div>

      {activities.length ? (
        <ul className="mt-4 divide-y divide-gray-100">
          {activities.map((activity) => {
            const verb = VERBS[activity.action];
            return (
              <li
                key={activity.id}
                className="flex flex-wrap items-baseline gap-x-2 py-2 text-sm"
              >
                <span
                  className={`font-medium ${ACTION_STYLES[activity.action] ?? 'text-gray-700'}`}
                >
                  {verb.label}
                </span>
                <span className="text-gray-700">
                  {activity.rows} row{activity.rows === 1 ? '' : 's'}{' '}
                  {verb.preposition}{' '}
                  <span className="font-medium">{activity.table}</span>
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {timeAgo(activity.at, now)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          Nothing from you in the last 30 days. Inserts, updates, deletes, and
          exports show up here once you make them.
        </p>
      )}
    </section>
  );
}
