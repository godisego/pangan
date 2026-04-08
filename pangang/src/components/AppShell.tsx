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
  { href: '/', label: '总览' },
  { href: '/chat', label: '对话' },
  { href: '/commander', label: '作战' },
  { href: '/review', label: '复盘' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function DesktopNavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`shell-tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      {label}
    </Link>
  );
}

function MobileNavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`nav-mobile-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
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
    <div className="app-shell min-h-screen text-[var(--text-primary)]">
      <header className="shell-top">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="shell-brand">
              <span className="shell-brand-mark">盘</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-[-0.03em] text-[var(--text-primary)]">盘感</span>
                <span className="block text-xs text-[var(--text-secondary)]">个人决策工作台</span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <nav className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
                <div className="shell-tabs">
                  {tabs.map((tab) => (
                    <DesktopNavItem
                      key={tab.href}
                      href={tab.href}
                      label={tab.label}
                      active={isActivePath(pathname, tab.href)}
                    />
                  ))}
                </div>
              </nav>

              <Link href="/settings" className="btn btn-secondary hidden px-4 py-2 text-sm md:inline-flex">
                设置
              </Link>
            </div>
          </div>

          <div className={`page-hero mx-auto ${maxWidthClassName}`}>
            <div className="min-w-0 rounded-[24px] border border-[rgba(143,177,205,0.1)] bg-[rgba(255,255,255,0.02)] px-4 py-4 md:px-5">
              <div className="flex flex-wrap items-center gap-2">
                {badge ? <span className="metric-chip"><strong>{badge}</strong></span> : null}
                <Link href="/settings" className="btn btn-secondary px-3 py-2 text-sm md:hidden">
                  设置
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] md:text-4xl">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-[0.95rem]">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                {actions ? <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`mx-auto ${maxWidthClassName} px-4 py-6 lg:px-8 ${showMobileNav ? 'pb-28 md:pb-10' : 'pb-10'} ${contentClassName}`}>
        {children}
      </main>

      {showMobileNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/96 px-3 py-3 backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-4 gap-2">
            {tabs.map((tab) => (
              <MobileNavItem
                key={tab.href}
                href={tab.href}
                label={tab.label}
                active={isActivePath(pathname, tab.href)}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
