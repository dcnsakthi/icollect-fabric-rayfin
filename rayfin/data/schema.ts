import { AppAdmin } from './appAdmin.js';
import { AuditEntry } from './auditEntry.js';
import { LookupValue } from './lookupValue.js';
import { TableConfig } from './tableConfig.js';

export type ICollectSchema = {
  AppAdmin: AppAdmin;
  AuditEntry: AuditEntry;
  LookupValue: LookupValue;
  TableConfig: TableConfig;
};

export const schema = [AppAdmin, AuditEntry, LookupValue, TableConfig];

