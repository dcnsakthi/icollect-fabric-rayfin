import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

/**
 * Who may reach the Admin page. An empty table means everyone, so the app stays
 * usable before anyone has claimed it.
 */
@entity()
@authenticated(['create', 'read', 'delete'])
export class AppAdmin {
  @uuid() id!: string;
  /** userPrincipalName taken from a Fabric workspace role assignment. */
  @text({ max: 256 }) email!: string;
  @text({ max: 256 }) displayName!: string;
  @text({ max: 256 }) addedBy!: string;
  @date() addedAt!: Date;
}
