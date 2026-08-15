import {
  authenticated,
  boolean,
  date,
  entity,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * Per-table editability. Fabric decides what a user can see; this narrows what
 * the app is willing to write, so read-only stays the default until enabled.
 */
@entity()
@authenticated(['create', 'read', 'update', 'delete'])
export class TableConfig {
  @uuid() id!: string;
  /** `{workspaceId}/{itemId}` of the Fabric source. */
  @text({ max: 200 }) sourceKey!: string;
  @text({ max: 200 }) sourceName!: string;
  @text({ max: 128 }) schemaName!: string;
  @text({ max: 128 }) tableName!: string;
  @boolean() isEnabled!: boolean;
  @boolean() allowInsert!: boolean;
  @boolean() allowUpdate!: boolean;
  @boolean() allowDelete!: boolean;
  /** JSON array of column names treated as the row key for audit and updates. */
  @text({ max: 900, optional: true }) keyColumns?: string;
  @text({ max: 256 }) updatedBy!: string;
  @date() updatedAt!: Date;
}
