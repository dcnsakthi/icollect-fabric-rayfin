import { useEffect, useRef, useState } from 'react';

export type ExportFormat = 'CSV' | 'JSON';

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
}

export function ExportMenu({ onExport }: Readonly<ExportMenuProps>) {
  const [open, setOpen] = useState(false);
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

  function choose(format: ExportFormat): void {
    setOpen(false);
    onExport(format);
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
          open
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
            : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}
      >
        Export
        <span
          aria-hidden="true"
          className={`text-xs ${open ? 'text-indigo-600' : 'text-gray-500'}`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose('CSV')}
            className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose('JSON')}
            className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Download JSON
          </button>
        </div>
      ) : null}
    </div>
  );
}
