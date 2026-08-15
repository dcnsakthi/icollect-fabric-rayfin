import type { Row } from './fabricGraphql';
import { getRayfinClient } from './rayfinClient';

export interface AuditContext {
  sourceKey: string;
  schemaName: string;
  tableName: string;
  keyFields: string[];
  actionedBy: string;
}

export type AuditAction =
  | 'insert'
  | 'update'
  | 'delete'
  | 'export'
  | 'view'
  | 'login';

export interface AuditRecord {
  id: string;
  sourceKey: string;
  schemaName: string;
  tableName: string;
  rowKey: string;
  columnName: string;
  oldValue?: string;
  newValue?: string;
  actionType: AuditAction;
  actionedBy: string;
  actionedAt: Date;
}

/** Stands in for row and column on whole-table actions such as export and view. */
const WHOLE_TABLE = '*';

/** Page access is app-wide, not tied to any Fabric source. */
const APP_SOURCE_KEY = 'icollect/app';

const MAX_VALUE = 4000;

function asText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_VALUE ? text.slice(0, MAX_VALUE) : text;
}

function buildRowKey(row: Row, keyFields: string[]): string {
  const key = keyFields.length
    ? Object.fromEntries(keyFields.map((f) => [f, row[f] ?? null]))
    : row;
  const text = JSON.stringify(key);
  return text.length > 900 ? text.slice(0, 900) : text;
}

async function write(
  context: AuditContext,
  rowKey: string,
  actionType: AuditAction,
  cells: { column: string; oldValue?: unknown; newValue?: unknown }[]
): Promise<void> {
  const client = getRayfinClient();
  const actionedAt = new Date();

  for (const cell of cells) {
    await client.data.AuditEntry.create({
      sourceKey: context.sourceKey,
      schemaName: context.schemaName,
      tableName: context.tableName,
      rowKey,
      columnName: cell.column,
      oldValue: asText(cell.oldValue),
      newValue: asText(cell.newValue),
      actionType,
      actionedBy: context.actionedBy,
      actionedAt,
    });
  }
}

/** New rows are persisted column by column so the inserted values are recoverable. */
export function recordInsert(context: AuditContext, row: Row): Promise<void> {
  return write(
    context,
    buildRowKey(row, context.keyFields),
    'insert',
    Object.entries(row)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([column, value]) => ({ column, newValue: value }))
  );
}

export function recordUpdate(
  context: AuditContext,
  row: Row,
  changes: Row
): Promise<void> {
  return write(
    context,
    buildRowKey(row, context.keyFields),
    'update',
    Object.entries(changes).map(([column, value]) => ({
      column,
      oldValue: row[column],
      newValue: value,
    }))
  );
}

export function recordDelete(context: AuditContext, row: Row): Promise<void> {
  return write(
    context,
    buildRowKey(row, context.keyFields),
    'delete',
    Object.entries(row).map(([column, value]) => ({ column, oldValue: value }))
  );
}

/** One row per export so the trail shows who took data out, and how much. */
export function recordExport(
  context: AuditContext,
  format: string,
  rowCount: number
): Promise<void> {
  return write(context, WHOLE_TABLE, 'export', [
    { column: WHOLE_TABLE, newValue: `${format}, ${rowCount} row(s)` },
  ]);
}

export function recordView(
  context: AuditContext,
  rowCount: number
): Promise<void> {
  return write(context, WHOLE_TABLE, 'view', [
    { column: WHOLE_TABLE, newValue: `${rowCount} row(s)` },
  ]);
}

/** Records which page a signed-in user reached, including the first one after sign-in. */
export function recordPageAccess(
  actionedBy: string,
  page: string,
  path: string
): Promise<void> {
  return write(
    {
      sourceKey: APP_SOURCE_KEY,
      schemaName: 'iCollect',
      tableName: page,
      keyFields: [],
      actionedBy,
    },
    WHOLE_TABLE,
    'login',
    [{ column: WHOLE_TABLE, newValue: path }]
  );
}

export interface AuditQuery {
  /** Inclusive lower bound on `actionedAt`. */
  from?: Date;
  /** Inclusive upper bound on `actionedAt`. */
  to?: Date;
  /** Exact `actionedBy` match, so one user sees only their own trail. */
  actionedBy?: string;
  limit?: number;
}

/**
 * Fabric permissions govern the source data; the log itself is readable by every
 * signed-in user, so narrowing by `actionedBy` is a convenience, not a boundary.
 *
 * Filtering runs in the query rather than the browser because an update writes one
 * row per column, so `limit` is exhausted far faster than the row count suggests.
 */
export async function listAudit(query: AuditQuery = {}): Promise<AuditRecord[]> {
  const client = getRayfinClient();

  const where: {
    actionedAt?: { gte?: Date; lte?: Date };
    actionedBy?: { eq: string };
  } = {};
  if (query.from || query.to) {
    where.actionedAt = {};
    if (query.from) where.actionedAt.gte = query.from;
    if (query.to) where.actionedAt.lte = query.to;
  }
  if (query.actionedBy) where.actionedBy = { eq: query.actionedBy };

  let builder = client.data.AuditEntry.select([
    'id',
    'sourceKey',
    'schemaName',
    'tableName',
    'rowKey',
    'columnName',
    'oldValue',
    'newValue',
    'actionType',
    'actionedBy',
    'actionedAt',
  ]);
  if (where.actionedAt || where.actionedBy) builder = builder.where(where);

  const rows = await builder
    .orderBy({ actionedAt: 'desc' })
    .first(query.limit ?? 200)
    .execute();

  return rows as unknown as AuditRecord[];
}
