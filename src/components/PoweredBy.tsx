interface PoweredByProps {
  className?: string;
}

export function PoweredBy({ className = '' }: Readonly<PoweredByProps>) {
  return (
    <div
      className={`flex w-full items-center justify-center gap-3 ${className}`.trim()}
    >
      <span
        className="h-px max-w-28 flex-1 bg-gradient-to-r from-transparent via-teal-400/60 to-indigo-500/80"
        aria-hidden="true"
      />
      <span className="whitespace-nowrap text-xs tracking-wide text-gray-400">
        Powered by Microsoft Fabric
      </span>
      <span
        className="h-px max-w-28 flex-1 bg-gradient-to-l from-transparent via-teal-400/60 to-indigo-500/80"
        aria-hidden="true"
      />
    </div>
  );
}
