import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { APP_LOGO } from '@/assets/logo';
import { PoweredBy } from '@/components/PoweredBy';
import { Wordmark } from '@/components/Wordmark';
import { useAdmins } from '@/hooks/AdminContext';
import { useAuth } from '@/hooks/AuthContext';
import { recordPageAccess } from '@/services/auditService';

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/data': 'Data',
  '/audit': 'Audit',
  '/admin': 'Admin',
};

const NAV_ITEMS: {
  to: string;
  label: string;
  end?: boolean;
  adminOnly?: boolean;
}[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/data', label: 'Data' },
  { to: '/audit', label: 'Audit' },
  { to: '/admin', label: 'Admin', adminOnly: true },
];

/** Module scope on purpose: survives the remount this layout gets on every route. */
let lastLoggedPath = '';

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;

function initials(value: string): string {
  return value.slice(0, 2).toUpperCase();
}

export function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmins();
  const { pathname } = useLocation();
  const email = user?.email;

  useEffect(() => {
    if (!email || lastLoggedPath === pathname) return;
    lastLoggedPath = pathname;
    void recordPageAccess(
      email,
      PAGE_NAMES[pathname] ?? pathname,
      pathname
    ).catch(() => undefined);
  }, [email, pathname]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/85 backdrop-blur">
        <div className="flex w-full flex-wrap items-center gap-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0">
          <NavLink to="/" className="mr-4 flex items-center gap-2" end>
            <img
              src={APP_LOGO}
              alt=""
              className="h-8 w-auto"
              aria-hidden="true"
            />
            <Wordmark className="font-semibold text-gray-900" />
          </NavLink>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly).map(
              (item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={linkClass}
                  end={item.end}
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {email ? (
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {initials(email)}
                </span>
                <span className="hidden text-sm text-gray-500 sm:inline">
                  {email}
                </span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex w-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="px-4 pb-6 sm:px-6">
        <PoweredBy />
      </footer>
    </div>
  );
}
