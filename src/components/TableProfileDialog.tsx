import { useEffect } from 'react';

import type { TableBinding } from '@/services/fabricDiscovery';
import type { FabricTable } from '@/services/fabricGraphql';

interface TableProfileDialogProps {
  table: FabricTable;
  workspaceName: string;
  sourceName: string;
  binding?: TableBinding;
  bindingError?: string | null;
  onClose: () => void;
}

interface IdentityCardProps {
  name: string;
  originalName: string;
  type: string;
  detail?: string;
}

function IdentityCard({
  name,
  originalName,
  type,
  detail,
}: Readonly<IdentityCardProps>) {
  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
      <div>
        <div className="text-xs text-gray-500">Name</div>
        <div className="font-medium break-all text-gray-900">{name}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">
          Original name (as in data source)
        </div>
        <div className="font-medium break-all text-gray-900">
          {originalName}
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Type</div>
        <div className="font-medium text-gray-900">
          {type}
          {detail ? (
            <span className="ml-1 font-normal text-gray-500">({detail})</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function operations(table: FabricTable): string {
  return (
    [
      table.createMutation ? 'insert' : null,
      table.updateMutation ? 'update' : null,
      table.deleteMutation ? 'delete' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'read-only'
  );
}

export function TableProfileDialog({
  table,
  workspaceName,
  sourceName,
  binding,
  bindingError,
  onClose,
}: Readonly<TableProfileDialogProps>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const nullableCount = table.columns.filter((c) => c.isNullable).length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${table.entityName} profile`}
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {table.entityName}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {workspaceName} › {sourceName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            ×
          </button>
        </div>

        <div className="border-b border-gray-200 px-5 py-4 text-sm">
          <div className="mb-3 text-gray-500">Connected to</div>
          {binding ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <IdentityCard
                name={binding.sourceItemName}
                originalName={binding.sourceItemName}
                type="Data source"
                detail={binding.sourceTypeLabel}
              />
              <IdentityCard
                name={table.entityName}
                originalName={binding.sourceObject || table.entityName}
                type="GraphQL Type"
                detail={binding.sourceObjectType}
              />
            </div>
          ) : (
            <p className="text-gray-600">
              {bindingError ??
                'The binding could not be read from the API definition.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-gray-200 px-5 py-4 text-sm sm:grid-cols-4">
          <div>
            <div className="text-gray-500">Columns</div>
            <div className="font-medium text-gray-900">{table.columns.length}</div>
          </div>
          <div>
            <div className="text-gray-500">Nullable</div>
            <div className="font-medium text-gray-900">{nullableCount}</div>
          </div>
          <div>
            <div className="text-gray-500">Key columns</div>
            <div className="font-medium text-gray-900">
              {table.keyFields.join(', ') || 'none'}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Source supports</div>
            <div className="font-medium text-gray-900">{operations(table)}</div>
          </div>
        </div>

        {!table.keyFields.length ? (
          <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            No key columns. Fabric can only generate update and delete for a table
            it can address by key, so this table is insert-or-read only until a
            primary key is added at the source and the GraphQL API is refreshed.
          </p>
        ) : null}

        <div className="overflow-auto px-5 py-4">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-gray-600">
                <th className="border-b border-gray-200 py-2 pr-4 font-medium">
                  Column
                </th>
                <th className="border-b border-gray-200 py-2 pr-4 font-medium">
                  Type
                </th>
                <th className="border-b border-gray-200 py-2 pr-4 font-medium">
                  Nullable
                </th>
                <th className="border-b border-gray-200 py-2 font-medium">Key</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((column) => (
                <tr key={column.name}>
                  <td className="border-b border-gray-100 py-1.5 pr-4 text-gray-900">
                    {column.name}
                  </td>
                  <td className="border-b border-gray-100 py-1.5 pr-4 text-gray-600">
                    {column.scalar}
                  </td>
                  <td className="border-b border-gray-100 py-1.5 pr-4 text-gray-600">
                    {column.isNullable ? 'yes' : 'no'}
                  </td>
                  <td className="border-b border-gray-100 py-1.5 text-gray-600">
                    {column.isKey ? '🔑' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
