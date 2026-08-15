import { APP_NAME } from '@/appName';

interface WordmarkProps {
  className?: string;
  /** The logo draws the leading letter in italic teal serif; lighten it on dark panels. */
  accentClassName?: string;
}

export function Wordmark({
  className = '',
  accentClassName = 'text-teal-500',
}: WordmarkProps) {
  const initial = APP_NAME.slice(0, 1);
  const rest = APP_NAME.slice(1);
  return (
    <span className={className}>
      <span className={`font-serif italic ${accentClassName}`}>{initial}</span>
      {rest}
    </span>
  );
}
