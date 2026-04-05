type ModuleVariant =
  | 'briefing'
  | 'evidence'
  | 'macro'
  | 'execution'
  | 'strategy'
  | 'stockpool'
  | 'review'
  | 'chat'
  | 'settings';

type ModuleMotion = 'rise' | 'scan' | 'drift' | 'orbit' | 'pulse' | 'track';

type ModuleShellProps = {
  code: string;
  eyebrow: string;
  title: string;
  summary?: string;
  badge?: string;
  variant?: ModuleVariant;
  motion?: ModuleMotion;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export default function ModuleShell({
  code,
  eyebrow,
  title,
  summary,
  badge,
  variant = 'briefing',
  motion = 'rise',
  actions,
  className = '',
  children,
}: ModuleShellProps) {
  return (
    <section className={`module-shell module-${variant} motion-${motion} ${className}`.trim()}>
      <div className="module-shell__frame">
        <div className="module-shell__top">
          <div className="module-shell__intro">
            <div className="module-shell__meta">
              <span className="module-code">{code}</span>
              <span className="module-eyebrow">{eyebrow}</span>
            </div>
            <h2 className="module-shell__title">{title}</h2>
            {summary ? <p className="module-shell__summary">{summary}</p> : null}
          </div>

          <div className="module-shell__side">
            {badge ? <span className="module-badge">{badge}</span> : null}
            {actions ? <div className="module-shell__actions">{actions}</div> : null}
          </div>
        </div>

        <div className="module-shell__body">{children}</div>
      </div>
    </section>
  );
}
