import type { Row } from './fabricGraphql';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: string[], rows: Row[]): string {
  const header = columns.map(csvCell).join(',');
  const body = rows.map((row) =>
    columns.map((column) => csvCell(row[column])).join(',')
  );
  return [header, ...body].join('\r\n');
}

/** Header-only CSV so bulk uploads start from the table's real shape. */
export function templateCsv(columns: string[]): string {
  return toCsv(columns, []);
}

export function download(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(name: string, columns: string[], rows: Row[]): void {
  download(`${name}.csv`, toCsv(columns, rows), 'text/csv;charset=utf-8');
}

export function downloadJson(name: string, rows: Row[]): void {
  download(`${name}.json`, JSON.stringify(rows, null, 2), 'application/json');
}

/** Parses a CSV upload into rows keyed by the table's columns. */
export function parseCsv(text: string): Row[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const split = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  };

  const header = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])) as Row;
  });
}
