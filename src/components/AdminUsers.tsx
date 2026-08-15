import { useMemo, useRef, useState } from 'react';

import { InfoTip } from '@/components/InfoTip';
import { useAdmins } from '@/hooks/AdminContext';
import {
  addAdmin,
  removeAdmin,
  type AppAdminRecord,
} from '@/services/adminService';
import type { FabricUser } from '@/services/fabricDiscovery';

const MAX_SUGGESTIONS = 8;

function sinceLabel(value: Date): string {
  return value.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface AdminUsersProps {
  /** Candidates come from the selected workspace's role assignments. */
  users: FabricUser[];
  usersError: string | null;
  workspaceSelected: boolean;
  currentUserEmail: string | undefined;
  run: (action: () => Promise<string | void>) => Promise<void>;
}

export function AdminUsers({
  users,
  usersError,
  workspaceSelected,
  currentUserEmail,
  run,
}: Readonly<AdminUsersProps>) {
  const { admins, refresh } = useAdmins();
  const [search, setSearch] = useState('');
  const container = useRef<HTMLDivElement>(null);

  const named = new Set(admins.map((admin) => admin.email.toLowerCase()));

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return users
      .filter(
        (candidate) =>
          !named.has(candidate.email.toLowerCase()) &&
          (candidate.displayName.toLowerCase().includes(needle) ||
            candidate.email.toLowerCase().includes(needle))
      )
      .slice(0, MAX_SUGGESTIONS);
    // `named` is derived from admins, which is what should retrigger this.
  }, [search, users, admins]);

  function add(candidate: FabricUser): void {
    // Naming the first admin takes the page away from everyone else, including
    // the person doing it if they leave themselves out.
    if (
      !admins.length &&
      candidate.email.toLowerCase() !== currentUserEmail?.toLowerCase() &&
      !window.confirm(
        `${candidate.displayName} would become the only administrator, and you would lose access to this page. Continue?`
      )
    ) {
      return;
    }

    setSearch('');
    void run(async () => {
      await addAdmin(
        { email: candidate.email, displayName: candidate.displayName },
        currentUserEmail ?? 'unknown'
      );
      await refresh();
      return `${candidate.displayName} is now an administrator.`;
    });
  }

  function remove(record: AppAdminRecord): void {
    const warning =
      admins.length === 1
        ? `Remove ${record.displayName}? With nobody named, every signed-in user regains administrator access.`
        : `Remove ${record.displayName} as an administrator?`;
    if (!window.confirm(warning)) return;

    void run(async () => {
      await removeAdmin(record, currentUserEmail ?? 'unknown');
      await refresh();
      return `${record.displayName} is no longer an administrator.`;
    });
  }

  return (
    <section
      ref={container}
      className="rounded-md border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">
          Administrators
          <InfoTip
            label="About administrators"
            text="Only these users see the Admin menu and can change these switches. Candidates are the users assigned to the selected workspace in Fabric, so nobody outside Fabric can be named. While the list is empty, every signed-in user is an administrator."
          />
        </h2>
        <span className="text-xs text-gray-500">
          {admins.length
            ? `${admins.length} named`
            : 'Nobody named, so everyone is an administrator'}
        </span>
      </div>

      <div className="relative mt-3 max-w-md">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={!workspaceSelected || !users.length}
          placeholder={
            workspaceSelected
              ? 'Search workspace users by name or email…'
              : 'Select a workspace to search its users…'
          }
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
        />

        {matches.length ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            {matches.map((candidate) => (
              <li key={candidate.email}>
                <button
                  type="button"
                  onClick={() => add(candidate)}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  <span className="font-medium text-gray-900">
                    {candidate.displayName}
                  </span>
                  <span className="truncate text-xs text-gray-500">
                    {candidate.email} · {candidate.role}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {usersError ? (
        <p className="mt-2 text-xs text-amber-700">{usersError}</p>
      ) : null}

      {admins.length ? (
        <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <span className="font-medium text-gray-900">
                {admin.displayName}
              </span>
              <span className="text-gray-500">{admin.email}</span>
              {admin.email.toLowerCase() ===
              currentUserEmail?.toLowerCase() ? (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  You
                </span>
              ) : null}
              <span className="ml-auto text-xs text-gray-500">
                Admin since {sinceLabel(admin.addedAt)}
              </span>
              <button
                type="button"
                onClick={() => remove(admin)}
                title={`Remove ${admin.displayName}`}
                aria-label={`Remove ${admin.displayName}`}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
