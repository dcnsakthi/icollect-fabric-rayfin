interface StatusBannerProps {
  busy?: boolean;
  error?: string | null;
  notice?: string | null;
  busyLabel?: string;
}

export function StatusBanner({
  busy = false,
  error = null,
  notice = null,
  busyLabel = 'Working…',
}: Readonly<StatusBannerProps>) {
  if (busy) {
    return (
      <output className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <span>{busyLabel}</span>
      </output>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (notice) {
    return (
      <output className="block rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {notice}
      </output>
    );
  }

  return null;
}
