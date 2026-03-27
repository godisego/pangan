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
  { href: '/', label: '总览', description: '今日结论与市场快照' },
  { href: '/commander', label: '作战', description: '主线、股票池与军令' },
  { href: '/review', label: '复盘', description: '验证逻辑与结果' },
  { href: '/chat', label: '对话', description: '问主题、问个股、做验证' },
  { href: '/settings', label: '设置', description: 'AI、通知与偏好中心' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function DesktopNavItem({
  href,
  label,
  description,
  active,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`nav-rail-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="nav-rail-dot" />
      <span className="nav-rail-body">
        <span className="block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">{description}</span>
      </span>
      <span className="nav-action-hint">{active ? '当前' : '进入'}</span>
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1600px] lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden lg:block">
          <div className="surface-panel sticky top-6 flex h-[calc(100vh-3rem)] flex-col overflow-hidden px-5 py-5">
            <div className="border-b border-[var(--border-color)] pb-5">
              <div className="section-kicker">Pangang OS</div>
              <div className="mt-4 text-2xl font-semibold tracking-tight">盘感终端</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                让首页给出结论，让作战室负责执行，让复盘闭环验证。
              </p>
            </div>

            <nav className="mt-5 flex-1 space-y-3">
              {tabs.map((tab) => (
                <DesktopNavItem
                  key={tab.href}
                  href={tab.href}
                  label={tab.label}
                  description={tab.description}
                  active={isActivePath(pathname, tab.href)}
                />
              ))}
            </nav>

            <div className="mt-5 rounded-[26px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Design Intent</div>
              <div className="mt-3 text-sm font-semibold text-[var(--text-primary)]">清晰、克制、可信</div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                所有页面都围绕结论、证据和动作三层展开，不再把信息堆在同一屏里争抢注意力。
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/92 px-4 pb-5 pt-4 backdrop-blur-xl lg:rounded-[32px] lg:border lg:bg-[rgba(6,16,24,0.72)] lg:px-8 lg:pt-8">
            <div className={`mx-auto ${maxWidthClassName}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="section-kicker">Control Layer</span>
                    {badge ? <span className="metric-chip"><strong>{badge}</strong></span> : null}
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] md:text-4xl">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] md:text-[0.95rem]">
                      {subtitle}
                    </p>
                  ) : null}
                </div>

                {actions ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 hidden gap-2 md:flex lg:hidden">
                {tabs.map((tab) => (
                  <MobileNavItem
                    key={tab.href}
                    href={tab.href}
                    label={tab.label}
                    active={isActivePath(pathname, tab.href)}
                  />
                ))}
              </div>
            </div>
          </header>

          <main className={`mx-auto ${maxWidthClassName} px-4 py-6 lg:px-8 ${showMobileNav ? 'pb-28 md:pb-10' : 'pb-10'} ${contentClassName}`}>
            {children}
          </main>
        </div>
      </div>

      {showMobileNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/96 px-3 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-5 gap-2">
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
