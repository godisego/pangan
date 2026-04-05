'use client';

import type { CommanderNewsAnalysis, CommanderNewsItem } from '@/types/api';

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

function NewsList({
  title,
  items,
  tone = 'normal',
}: {
  title: string;
  items: CommanderNewsItem[];
  tone?: 'normal' | 'risk';
}) {
  return (
    <div className="module-node">
      <div className="module-node__label">{title}</div>
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${title}-${item.title}-${index}`}
              className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block text-sm leading-7 text-[var(--text-primary)]">
                    <span className={`mr-2 ${tone === 'risk' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-gold)]'}`}>
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
                <div className={`shrink-0 text-xs ${tone === 'risk' ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}`}>
                  {item.time || '--'}
                </div>
              </div>
              {item.why_it_matters ? (
                <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.why_it_matters}</div>
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
        <div className="module-node__label">News Brief</div>
        <div className="module-node__title">正在整理今日新闻模块</div>
        <div className="module-node__copy">会按主新闻、次新闻、风险项和主题聚焦生成简报。</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="module-node">
        <div className="module-node__label">Headline</div>
        <div className="module-node__title">{analysis.headline || analysis.summary || '今日新闻简报'}</div>
        <div className="module-node__copy">{analysis.summary || '当前还没有清晰的新闻叙事。'}</div>
        {analysis.lead_event || analysis.market_implication ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {analysis.lead_event ? (
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">主事件</div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-primary)]">{analysis.lead_event}</div>
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

      {(analysis.event_path || []).length ? (
        <div className="module-node">
          <div className="module-node__label">事件传导路径</div>
          <div className="mt-4 module-flow-list">
            {(analysis.event_path || []).map((step) => (
              <div key={step} className="module-flow-step">
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="module-columns xl:grid-cols-[1.1fr_0.9fr]">
        <NewsList title="重点新闻" items={analysis.primary_news || []} />
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
