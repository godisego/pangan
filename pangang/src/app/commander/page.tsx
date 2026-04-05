'use client';

import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';
import NewsBriefBoard from '@/components/NewsBriefBoard';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderLogic, CommanderOrder, CommanderStock } from '@/types/api';

function tradeStateClass(state?: string) {
  if (state === '真启动') return 'text-[var(--accent-green)]';
  if (state === '拉高出货') return 'text-[var(--accent-red)]';
  return 'text-[var(--accent-gold)]';
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
      <div className="module-node__copy">{detail}</div>
    </div>
  );
}

function LogicPanel({
  title,
  logic,
  accent,
}: {
  title: string;
  logic: CommanderLogic;
  accent: 'attack' | 'defense';
}) {
  const accentClass = accent === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';

  return (
    <div className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="module-node__label">{title}</div>
          <div className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${accentClass}`}>{logic.name}</div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentClass}`}>
          {accent === 'attack' ? '进攻' : '防守'}
        </div>
      </div>
      <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{logic.reason}</div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">验证点</div>
          <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{logic.verify_point}</div>
        </div>
        <div className="rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">证伪信号</div>
          <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{logic.fake_signal}</div>
        </div>
      </div>
    </div>
  );
}

function StockLane({
  title,
  stocks,
  accent,
}: {
  title: string;
  stocks: CommanderStock[];
  accent: 'attack' | 'defense';
}) {
  const accentClass = accent === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';

  return (
    <div className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="module-node__label">{accent === 'attack' ? 'Attack Pool' : 'Defense Pool'}</div>
          <div className="module-node__title">{title}</div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentClass}`}>
          {accent === 'attack' ? '进攻池' : '防守池'}
        </div>
      </div>
      <div className="mt-4 scan-list">
        {stocks.map((stock) => (
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
        ))}
      </div>
    </div>
  );
}

export default function CommanderPage() {
  const { data, loading, error, refetch, isRefreshing } = useFetch<CommanderOrder>(
    () => commanderApi.getOrder(),
    { interval: 60000, cacheKey: 'pangang_cache_commander_order_v4' }
  );

  return (
    <AppShell
      title="作战室"
      subtitle="先看现在怎么做，再看主线、股票池和时间窗。"
      badge="Execution Deck"
      maxWidthClassName="max-w-6xl"
      actions={(
        <button onClick={() => void refetch()} className="btn btn-secondary px-4 py-2 text-sm">
          {isRefreshing ? '更新中...' : '刷新'}
        </button>
      )}
    >
      {loading ? (
        <ModuleShell
          code="01"
          eyebrow="Execution Snapshot"
          title="正在生成作战计划"
          badge="Loading"
          variant="execution"
          motion="track"
        >
          <div className="module-node">
            <div className="module-node__label">Status</div>
            <div className="module-node__title">正在生成作战计划...</div>
            <div className="module-node__copy">当前会优先保留已成功结果，不让整页空掉。</div>
          </div>
        </ModuleShell>
      ) : null}

      {!loading && error && !data ? (
        <ModuleShell
          code="01"
          eyebrow="Execution Snapshot"
          title="作战计划暂时不可用"
          badge="Fallback"
          variant="execution"
          motion="track"
        >
          <div className="module-node">
            <div className="module-node__label">Error</div>
            <div className="module-node__title">作战链路暂时失败</div>
            <div className="module-node__copy">{error.message}</div>
          </div>
        </ModuleShell>
      ) : null}

      {data ? (
        <div className="grid gap-4">
          <ModuleShell
            code="01"
            eyebrow="Execution Snapshot"
            title="现在怎么做"
            badge={`${data.battle_weather.icon} ${data.battle_weather.weather}`}
            variant="execution"
            motion="track"
          >
            <div className="module-kpi-grid">
              <StatusCard label="阶段" value={data.context.label} detail={data.context.market_clock} />
              <StatusCard label="当前动作" value={data.context.action_now || '等待军令'} detail={data.commander_tips.focus} />
              <StatusCard
                label="仓位"
                value={data.commander_tips.position_text}
                detail={`进攻 ${data.commander_tips.position.attack}% / 防守 ${data.commander_tips.position.defense}% / 现金 ${data.commander_tips.position.cash}%`}
              />
              <StatusCard
                label="昨日验证"
                value={data.yesterday_review.status}
                detail={data.yesterday_review.summary || '暂无昨日验证摘要'}
              />
            </div>
            {data.snapshot_meta ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
                  {data.snapshot_meta.state === 'fresh'
                    ? '实时作战卡'
                    : data.snapshot_meta.state === 'stale'
                      ? '缓存作战卡'
                      : '启动快照'}
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

            {data.yesterday_review.diagnosis ? (
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">昨日复盘纠偏</div>
                <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                  {data.yesterday_review.diagnosis.label}
                </div>
                <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                  {data.yesterday_review.diagnosis.reason}
                </div>
                {data.yesterday_review.diagnosis.failed_link || data.yesterday_review.diagnosis.next_action ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {data.yesterday_review.diagnosis.failed_link ? (
                      <div className="text-xs leading-6 text-[var(--accent-red)]">
                        失效环节：{data.yesterday_review.diagnosis.failed_link}
                      </div>
                    ) : null}
                    {data.yesterday_review.diagnosis.next_action ? (
                      <div className="text-xs leading-6 text-[var(--accent-green)]">
                        下次动作：{data.yesterday_review.diagnosis.next_action}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm text-[var(--accent-red)]">
                后台刚刚刷新失败，当前先保留最近一次成功结果。
              </div>
            ) : null}
          </ModuleShell>

          <ModuleShell
            code="02"
            eyebrow="Phase Engine"
            title="先判阶段，再定打法"
            badge={data.factor_engine ? `${data.factor_engine.stage} · ${data.factor_engine.score}分` : '阶段待定'}
            variant="strategy"
            motion="pulse"
          >
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-4">
                <div className="module-node">
                  <div className="module-node__label">四阶段判断</div>
                  <div className="module-node__title">{data.factor_engine?.stage || '回暖'}</div>
                  <div className="module-node__copy">{data.factor_engine?.note || '当前先按回暖阶段处理。'}</div>
                </div>

                <div className="module-node">
                  <div className="module-node__label">三态过滤</div>
                  <div className={`module-node__title ${tradeStateClass(data.trade_filter?.state)}`}>
                    {data.trade_filter?.state || '仅观察'}
                  </div>
                  <div className="module-node__copy">{data.trade_filter?.reason || '等待更多市场确认信号。'}</div>
                  {(data.trade_filter?.evidence || []).length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {data.trade_filter?.evidence?.map((item) => (
                        <span key={item} className="module-badge">{item}</span>
                      ))}
                    </div>
                  ) : null}
                  {data.trade_filter?.guidance ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                      {data.trade_filter.guidance}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                {(data.factor_engine?.factors || []).map((factor) => (
                  <div key={factor.name} className="scan-row">
                    <div className="scan-row-copy">
                      <strong>{factor.name}</strong>
                      <span>{factor.detail}</span>
                    </div>
                    <div className="scan-row-value">{factor.score}</div>
                  </div>
                ))}
              </div>
            </div>

            {(data.factor_engine?.signals || []).length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {data.factor_engine?.signals?.map((signal) => (
                  <div key={signal.name} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{signal.name}</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{signal.verdict}</div>
                    <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{signal.value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {data.strategic_views ? (
              <div className="module-columns xl:grid-cols-2">
                <div className="module-node">
                  <div className="module-node__label">长线建议</div>
                  <div className="module-node__title">{data.strategic_views.long_term.stance}</div>
                  <div className="module-node__copy">{data.strategic_views.long_term.rationale}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(data.strategic_views.long_term.themes || []).map((theme) => (
                      <span key={theme} className="module-badge">{theme}</span>
                    ))}
                  </div>
                </div>
                <div className="module-node">
                  <div className="module-node__label">短线建议</div>
                  <div className="module-node__title">{data.strategic_views.short_term.stance}</div>
                  <div className="module-node__copy">{data.strategic_views.short_term.rationale}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(data.strategic_views.short_term.focus || []).map((theme) => (
                      <span key={theme} className="module-badge">{theme}</span>
                    ))}
                  </div>
                  {data.strategic_views.short_term.risk_trigger ? (
                    <div className="mt-4 rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                      {data.strategic_views.short_term.risk_trigger}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </ModuleShell>

          <ModuleShell
            code="03"
            eyebrow="News Radar"
            title="先看新闻，再决定主线"
            badge="Primary / Secondary / Risk"
            variant="strategy"
            motion="scan"
          >
            <NewsBriefBoard analysis={data.news_analysis} mode="full" />
          </ModuleShell>

          <ModuleShell
            code="04"
            eyebrow="Mainlines"
            title="今日两条主线"
            badge="A / B"
            variant="strategy"
            motion="scan"
          >
            <div className="module-columns xl:grid-cols-2">
              <LogicPanel title="逻辑 A" logic={data.today_mainlines.logic_a} accent="attack" />
              <LogicPanel title="逻辑 B" logic={data.today_mainlines.logic_b} accent="defense" />
            </div>
          </ModuleShell>

          <ModuleShell
            code="05"
            eyebrow="Stock Pool"
            title="精锐股票池"
            badge="Expanded Pool"
            variant="stockpool"
            motion="drift"
          >
            <div className="module-columns xl:grid-cols-2">
              <StockLane title={data.today_mainlines.logic_a.name} stocks={data.elite_stock_pool.attack} accent="attack" />
              <StockLane title={data.today_mainlines.logic_b.name} stocks={data.elite_stock_pool.defense} accent="defense" />
            </div>
          </ModuleShell>

          <ModuleShell
            code="06"
            eyebrow="Time Window"
            title="关键时间窗军令"
            badge="09:30 → 14:30"
            variant="execution"
            motion="pulse"
          >
            <div className="module-flow-list">
              {data.commander_tips.time_orders.map((order) => (
                <div key={order.time} className="module-flow-step">
                  <strong>{order.time} 前</strong>
                  <span>条件：{order.condition}</span>
                  <span>动作：{order.action}</span>
                </div>
              ))}
            </div>

            {data.commander_tips.risk_flags?.length ? (
              <div className="grid gap-3">
                {data.commander_tips.risk_flags.map((flag) => (
                  <div key={flag} className="rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                    {flag}
                  </div>
                ))}
              </div>
            ) : null}
          </ModuleShell>
        </div>
      ) : null}
    </AppShell>
  );
}
