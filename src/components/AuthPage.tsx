import { useState } from 'react';

import { APP_LOGO } from '@/assets/logo';
import { PoweredBy } from '@/components/PoweredBy';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/hooks/AuthContext';

const msLogo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 21 21"
    className="mr-2"
  >
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const HIGHLIGHTS = [
  'Browse and edit Fabric tables straight from the browser',
  'Every insert, update, and delete lands in a column-level audit trail',
  'Admins decide which tables accept edits, and who can make them',
];

export function AuthPage() {
  const { signIn, fabricAuthEnabled } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isLoading
    ? fabricAuthEnabled
      ? 'Opening Fabric...'
      : 'Signing in...'
    : 'Sign in with Microsoft';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-center overflow-hidden bg-slate-950 px-8 py-14 lg:px-16 lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-800" />
        <div className="absolute -top-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-[30rem] w-[30rem] rounded-full bg-indigo-500/30 blur-3xl" />

        <div className="relative max-w-xl">
          {/* The mark has a transparent interior, so it needs a light plate on dark panels. */}
          <img
            src={APP_LOGO}
            alt=""
            className="h-16 w-auto rounded-2xl bg-white p-1 shadow-lg shadow-indigo-900/40"
            aria-hidden="true"
          />

          <h1 className="mt-7 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            <Wordmark accentClassName="text-teal-300" />
          </h1>
          <p className="mt-3 text-base leading-relaxed text-indigo-100/80">
            A Fabric-native workspace for collecting, correcting, and auditing
            operational data — without leaving the browser or waiting on a
            pipeline.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-indigo-100/75">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 h-4 w-4 shrink-0 text-teal-300"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-screen flex-col bg-gray-50 px-6 py-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">Welcome</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Sign in with your Microsoft Fabric identity to continue. Your
                existing workspace permissions carry over — <Wordmark /> never
                grants access you do not already have.
              </p>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={isLoading}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:shadow-lg hover:shadow-blue-600/30 hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
              >
                {msLogo}
                {buttonLabel}
              </button>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              Sign-in activity is recorded in the audit trail.
            </p>
          </div>
        </div>

        <PoweredBy className="pt-10" />
      </section>
    </div>
  );
}
