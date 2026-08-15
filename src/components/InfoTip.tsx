interface InfoTipProps {
  label: string;
  text: string;
}

const WRAP_AT = 58;

/** Native tooltips honour newlines but never wrap on their own. */
function wrap(text: string): string {
  const lines: string[] = [];
  let line = '';

  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > WRAP_AT) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);

  return lines.join('\n');
}

/**
 * Native title tooltip on purpose: a positioned popover gets clipped by the
 * table's overflow container and widens its scroll area.
 */
export function InfoTip({ label, text }: Readonly<InfoTipProps>) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${text}`}
      title={wrap(text)}
      className="ml-1 inline-flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full border border-gray-400 align-middle text-[10px] leading-none text-gray-500 hover:border-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      i
    </button>
  );
}
