'use client';

import AppShell from '@/components/AppShell';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderLogic, CommanderOrder, CommanderStock } from '@/types/api';

function CompactPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-panel animate-stage p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
        {badge ? <div className="metric-chip"><strong>{badge}</strong></div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="data-tile">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{detail}</div>
    </div>
  );
}

function LogicCard({
  label,
  logic,
  tone,
}: {
  label: string;
  logic: CommanderLogic;
  tone: 'attack' | 'defense';
}) {
  const accentClass = tone === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';
  const badgeClass = tone === 'attack' ? 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]' : 'bg-[var(--accent-gold-dim)] text-[var(--accent-gold)]';

  return (
    <div className="rounded-[24px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{label}</div>
        <div className="text-xs text-[var(--text-secondary)]">有效期 {logic.validity}</div>
      </div>

      <div className={`mt-3 text-xl font-semibold tracking-[-0.03em] ${accentClass}`}>{logic.name}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{logic.reason}</div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(8,20,30,0.76)] px-4 py-3">
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

function StockRows({
  title,
  stocks,
  tone,
}: {
  title: string;
  stocks: CommanderStock[];
  tone: 'attack' | 'defense';
}) {
  const accentClass = tone === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';

  return (
    <div className="rounded-[24px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-4 space-y-3">
        {stocks.map((stock) => (
          <div key={`${title}-${stock.code}`} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(8,20,30,0.78)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  <span className={`mr-2 ${accentClass}`}>{stock.priority}</span>
                  {stock.stock}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{stock.code} · {stock.auction_status}</div>
              </div>
              <div className={`shrink-0 text-xs font-medium ${accentClass}`}>{stock.auction_price}</div>
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{stock.tactic}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommanderPage() {
  const { data, loading, error, refetch, isRefreshing } = useFetch<CommanderOrder>(
    () => commanderApi.getOrder(),
    { interval: 60000, cacheKey: 'pangang_cache_commander_order_v1' }
  );

  return (
    <AppShell
      title="作战室"
      subtitle="只保留执行要点：天气、主线、股票池和时间窗军令。"
      badge="Execution Deck"
      maxWidthClassName="max-w-6xl"
      actions={(
        <button onClick={() => void refetch()} className="btn btn-secondary px-4 py-2 text-sm">
          {isRefreshing ? '更新中...' : '刷新'}
        </button>
      )}
    >
      {loading ? (
        <section className="surface-panel animate-stage p-5">
          <div className="flex min-h-[180px] items-center justify-center text-sm text-[var(--text-secondary)]">
            正在生成作战计划...
          </div>
        </section>
      ) : null}

      {!loading && error && !data ? (
        <section className="surface-panel animate-stage border-[rgba(255,123,136,0.24)] p-5">
          <div className="text-lg font-semibold text-[var(--text-primary)]">作战计划暂时不可用</div>
          <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{error.message}</div>
        </section>
      ) : null}

      {data ? (
        <div className="grid gap-5">
          <CompactPanel title="当前作战状态" badge={`${data.battle_weather.icon} ${data.battle_weather.weather}`}>
            <div className="rounded-[26px] border border-[rgba(246,199,125,0.18)] bg-[linear-gradient(135deg,rgba(246,199,125,0.12),rgba(141,220,255,0.08))] p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">现在做什么</div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                {data.context.action_now || data.commander_tips.action_now || '等待下一条军令'}
              </div>
              <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{data.commander_tips.focus}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="metric-chip"><strong>{data.context.label}</strong></span>
                <span className="metric-chip"><strong>市场时钟 {data.context.market_clock}</strong></span>
                <span className="metric-chip"><strong>{data.commander_tips.position_text}</strong></span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Metric label="天气" value={data.battle_weather.weather} detail={data.battle_weather.auction_sentiment || data.battle_weather.description} />
              <Metric label="昨日" value={data.yesterday_review.status} detail={data.yesterday_review.summary} />
              <Metric label="进攻" value={data.today_mainlines.logic_a.name} detail={data.today_mainlines.logic_a.reason} />
              <Metric label="防守" value={data.today_mainlines.logic_b.name} detail={data.today_mainlines.logic_b.reason} />
            </div>

            {error ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm text-[var(--accent-red)]">
                后台刚刚刷新失败，当前先保留最近一次成功结果。
              </div>
            ) : null}
          </CompactPanel>

          <div className="grid gap-5 xl:grid-cols-2">
            <CompactPanel title="今日双主线">
              <div className="grid gap-4">
                <LogicCard label="逻辑 A / 进攻" logic={data.today_mainlines.logic_a} tone="attack" />
                <LogicCard label="逻辑 B / 防守" logic={data.today_mainlines.logic_b} tone="defense" />
              </div>
            </CompactPanel>

            <CompactPanel title="时间窗军令" badge={data.commander_tips.position_text}>
              <div className="grid gap-3">
                {data.commander_tips.time_orders.map((order) => (
                  <div key={order.time} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{order.time} 前</div>
                    <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">若 {order.condition}</div>
                    <div className="mt-2 text-sm font-medium text-[var(--accent-green)]">{order.action}</div>
                  </div>
                ))}

                {data.commander_tips.risk_flags?.length ? (
                  <div className="grid gap-3 pt-1">
                    {data.commander_tips.risk_flags.map((flag) => (
                      <div key={flag} className="rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                        {flag}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </CompactPanel>
          </div>

          <CompactPanel title="精锐股票池">
            <div className="grid gap-4 xl:grid-cols-2">
              <StockRows title={`进攻方向 · ${data.today_mainlines.logic_a.name}`} stocks={data.elite_stock_pool.attack} tone="attack" />
              <StockRows title={`防守方向 · ${data.today_mainlines.logic_b.name}`} stocks={data.elite_stock_pool.defense} tone="defense" />
            </div>
          </CompactPanel>
        </div>
      ) : null}
    </AppShell>
  );
}
