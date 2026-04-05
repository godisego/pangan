'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type AppShellProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
  contentClassName?: string;
  showMobileNav?: boolean;
};

const tabs = [
  { href: '/', label: '总览', code: '01' },
  { href: '/commander', label: '作战', code: '02' },
  { href: '/review', label: '复盘', code: '03' },
  { href: '/chat', label: '对话', code: '04' },
  { href: '/settings', label: '设置', code: '05' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function DesktopNavItem({ href, label, active, code }: { href: string; label: string; active: boolean; code: string }) {
  return (
    <Link href={href} className={`shell-tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="font-mono text-[0.72rem] text-[var(--text-muted)]">{code}</span>
      {label}
    </Link>
  );
}

function MobileNavItem({
  href,
  label,
  active,
  code,
}: {
  href: string;
  label: string;
  active: boolean;
  code: string;
}) {
  return (
    <Link href={href} className={`nav-mobile-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="font-mono text-[0.7rem] opacity-70">{code}</span>
      {label}
    </Link>
  );
}

export default function AppShell({
  title,
  subtitle,
  badge,
  actions,
  children,
  maxWidthClassName = 'max-w-none',
  contentClassName = 'space-y-6',
  showMobileNav = true,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header className="shell-top">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="shell-brand">
              <span className="shell-brand-mark">PG</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-[-0.03em] text-[var(--text-primary)]">盘感终端</span>
                <span className="block text-xs text-[var(--text-secondary)]">News • Action</span>
              </span>
            </Link>

            <nav className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              <div className="shell-tabs">
                {tabs.map((tab) => (
                  <DesktopNavItem
                    key={tab.href}
                    href={tab.href}
                    label={tab.label}
                    code={tab.code}
                    active={isActivePath(pathname, tab.href)}
                  />
                ))}
              </div>
            </nav>
          </div>

          <div className={`page-hero mx-auto ${maxWidthClassName}`}>
            <div className="min-w-0 rounded-[28px] border border-[rgba(143,177,205,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-4 md:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="section-kicker">Terminal</span>
                {badge ? <span className="metric-chip"><strong>{badge}</strong></span> : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] md:text-4xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-[0.95rem]">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center gap-2 self-stretch md:self-end">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className={`mx-auto ${maxWidthClassName} px-4 py-6 lg:px-8 ${showMobileNav ? 'pb-28 md:pb-10' : 'pb-10'} ${contentClassName}`}>
        {children}
      </main>

      {showMobileNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/96 px-3 py-3 backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-5 gap-2">
            {tabs.map((tab) => (
              <MobileNavItem
                key={tab.href}
                href={tab.href}
                label={tab.label}
                code={tab.code}
                active={isActivePath(pathname, tab.href)}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
