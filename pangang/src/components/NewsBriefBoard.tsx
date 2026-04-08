'use client';

import type { CommanderDirectionLeg, CommanderNewsAnalysis, CommanderNewsItem } from '@/types/api';

function MetaChip({ value, tone = 'normal' }: { value: string; tone?: 'normal' | 'risk' }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.14em] ${
        tone === 'risk'
          ? 'border-[rgba(255,123,136,0.2)] bg-[var(--accent-red-dim)] text-[var(--accent-red)]'
          : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)]'
      }`}
    >
      {value}
    </span>
  );
}

function directionTone(direction?: string) {
  if (direction === 'bullish') return 'text-[var(--accent-green)]';
  if (direction === 'bearish') return 'text-[var(--accent-red)]';
  return 'text-[var(--accent-gold)]';
}

function directionLabel(type?: string) {
  if (type === 'direct') return '直接受益';
  if (type === 'second_order') return '二阶扩散';
  if (type === 'hedge') return '对冲';
  if (type === 'defensive') return '防守';
  return '方向';
}

function directionValueLabel(direction?: string) {
  if (direction === 'bullish') return '看多';
  if (direction === 'bearish') return '看空';
  return '中性';
}

function DirectionCard({ item }: { item: CommanderDirectionLeg }) {
  return (
    <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{directionLabel(item.beneficiary_type)}</div>
          <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">{item.label}</div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${directionTone(item.direction)}`}>
          {directionValueLabel(item.direction)}
        </div>
      </div>
      <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{item.rationale}</div>
      {(item.themes || []).length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.themes?.slice(0, 3).map((theme) => (
            <span key={`${item.label}-${theme}`} className="module-badge">{theme}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewsList({
  title,
  items,
  tone = 'normal',
  emphasis = 'secondary',
}: {
  title: string;
  items: CommanderNewsItem[];
  tone?: 'normal' | 'risk';
  emphasis?: 'primary' | 'secondary';
}) {
  const isPrimary = emphasis === 'primary';

  return (
    <div className={`module-node ${isPrimary ? 'border-white/14 bg-[rgba(16,20,30,0.92)] shadow-[0_22px_60px_rgba(0,0,0,0.26)]' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="module-node__label">{title}</div>
        {isPrimary ? (
          <span className="rounded-full border border-[rgba(141,220,255,0.16)] bg-[rgba(141,220,255,0.08)] px-2.5 py-1 text-[11px] tracking-[0.14em] text-[var(--accent-cyan)]">
            先看这里
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${title}-${item.title}-${index}`}
              className={`rounded-[18px] border px-4 py-4 ${
                isPrimary
                  ? index === 0
                    ? 'border-[rgba(141,220,255,0.18)] bg-[linear-gradient(180deg,rgba(141,220,255,0.08),rgba(255,255,255,0.02))]'
                    : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]'
                  : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className={`block leading-7 ${isPrimary ? 'text-base text-[var(--text-primary)]' : 'text-sm text-[var(--text-primary)]'}`}>
                    <span className={`mr-2 ${tone === 'risk' ? 'text-[var(--accent-red)]' : isPrimary ? 'text-[var(--accent-cyan)]' : 'text-[var(--accent-gold)]'}`}>
                      {index + 1}.
                    </span>
                    {item.title}
                  </strong>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MetaChip value={item.source} tone={tone} />
                    {item.source_tier ? <MetaChip value={item.source_tier} tone={tone} /> : null}
                    {item.confidence ? <MetaChip value={item.confidence} tone={tone} /> : null}
                    {item.column ? <MetaChip value={item.column} tone={tone} /> : null}
                    {item.event_type ? <MetaChip value={item.event_type} tone={tone} /> : null}
                    {item.horizon ? <MetaChip value={item.horizon} tone={tone} /> : null}
                    {item.heat_score ? <MetaChip value={`热度 ${item.heat_score}`} tone={tone} /> : null}
                    {(item.tags || []).slice(0, 2).map((tag) => (
                      <MetaChip key={`${item.title}-${tag}`} value={tag} tone={tone} />
                    ))}
                  </div>
                </div>
                <div className={`shrink-0 text-xs ${tone === 'risk' ? 'text-[var(--accent-red)]' : isPrimary ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {item.time || '--'}
                </div>
              </div>
              {item.why_it_matters ? (
                <div className={`mt-3 text-sm leading-7 ${isPrimary ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{item.why_it_matters}</div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="scan-row">
            <div className="scan-row-copy">
              <strong>当前暂无内容</strong>
              <span>这部分会在后台新闻链路刷新后补齐。</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsBriefBoard({
  analysis,
  mode = 'full',
}: {
  analysis?: CommanderNewsAnalysis;
  mode?: 'full' | 'compact';
}) {
  if (!analysis) {
    return (
      <div className="module-node">
        <div className="module-node__label">处理中</div>
        <div className="module-node__title">正在整理今日重点消息</div>
        <div className="module-node__copy">会按主事件、次要新闻、风险项和主题聚焦生成简报。</div>
      </div>
    );
  }

  const transmissionChain = analysis.transmission_chain || analysis.event_path || [];
  const directionMap = analysis.direction_map || [];
  const falsifiers = analysis.falsifiers || [];
  const eventDriver = analysis.event_driver || analysis.lead_event;

  return (
    <div className="grid gap-4">
      <div className="module-node">
        <div className="module-node__label">主结论</div>
        <div className="module-node__title">{analysis.headline || analysis.summary || '今日新闻简报'}</div>
        <div className="module-node__copy">{analysis.summary || '当前还没有清晰的新闻叙事。'}</div>
        {eventDriver || analysis.market_implication ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {eventDriver ? (
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">主事件</div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-primary)]">{eventDriver}</div>
              </div>
            ) : null}
            {analysis.market_implication ? (
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">市场含义</div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-primary)]">{analysis.market_implication}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {transmissionChain.length ? (
        <div className="module-node">
          <div className="module-node__label">事件传导路径</div>
          <div className="mt-4 module-flow-list">
            {transmissionChain.map((step) => (
              <div key={step} className="module-flow-step">
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {directionMap.length ? (
        <div className="module-node">
          <div className="module-node__label">方向映射</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {directionMap.map((item) => (
              <DirectionCard key={`${item.label}-${item.direction}-${item.beneficiary_type || 'lane'}`} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {analysis.contrarian_angle || analysis.transmission_summary ? (
        <div className="grid gap-4 md:grid-cols-2">
          {analysis.transmission_summary ? (
            <div className="module-node">
              <div className="module-node__label">传导摘要</div>
              <div className="module-node__copy">{analysis.transmission_summary}</div>
            </div>
          ) : null}
          {analysis.contrarian_angle ? (
            <div className="module-node">
              <div className="module-node__label">反共识视角</div>
              <div className="module-node__copy">{analysis.contrarian_angle}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {falsifiers.length ? (
        <div className="module-node">
          <div className="module-node__label">证伪条件</div>
          <div className="mt-4 grid gap-3">
            {falsifiers.map((item) => (
              <div key={item} className="rounded-[18px] border border-[rgba(255,123,136,0.2)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="module-columns xl:grid-cols-[1.1fr_0.9fr]">
        <NewsList title="重点新闻" items={analysis.primary_news || []} emphasis="primary" />
        <div className="grid gap-4">
          <NewsList title="次要新闻" items={analysis.secondary_news || []} />
          <NewsList title="风险观察" items={analysis.risk_news || []} tone="risk" />
        </div>
      </div>

      {(analysis.topic_clusters || []).length ? (
        <div className="module-node">
          <div className="module-node__label">主题聚焦</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(analysis.topic_clusters || []).map((item) => (
              <div key={item.name} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{item.stance}</div>
                <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{item.name}</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">相关新闻 {item.count} 条</div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.takeaway}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'full' ? (
        <div className="module-columns xl:grid-cols-2">
          <div className="module-node">
            <div className="module-node__label">影响因子</div>
            <div className="mt-4 module-flow-list">
              {(analysis.impact_factors || []).map((factor) => (
                <div key={factor} className="module-flow-step">
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="module-node">
            <div className="module-node__label">今日看点</div>
            <div className="mt-4 grid gap-3">
              {(analysis.watch_points || []).map((point) => (
                <div key={point} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
