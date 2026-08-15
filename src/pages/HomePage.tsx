import { Link } from 'react-router-dom';

import { RecentActivity } from '@/components/RecentActivity';
import { Wordmark } from '@/components/Wordmark';
import { useAdmins } from '@/hooks/AdminContext';
import { useAuth } from '@/hooks/AuthContext';

type QuickAction = {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  adminOnly?: boolean;
};

const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-5 w-5',
  'aria-hidden': true,
} as const;

const QUICK_ACTIONS: QuickAction[] = [
  {
    to: '/data',
    title: 'Browse and edit data',
    description:
      'Pick a workspace and GraphQL source, then search, filter, and correct rows inline.',
    accent: 'bg-indigo-50 text-indigo-600',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </svg>
    ),
  },
  {
    to: '/data',
    title: 'Import and export',
    description:
      'Download CSV or JSON of exactly what the grid is showing, or bulk upload from a template.',
    accent: 'bg-emerald-50 text-emerald-600',
    icon: (
      <svg {...iconProps}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5M12 15V3" />
      </svg>
    ),
  },
  {
    to: '/audit',
    title: 'Review the audit trail',
    description:
      'See who changed which column, when, and what the value was before and after.',
    accent: 'bg-violet-50 text-violet-600',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </svg>
    ),
  },
  {
    to: '/admin',
    title: 'Configure permissions',
    description:
      'Decide which tables accept inserts, updates, and deletes before anyone can edit them.',
    accent: 'bg-amber-50 text-amber-600',
    adminOnly: true,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </svg>
    ),
  },
];

const PRINCIPLES = [
  {
    title: 'Nothing is edited by accident',
    body: 'Edit mode is off by default, and a table only becomes writable once an admin enables that specific operation on it.',
  },
  {
    title: 'Every change is attributable',
    body: 'Inserts, updates, deletes, exports, page views, and sign-ins all land in the audit trail with the actor and timestamp.',
  },
  {
    title: 'Your Fabric permissions still apply',
    body: 'The app calls Fabric as you. If you cannot see a workspace in Fabric, you will not see it here either.',
  },
];

function greeting(name: string | undefined, email: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0] ?? email?.split('@')[0];
  return first ? `Welcome back, ${first}` : 'Welcome back';
}

export function HomePage() {
  const { user } = useAuth();
  const { isAdmin } = useAdmins();
  const actions = QUICK_ACTIONS.filter(
    (action) => isAdmin || !action.adminOnly
  );

  return (
    <div className="w-full space-y-5 sm:space-y-6 lg:space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-slate-950 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-700" />
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />

        <div className="relative max-w-3xl">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
            Fabric-Native Data Entry
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {greeting(user?.name, user?.email)}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-indigo-100/80 sm:text-base">
            <Wordmark accentClassName="text-teal-300" /> lets your team correct
            operational data at the source — directly against Fabric, with a
            full audit trail behind every edit.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/data"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-indigo-50"
            >
              <span>Browse data</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              to="/audit"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              View audit trail
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Get started
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-5"
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${action.accent}`}
              >
                {action.icon}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">
                {action.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                {action.description}
              </p>
              <span className="mt-3 inline-block text-sm text-indigo-600 opacity-0 transition group-hover:opacity-100">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-8">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
          How <Wordmark accentClassName="text-teal-600" /> keeps data
          trustworthy
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title}>
              <h3 className="text-sm font-semibold text-gray-900">
                {principle.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                {principle.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <RecentActivity email={user?.email} />
    </div>
  );
}
