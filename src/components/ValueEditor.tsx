import { useRef } from 'react';

const DATE_ONLY_SCALARS = new Set(['date', 'localdate']);
const DATE_SCALARS = new Set([
  'date',
  'localdate',
  'datetime',
  'datetime2',
  'localdatetime',
  'smalldatetime',
  'timestamp',
]);
const INTEGER_SCALARS = new Set([
  'int',
  'integer',
  'long',
  'short',
  'byte',
  'bigint',
]);
const DECIMAL_SCALARS = new Set([
  'float',
  'double',
  'decimal',
  'single',
  'money',
  'number',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** Split in two so neither pattern gets hairy: date and clock, then fraction and zone. */
const ISO_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/;
const ISO_TAIL = /^(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

export function editorKind(scalar: string): 'date' | 'number' | 'text' {
  const name = scalar.toLowerCase();
  if (DATE_SCALARS.has(name)) return 'date';
  if (INTEGER_SCALARS.has(name) || DECIMAL_SCALARS.has(name)) return 'number';
  return 'text';
}

function datePart(value: string): string {
  return ISO_DATE.exec(value)?.[0] ?? '';
}

interface Timestamp {
  date: string;
  time: string;
  fraction: string;
  zone: string;
}

function parseTimestamp(value: string): Timestamp | null {
  const text = value.trim();
  const head = ISO_CLOCK.exec(text);
  if (!head) return null;
  const tail = ISO_TAIL.exec(text.slice(head[0].length));
  if (!tail) return null;
  return {
    date: head[1],
    time: head[2].length === 5 ? `${head[2]}:00` : head[2],
    fraction: tail[1] ?? '',
    zone: tail[2] ?? '',
  };
}

/**
 * Puts the fraction and zone back on unchanged. Reading the stored text literally
 * rather than through Date keeps a UTC value from silently shifting to local time.
 */
function composeTimestamp(next: string, original: Timestamp): string {
  if (!next) return '';
  const [date, clock = '00:00:00'] = next.split('T');
  const time = clock.length === 5 ? `${clock}:00` : clock;
  return `${date}T${time}${original.fraction}${original.zone}`;
}

interface ValueEditorProps {
  scalar: string;
  value: string;
  onChange: (next: string) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function ValueEditor({
  scalar,
  value,
  onChange,
  onCommit,
  onCancel,
  autoFocus = false,
}: Readonly<ValueEditorProps>) {
  const container = useRef<HTMLDivElement>(null);
  const name = scalar.toLowerCase();
  const kind = editorKind(scalar);

  // Focus moves between the text field and the date field during a pick, so
  // committing has to wait a tick and confirm focus really left the editor.
  function handleBlur(): void {
    window.setTimeout(() => {
      if (!container.current?.contains(document.activeElement)) onCommit?.();
    }, 0);
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Enter') onCommit?.();
    if (event.key === 'Escape') onCancel?.();
  }

  const field =
    'w-full min-w-0 rounded border border-indigo-400 px-2 py-1 text-sm';
  // No min-w-0, so the control keeps the intrinsic width that shows the whole value.
  const dateField = 'w-full rounded border border-indigo-400 px-2 py-1 text-sm';

  if (kind === 'number') {
    return (
      <div ref={container} onBlur={handleBlur} className="flex items-center">
        <input
          autoFocus={autoFocus}
          type="number"
          step={INTEGER_SCALARS.has(name) ? '1' : 'any'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={field}
        />
      </div>
    );
  }

  if (kind === 'date') {
    const day = datePart(value);
    if (DATE_ONLY_SCALARS.has(name) && (day || !value)) {
      return (
        <div ref={container} onBlur={handleBlur} className="flex items-center">
          <input
            autoFocus={autoFocus}
            type="date"
            value={day}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className={dateField}
          />
        </div>
      );
    }

    const stamp = parseTimestamp(value);
    if (stamp) {
      return (
        <div ref={container} onBlur={handleBlur} className="flex items-center">
          <input
            autoFocus={autoFocus}
            type="datetime-local"
            step="1"
            title={stamp.zone ? `Stored as ${value}` : undefined}
            value={`${stamp.date}T${stamp.time}`}
            onChange={(event) =>
              onChange(composeTimestamp(event.target.value, stamp))
            }
            onKeyDown={handleKeyDown}
            className={dateField}
          />
        </div>
      );
    }

    // An unrecognised value stays editable as text rather than disappearing
    // behind a native control that cannot represent it.
    return (
      <div ref={container} onBlur={handleBlur}>
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="YYYY-MM-DDThh:mm:ssZ"
          className={field}
        />
      </div>
    );
  }

  return (
    <div ref={container} onBlur={handleBlur}>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={field}
      />
    </div>
  );
}
