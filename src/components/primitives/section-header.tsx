import Link from 'next/link';

interface SectionHeaderProps {
  title: string;
  seeAllHref?: string;
  accentColor?: string;
  className?: string;
}

export function SectionHeader({
  title,
  seeAllHref,
  accentColor,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between mb-4 px-6 md:px-12${className ? ` ${className}` : ''}`}
    >
      <div className="flex items-center">
        {accentColor && (
          <div
            className="w-1 h-6 rounded-full mr-3 flex-shrink-0"
            style={{ background: accentColor }}
            aria-hidden="true"
          />
        )}
        <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
          {title}
        </h2>
      </div>

      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="text-sm text-[var(--color-brand-blue-safe)] hover:text-white transition-colors"
        >
          See All →
        </Link>
      )}
    </div>
  );
}
