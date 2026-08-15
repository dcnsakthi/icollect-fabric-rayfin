import {
  authenticated,
  date,
  entity,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * Append-only activity log. Granting only `create` and `read` is what makes the
 * trail trustworthy: the same users being audited cannot rewrite or erase it.
 */
@entity()
@authenticated(['create', 'read'])
export class AuditEntry {
  @uuid() id!: string;
  /** `{workspaceId}/{itemId}` of the Fabric source the row belongs to. */
  @text({ max: 200 }) sourceKey!: string;
  @text({ max: 128 }) schemaName!: string;
  @text({ max: 128 }) tableName!: string;
  /** JSON object of the row's key columns, since sources rarely share a key shape. */
  @text({ max: 900 }) rowKey!: string;
  @text({ max: 128 }) columnName!: string;
  @text({ max: 4000, optional: true }) oldValue?: string;
  @text({ max: 4000, optional: true }) newValue?: string;
  @set('insert', 'update', 'delete', 'export', 'view', 'login') actionType!:
    | 'insert'
    | 'update'
    | 'delete'
    | 'export'
    | 'view'
    | 'login';
  @text({ max: 256 }) actionedBy!: string;
  @date() actionedAt!: Date;
}
