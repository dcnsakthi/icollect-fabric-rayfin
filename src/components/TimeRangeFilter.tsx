import { useEffect, useRef, useState } from 'react';

export type TimeRangeId =
  | '24h'
  | '7d'
  | '15d'
  | '30d'
  | '6m'
  | '1y'
  | 'custom';

export interface TimeRange {
  id: TimeRangeId;
  /** Inclusive lower bound. */
  from: Date;
  /** Inclusive upper bound; the presets run up to now. */
  to: Date;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PRESETS: { id: Exclude<TimeRangeId, 'custom'>; label: string }[] = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '15d', label: 'Last 15 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '6m', label: 'Last 6 months' },
  { id: '1y', label: 'Last 1 year' },
];

function startOf(id: Exclude<TimeRangeId, 'custom'>, to: Date): Date {
  const from = new Date(to);
  if (id === '24h') return new Date(to.getTime() - DAY);
  if (id === '7d') return new Date(to.getTime() - 7 * DAY);
  if (id === '15d') return new Date(to.getTime() - 15 * DAY);
  if (id === '30d') return new Date(to.getTime() - 30 * DAY);
  if (id === '6m') from.setMonth(from.getMonth() - 6);
  else from.setFullYear(from.getFullYear() - 1);
  return from;
}

export function presetRange(id: Exclude<TimeRangeId, 'custom'>): TimeRange {
  const to = new Date();
  return { id, from: startOf(id, to), to };
}

/** `<input type="date">` speaks `yyyy-mm-dd` in local time, which `toISOString` does not. */
function toInputDate(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fromInputDate(value: string, endOfDay: boolean): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function labelFor(range: TimeRange): string {
  if (range.id !== 'custom') {
    return PRESETS.find((preset) => preset.id === range.id)?.label ?? '';
  }
  return `${range.from.toLocaleDateString()} – ${range.to.toLocaleDateString()}`;
}

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeFilter({
  value,
  onChange,
}: Readonly<TimeRangeFilterProps>) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => toInputDate(value.from));
  const [customTo, setCustomTo] = useState(() => toInputDate(value.to));
  const [choice, setChoice] = useState<TimeRangeId>(value.id);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: PointerEvent): void {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function pick(id: TimeRangeId): void {
    setChoice(id);
    // A custom range is incomplete until both dates are read, so it waits for Apply.
    if (id === 'custom') return;
    setOpen(false);
    onChange(presetRange(id));
  }

  function applyCustom(): void {
    const from = fromInputDate(customFrom, false);
    const to = fromInputDate(customTo, true);
    if (!from || !to || from > to) return;
    setOpen(false);
    onChange({ id: 'custom', from, to });
  }

  const customInvalid =
    !fromInputDate(customFrom, false) ||
    !fromInputDate(customTo, true) ||
    customFrom > customTo;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
          open
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
            : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}
      >
        <span aria-hidden="true">🗓</span>
        {labelFor(value)}
        <span
          aria-hidden="true"
          className={`text-xs ${open ? 'text-indigo-600' : 'text-gray-500'}`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <fieldset>
            <legend className="sr-only">Time filter</legend>
            {PRESETS.map((preset) => (
              <label
                key={preset.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="time-range"
                  checked={choice === preset.id}
                  onChange={() => pick(preset.id)}
                />
                {preset.label}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <input
                type="radio"
                name="time-range"
                checked={choice === 'custom'}
                onChange={() => pick('custom')}
              />
              Custom date range
            </label>
          </fieldset>

          {choice === 'custom' ? (
            <div className="mt-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Start date"
                  value={customFrom}
                  max={customTo}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="date"
                  aria-label="End date"
                  value={customTo}
                  min={customFrom}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={applyCustom}
                disabled={customInvalid}
                className="mt-3 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
