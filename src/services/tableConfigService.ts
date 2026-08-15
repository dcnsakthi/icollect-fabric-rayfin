import {
  recordInsert,
  recordUpdate,
  type AuditContext,
} from './auditService';
import { getRayfinClient } from './rayfinClient';

export interface TableConfigRecord {
  id: string;
  sourceKey: string;
  sourceName: string;
  schemaName: string;
  tableName: string;
  isEnabled: boolean;
  allowInsert: boolean;
  allowUpdate: boolean;
  allowDelete: boolean;
  keyColumns?: string;
  updatedBy: string;
  updatedAt: Date;
}

const FIELDS = [
  'id',
  'sourceKey',
  'sourceName',
  'schemaName',
  'tableName',
  'isEnabled',
  'allowInsert',
  'allowUpdate',
  'allowDelete',
  'keyColumns',
  'updatedBy',
  'updatedAt',
] as const;

export async function listTableConfigs(): Promise<TableConfigRecord[]> {
  const client = getRayfinClient();
  const rows = await client.data.TableConfig.select([...FIELDS])
    .first(500)
    .execute();
  return rows as unknown as TableConfigRecord[];
}

/** Config is app state rather than Fabric state, so it audits under the app key. */
function auditContext(actionedBy: string): AuditContext {
  return {
    sourceKey: 'icollect/app',
    schemaName: 'iCollect',
    tableName: 'TableConfig',
    keyFields: ['sourceKey', 'tableName'],
    actionedBy,
  };
}

const SWITCHES = [
  'isEnabled',
  'allowInsert',
  'allowUpdate',
  'allowDelete',
] as const;

export async function upsertTableConfig(
  existing: TableConfigRecord | undefined,
  values: Omit<TableConfigRecord, 'id' | 'updatedAt'>
): Promise<void> {
  const client = getRayfinClient();
  const payload = { ...values, updatedAt: new Date() };
  const context = auditContext(values.updatedBy);

  if (existing) {
    await client.data.TableConfig.update({ id: existing.id }, payload);
    // Only the switches that moved, so the trail reads as one decision per row.
    const changed = Object.fromEntries(
      SWITCHES.filter((key) => existing[key] !== values[key]).map((key) => [
        key,
        values[key],
      ])
    );
    if (Object.keys(changed).length) {
      await recordUpdate(
        context,
        { ...existing, sourceKey: values.sourceKey, tableName: values.tableName },
        changed
      );
    }
    return;
  }

  await client.data.TableConfig.create(payload);
  await recordInsert(context, {
    sourceKey: values.sourceKey,
    tableName: values.tableName,
    ...Object.fromEntries(SWITCHES.map((key) => [key, values[key]])),
  });
}

/** Admin's master switch: an unenabled table is not offered on the Data page. */
export function isTableEnabled(
  configs: TableConfigRecord[],
  sourceKey: string,
  tableName: string
): boolean {
  return (
    configs.find((c) => c.sourceKey === sourceKey && c.tableName === tableName)
      ?.isEnabled ?? false
  );
}

/**
 * Read-only is the default: a table the administrator has not enabled stays
 * viewable but not writable, even when Fabric would allow the write.
 */
export function permissionsFor(
  configs: TableConfigRecord[],
  sourceKey: string,
  tableName: string
): { canInsert: boolean; canUpdate: boolean; canDelete: boolean } {
  const config = configs.find(
    (c) => c.sourceKey === sourceKey && c.tableName === tableName
  );
  if (!config?.isEnabled) {
    return { canInsert: false, canUpdate: false, canDelete: false };
  }
  return {
    canInsert: config.allowInsert,
    canUpdate: config.allowUpdate,
    canDelete: config.allowDelete,
  };
}
