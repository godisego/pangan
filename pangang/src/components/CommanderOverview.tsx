'use client';

import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderStock, CommanderSummary } from '@/types/api';

function MiniMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="data-tile">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{hint}</div>
    </div>
  );
}

function StockLane({
  title,
  stocks,
  tone,
}: {
  title: string;
  stocks: CommanderStock[];
  tone: 'attack' | 'defense';
}) {
  const accentClass = tone === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';
  const badgeClass = tone === 'attack' ? 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]' : 'bg-[var(--accent-gold-dim)] text-[var(--accent-gold)]';

  return (
    <div className="rounded-[24px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{tone === 'attack' ? '进攻' : '防守'}</div>
      </div>

      <div className="mt-4 space-y-3">
        {stocks.length ? (
          stocks.map((stock) => (
            <div key={`${title}-${stock.code}`} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(8,20,30,0.76)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    <span className={`mr-2 ${accentClass}`}>{stock.priority}</span>
                    {stock.stock}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{stock.code}</div>
                </div>
                <div className={`shrink-0 text-xs font-medium ${accentClass}`}>{stock.auction_price}</div>
              </div>
              <div className="mt-2 line-clamp-1 text-xs text-[var(--text-secondary)]">{stock.auction_status}</div>
              <div className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{stock.tactic}</div>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-dashed border-[var(--border-color)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            暂无推荐股票
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommanderOverview() {
  const { data, loading, error, isRefreshing, refetch } = useFetch<CommanderSummary>(
    () => commanderApi.getSummary(),
    { interval: 60000, cacheKey: 'pangang_cache_commander_summary_v1' }
  );

  if (loading) {
    return (
      <section className="surface-panel animate-stage">
        <div className="flex min-h-[180px] items-center justify-center text-sm text-[var(--text-secondary)]">
          正在生成今日结论...
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="surface-panel animate-stage border-[rgba(255,123,136,0.24)] p-5">
        <div className="text-sm font-semibold text-[var(--text-primary)]">总控台暂时不可用</div>
        <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
          {error ? `摘要加载失败：${error.message}` : '当前还没有拿到今日摘要。'}
        </div>
      </section>
    );
  }

  const attackName = data.mainlines.logic_a?.name || '无';
  const defenseName = data.mainlines.logic_b?.name || '无';
  const attackStocks = data.recommended_stocks?.attack || [];
  const defenseStocks = data.recommended_stocks?.defense || [];

  return (
    <section className="surface-panel animate-stage overflow-hidden p-5">
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-kicker">Today Briefing</span>
              <span className="metric-chip"><strong>{data.weather.icon} {data.weather.weather}</strong></span>
              <span className="metric-chip"><strong>{data.phase_label || '盘中阶段'}</strong></span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isRefreshing ? <span className="metric-chip">更新中</span> : null}
              <button onClick={() => void refetch()} className="btn btn-secondary px-4 py-2 text-xs">
                刷新
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-[rgba(141,220,255,0.18)] bg-[linear-gradient(135deg,rgba(141,220,255,0.1),rgba(246,199,125,0.06))] p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">今日结论</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              进攻看 <span className="text-[var(--accent-green)]">{attackName}</span>
              ，防守看 <span className="text-[var(--accent-gold)]">{defenseName}</span>
            </div>
            <div className="mt-3 text-base leading-8 text-[var(--text-secondary)]">
              {data.action_now || data.focus || data.mainlines.summary}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="metric-chip"><strong>{data.position_text}</strong></span>
              <span className="metric-chip"><strong>{data.review?.status || '暂无昨日记录'}</strong></span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <MiniMetric
              label="市场"
              value={`${data.weather.icon} ${data.weather.weather}`}
              hint={data.weather.auction_sentiment || data.weather.description}
            />
            <MiniMetric
              label="动作"
              value={data.phase_label || '盘中阶段'}
              hint={data.action_now || '按主线强弱执行，不做无计划切换。'}
            />
            <MiniMetric
              label="仓位"
              value={data.position_text}
              hint={`进攻 ${data.position.attack}% / 防守 ${data.position.defense}% / 现金 ${data.position.cash}%`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="control-strip md:col-span-3">
              <div className="control-strip-label">操作入口</div>
              <div className="control-strip-grid">
                <Link href="/commander" className="action-card compact">
                  <div className="action-label">立即执行</div>
                  <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">去作战室</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">查看时间窗军令、双主线和完整股票池。</div>
                </Link>
                <Link href="/review" className="action-card compact">
                  <div className="action-label">验证结果</div>
                  <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">去复盘室</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">回看昨日逻辑，确认哪些判断已经兑现。</div>
                </Link>
                <Link href="/settings" className="action-card compact">
                  <div className="action-label">配置中心</div>
                  <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">去设置</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">管理 AI、通知通道和推送偏好。</div>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <MiniMetric
              label="原因"
              value={attackName}
              hint={data.mainlines.logic_a?.reason || '暂无说明'}
            />
            <MiniMetric
              label="昨日"
              value={data.review?.status || '暂无记录'}
              hint={data.review?.summary || '今天开始累计记录。'}
            />
            <MiniMetric
              label="数据"
              value={data.weather.stale ? '降级快照' : '实时摘要'}
              hint="竞价抓不到时保留结论，不让首页整块失效。"
            />
          </div>

          {error ? (
            <div className="rounded-[20px] border border-[rgba(255,123,136,0.28)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm text-[var(--accent-red)]">
              当前展示的是最近一次成功结果，后台刷新刚刚失败：{error.message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          <StockLane title={`进攻方向 · ${attackName}`} stocks={attackStocks} tone="attack" />
          <StockLane title={`防守方向 · ${defenseName}`} stocks={defenseStocks} tone="defense" />
        </div>
      </div>
    </section>
  );
}
