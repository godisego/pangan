'use client';

import Link from 'next/link';
import ModuleShell from '@/components/ModuleShell';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderStock, CommanderSummary } from '@/types/api';

function tradeStateClass(state?: string) {
  if (state === '真启动') return 'text-[var(--accent-green)]';
  if (state === '拉高出货') return 'text-[var(--accent-red)]';
  return 'text-[var(--accent-gold)]';
}

function BriefMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
      <div className="module-node__copy">{detail}</div>
    </div>
  );
}

function formatSnapshotStatus(summary?: CommanderSummary) {
  const meta = summary?.snapshot_meta;
  if (!meta) return null;
  if (meta.state === 'fresh') return '实时摘要';
  if (meta.state === 'stale') return '缓存摘要';
  if (meta.state === 'boot') return '启动快照';
  return '摘要快照';
}

function StockLane({
  title,
  accent,
  stocks,
}: {
  title: string;
  accent: 'attack' | 'defense';
  stocks: CommanderStock[];
}) {
  const accentClass = accent === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';

  return (
    <div className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="module-node__label">{accent === 'attack' ? 'Attack Lane' : 'Defense Lane'}</div>
          <div className="module-node__title">{title}</div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${accentClass}`}>
          {accent === 'attack' ? '进攻' : '防守'}
        </div>
      </div>

      <div className="mt-4 scan-list">
        {stocks.length ? (
          stocks.map((stock) => (
            <div key={`${title}-${stock.code}`} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block text-sm leading-7 text-[var(--text-primary)]">
                    <span className={`mr-2 ${accentClass}`}>{stock.priority}</span>
                    {stock.stock}
                  </strong>
                  <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                    {stock.auction_status} · {stock.tactic}
                  </div>
                </div>
                <div className={`shrink-0 text-right ${accentClass}`}>
                  <div className="text-sm font-semibold">{stock.auction_price}</div>
                  {stock.actionability ? (
                    <div className="mt-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">{stock.actionability}</div>
                  ) : null}
                </div>
              </div>
              {stock.execution_note || stock.risk_note ? (
                <div className="mt-3 grid gap-2">
                  {stock.execution_note ? (
                    <div className="text-sm leading-7 text-[var(--text-secondary)]">{stock.execution_note}</div>
                  ) : null}
                  {stock.risk_note ? (
                    <div className="text-xs leading-6 text-[var(--accent-red)]">{stock.risk_note}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="scan-row">
            <div className="scan-row-copy">
              <strong>暂无推荐</strong>
              <span>当前没有足够可靠的候选。</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommanderOverview() {
  const { data, loading, error, isRefreshing, refetch } = useFetch<CommanderSummary>(
    () => commanderApi.getSummary(),
    { interval: 60000, cacheKey: 'pangang_cache_commander_summary_v4' }
  );

  if (loading) {
    return (
      <ModuleShell
        code="01"
        eyebrow="Today Briefing"
        title="正在整理今日结论"
        badge="Briefing"
        variant="briefing"
        motion="pulse"
      >
        <div className="module-node">
          <div className="module-node__label">Status</div>
          <div className="module-node__title">正在生成今日结论...</div>
          <div className="module-node__copy">当前会优先读取快照，再在后台刷新主线与股票池。</div>
        </div>
      </ModuleShell>
    );
  }

  if (!data) {
    return (
      <ModuleShell
        code="01"
        eyebrow="Today Briefing"
        title="今日总控台暂时不可用"
        badge="Fallback"
        variant="briefing"
        motion="pulse"
      >
        <div className="module-node">
          <div className="module-node__label">Error</div>
          <div className="module-node__title">摘要加载失败</div>
          <div className="module-node__copy">{error ? error.message : '当前还没有拿到今日摘要。'}</div>
        </div>
      </ModuleShell>
    );
  }

  const attackName = data.mainlines.logic_a?.name || '无';
  const defenseName = data.mainlines.logic_b?.name || '无';
  const attackStocks = data.recommended_stocks?.attack || [];
  const defenseStocks = data.recommended_stocks?.defense || [];

  return (
    <ModuleShell
      code="01"
      eyebrow="Today Briefing"
      title="先看结论，再决定是否继续深读"
      badge={`${data.weather.icon} ${data.weather.weather}`}
      variant="briefing"
      motion="pulse"
      actions={(
        <>
          <Link href="/commander" className="btn btn-primary px-4 py-2 text-sm">
            去作战
          </Link>
          <Link href="/review" className="btn btn-secondary px-4 py-2 text-sm">
            去复盘
          </Link>
          <button type="button" onClick={() => void refetch()} className="btn btn-secondary px-4 py-2 text-sm">
            {isRefreshing ? '刷新中...' : '刷新结论'}
          </button>
        </>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="module-node">
          <div className="module-node__label">Main Takeaway</div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            进攻看 <span className="text-[var(--accent-green)]">{attackName}</span>
            <br className="hidden sm:block" />
            <span className="sm:hidden">，</span>
            防守看 <span className="text-[var(--accent-gold)]">{defenseName}</span>
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            {data.action_now || data.focus || data.mainlines.summary}
          </div>
          {data.snapshot_meta ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
                {formatSnapshotStatus(data)}
              </span>
              {data.snapshot_meta.updated_at ? (
                <span>更新于 {data.snapshot_meta.updated_at.replace('T', ' ').slice(0, 19)}</span>
              ) : null}
              {typeof data.snapshot_meta.age_seconds === 'number' ? (
                <span>· 延迟 {data.snapshot_meta.age_seconds}s</span>
              ) : null}
              {data.snapshot_meta.refreshing ? <span>· 后台刷新中</span> : null}
            </div>
          ) : null}
          {data.factor_engine || data.trade_filter ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.factor_engine ? (
                <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">四阶段判断</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {data.factor_engine.stage} · {data.factor_engine.score} 分
                  </div>
                  <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{data.factor_engine.note}</div>
                </div>
              ) : null}
              {data.trade_filter ? (
                <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">执行过滤</div>
                  <div className={`mt-2 text-xl font-semibold ${tradeStateClass(data.trade_filter.state)}`}>
                    {data.trade_filter.state}
                  </div>
                  <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{data.trade_filter.reason}</div>
                  {(data.trade_filter.evidence || []).length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.trade_filter.evidence?.slice(0, 3).map((item) => (
                        <span key={item} className="module-badge">{item}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {(data.factor_engine?.signals || []).length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.factor_engine?.signals?.slice(0, 4).map((signal) => (
                <div key={signal.name} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{signal.name}</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{signal.verdict}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{signal.value}</div>
                </div>
              ))}
            </div>
          ) : null}
          {data.news_analysis?.lead_event || data.news_analysis?.market_implication ? (
            <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">事件结论</div>
              <div className="mt-2 text-sm leading-7 text-[var(--text-primary)]">
                {data.news_analysis?.lead_event || '当前暂无明确主事件。'}
              </div>
              {data.news_analysis?.market_implication ? (
                <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                  {data.news_analysis.market_implication}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="module-kpi-grid">
          <BriefMetric
            label="阶段"
            value={data.phase_label || '盘中阶段'}
            detail={data.action_now || '沿着主线和仓位执行。'}
          />
          <BriefMetric
            label="仓位"
            value={data.position_text}
            detail={`进攻 ${data.position.attack}% / 防守 ${data.position.defense}% / 现金 ${data.position.cash}%`}
          />
          <BriefMetric
            label="天气"
            value={`${data.weather.icon} ${data.weather.weather}`}
            detail={data.weather.auction_sentiment || data.weather.description || '暂无补充说明'}
          />
          <BriefMetric
            label="执行状态"
            value={data.trade_filter?.state || '仅观察'}
            detail={data.trade_filter?.guidance || '等待更多确认后再决定是否放大执行。'}
          />
          <BriefMetric
            label="昨日验证"
            value={data.review?.status || '暂无记录'}
            detail={data.review?.summary || '今天开始继续累计。'}
          />
        </div>
      </div>

      <div className="module-columns xl:grid-cols-2">
        <StockLane title={attackName} accent="attack" stocks={attackStocks} />
        <StockLane title={defenseName} accent="defense" stocks={defenseStocks} />
      </div>

      {data.strategic_views ? (
        <div className="module-columns xl:grid-cols-2">
          <div className="module-node">
            <div className="module-node__label">Long-Term View</div>
            <div className="module-node__title">{data.strategic_views.long_term.stance}</div>
            <div className="module-node__copy">{data.strategic_views.long_term.rationale}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(data.strategic_views.long_term.themes || []).map((theme) => (
                <span key={theme} className="module-badge">{theme}</span>
              ))}
            </div>
          </div>
          <div className="module-node">
            <div className="module-node__label">Short-Term View</div>
            <div className="module-node__title">{data.strategic_views.short_term.stance}</div>
            <div className="module-node__copy">{data.strategic_views.short_term.rationale}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(data.strategic_views.short_term.focus || []).map((theme) => (
                <span key={theme} className="module-badge">{theme}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {data.learning_feedback?.summary ? (
        <div className="module-node">
          <div className="module-node__label">Self-Correction</div>
          <div className="module-node__title">复盘纠偏已回灌</div>
          <div className="module-node__copy">{data.learning_feedback.summary}</div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[18px] border border-[rgba(255,123,136,0.2)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          当前展示的是最近一次成功结果。后台刷新刚刚失败：{error.message}
        </div>
      ) : null}
    </ModuleShell>
  );
}
