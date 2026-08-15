import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

/** User-extensible dropdown values, kept app-side so source tables stay untouched. */
@entity()
@authenticated(['create', 'read', 'update'])
export class LookupValue {
  @uuid() id!: string;
  /** `{workspaceId}/{itemId}` of the Fabric source. */
  @text({ max: 200 }) sourceKey!: string;
  @text({ max: 128 }) schemaName!: string;
  @text({ max: 128 }) tableName!: string;
  @text({ max: 128 }) columnName!: string;
  @text({ max: 400 }) value!: string;
  @text({ max: 256 }) createdBy!: string;
  @date() createdAt!: Date;
}
