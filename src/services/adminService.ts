import {
  recordDelete,
  recordInsert,
  type AuditContext,
} from './auditService';
import { getRayfinClient } from './rayfinClient';

export interface AppAdminRecord {
  id: string;
  email: string;
  displayName: string;
  addedBy: string;
  addedAt: Date;
}

const FIELDS = ['id', 'email', 'displayName', 'addedBy', 'addedAt'] as const;

/** Admin membership is app state rather than Fabric state, so it audits under the app key. */
function auditContext(actionedBy: string): AuditContext {
  return {
    sourceKey: 'icollect/app',
    schemaName: 'iCollect',
    tableName: 'AppAdmin',
    keyFields: ['email'],
    actionedBy,
  };
}

export async function listAdmins(): Promise<AppAdminRecord[]> {
  const client = getRayfinClient();
  const rows = await client.data.AppAdmin.select([...FIELDS])
    .orderBy({ addedAt: 'asc' })
    .first(500)
    .execute();
  return rows as unknown as AppAdminRecord[];
}

export async function addAdmin(
  user: { email: string; displayName: string },
  addedBy: string
): Promise<void> {
  const client = getRayfinClient();
  const addedAt = new Date();
  await client.data.AppAdmin.create({
    email: user.email,
    displayName: user.displayName,
    addedBy,
    addedAt,
  });
  await recordInsert(auditContext(addedBy), {
    email: user.email,
    displayName: user.displayName,
    addedBy,
    addedAt: addedAt.toISOString(),
  });
}

export async function removeAdmin(
  record: AppAdminRecord,
  actionedBy: string
): Promise<void> {
  const client = getRayfinClient();
  await client.data.AppAdmin.delete({ id: record.id });
  await recordDelete(auditContext(actionedBy), {
    email: record.email,
    displayName: record.displayName,
    addedBy: record.addedBy,
    addedAt: record.addedAt.toISOString(),
  });
}

/** Nobody named means nobody has claimed the app, so everyone administers it. */
export function isAdminUser(
  admins: AppAdminRecord[],
  email: string | undefined
): boolean {
  if (!admins.length) return true;
  if (!email) return false;
  const mine = email.toLowerCase();
  return admins.some((admin) => admin.email.toLowerCase() === mine);
}
