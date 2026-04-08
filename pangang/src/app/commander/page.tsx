'use client';

import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';
import NewsBriefBoard from '@/components/NewsBriefBoard';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderLogic, CommanderStock, CommanderSummary } from '@/types/api';

function tradeStateClass(state?: string) {
  if (state === '真启动') return 'text-[var(--accent-green)]';
  if (state === '拉高出货') return 'text-[var(--accent-red)]';
  return 'text-[var(--accent-gold)]';
}

function formatSnapshotStatus(summary?: CommanderSummary) {
  const meta = summary?.snapshot_meta;
  if (!meta) return null;
  if (meta.state === 'fresh') return '实时作战卡';
  if (meta.state === 'stale') return '缓存作战卡';
  if (meta.state === 'boot') return '启动快照';
  return '作战快照';
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
  logic?: CommanderLogic;
  accent: 'attack' | 'defense';
}) {
  const accentClass = accent === 'attack' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]';

  return (
    <div className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="module-node__label">{title}</div>
          <div className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${accentClass}`}>
            {logic?.name || '待定'}
          </div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentClass}`}>
          {accent === 'attack' ? '进攻' : '防守'}
        </div>
      </div>
      <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
        {logic?.reason || '当前还没有足够清晰的主线说明。'}
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">验证点</div>
          <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
            {logic?.verify_point || '等待量能与前排强度确认。'}
          </div>
        </div>
        <div className="rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">证伪信号</div>
          <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
            {logic?.fake_signal || '若冲高回落且成交不足，先撤。'}
          </div>
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
          <div className="module-node__label">{accent === 'attack' ? '进攻池' : '防守池'}</div>
          <div className="module-node__title">{title}</div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentClass}`}>
          {accent === 'attack' ? '进攻池' : '防守池'}
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

export default function CommanderPage() {
  const { data, loading, error, refetch, isRefreshing } = useFetch<CommanderSummary>(
    () => commanderApi.getSummary(),
    { interval: 60000, cacheKey: 'pangang_cache_commander_summary_v4' }
  );

  return (
    <AppShell
      title="作战"
      subtitle="先看今天怎么做，再看重点消息、主线和候选池。"
      badge="今日执行参考"
      maxWidthClassName="max-w-6xl"
      actions={(
        <button onClick={() => void refetch()} className="btn btn-secondary px-4 py-2 text-sm">
          {isRefreshing ? '更新中...' : '刷新'}
        </button>
      )}
    >
      {loading ? (
        <ModuleShell
          title="正在生成今日作战"
          badge="处理中"
          variant="execution"
          motion="track"
        >
          <div className="module-node">
            <div className="module-node__label">处理中</div>
            <div className="module-node__title">正在整理轻量作战摘要...</div>
            <div className="module-node__copy">当前会优先读取快照，再在后台刷新主线与股票池。</div>
          </div>
        </ModuleShell>
      ) : null}

      {!loading && error && !data ? (
        <ModuleShell
          title="作战计划暂时不可用"
          badge="加载失败"
          variant="execution"
          motion="track"
        >
          <div className="module-node">
            <div className="module-node__label">加载失败</div>
            <div className="module-node__title">作战链路暂时失败</div>
            <div className="module-node__copy">{error.message}</div>
          </div>
        </ModuleShell>
      ) : null}

      {data ? (
        <div className="grid gap-4">
          <ModuleShell
            title="当前怎么做"
            badge={`${data.weather.icon} ${data.weather.weather}`}
            variant="execution"
            motion="track"
            compact
          >
            <div className="module-kpi-grid">
              <StatusCard label="阶段" value={data.phase_label || '待判定'} detail={data.current_phase || '等待盘面确认'} />
              <StatusCard label="当前动作" value={data.action_now || '等待军令'} detail={data.focus || data.mainlines.summary || '暂无额外执行说明'} />
              <StatusCard
                label="仓位"
                value={data.position_text || '控制仓位'}
                detail={`进攻 ${data.position?.attack ?? 0}% / 防守 ${data.position?.defense ?? 0}% / 现金 ${data.position?.cash ?? 0}%`}
              />
              <StatusCard
                label="昨日验证"
                value={data.review.status || '暂无复盘'}
                detail={data.review.summary || '暂无昨日验证摘要'}
              />
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

            {data.review.diagnosis ? (
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">昨日复盘纠偏</div>
                <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                  {data.review.diagnosis.label}
                </div>
                <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                  {data.review.diagnosis.reason}
                </div>
                {data.review.diagnosis.failed_link || data.review.diagnosis.next_action ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {data.review.diagnosis.failed_link ? (
                      <div className="text-xs leading-6 text-[var(--accent-red)]">
                        失效环节：{data.review.diagnosis.failed_link}
                      </div>
                    ) : null}
                    {data.review.diagnosis.next_action ? (
                      <div className="text-xs leading-6 text-[var(--accent-green)]">
                        下次动作：{data.review.diagnosis.next_action}
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
            title="重点消息"
            badge="先看主事件"
            variant="strategy"
            motion="scan"
            compact
          >
            <NewsBriefBoard analysis={data.news_analysis} mode="compact" />
          </ModuleShell>

          <ModuleShell
            title="今日主线"
            badge="进攻 / 防守"
            variant="strategy"
            motion="scan"
            compact
          >
            <div className="module-columns xl:grid-cols-2">
              <LogicPanel title="逻辑 A" logic={data.mainlines.logic_a} accent="attack" />
              <LogicPanel title="逻辑 B" logic={data.mainlines.logic_b} accent="defense" />
            </div>
          </ModuleShell>

          <ModuleShell
            title="市场过滤"
            badge={data.trade_filter?.state || (data.factor_engine ? `${data.factor_engine.stage} · ${data.factor_engine.score}分` : '待判定')}
            variant="strategy"
            motion="pulse"
            compact
          >
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="module-node">
                  <div className="module-node__label">阶段</div>
                  <div className="module-node__title">{data.factor_engine?.stage || '回暖'}</div>
                  <div className="module-node__copy">{data.factor_engine?.note || '当前先按回暖阶段处理。'}</div>
                </div>

                <div className="module-node">
                  <div className="module-node__label">执行状态</div>
                  <div className={`module-node__title ${tradeStateClass(data.trade_filter?.state)}`}>
                    {data.trade_filter?.state || '仅观察'}
                  </div>
                  <div className="module-node__copy">{data.trade_filter?.reason || '等待更多市场确认信号。'}</div>
                  {data.trade_filter?.guidance ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                      {data.trade_filter.guidance}
                    </div>
                  ) : null}
                  {(data.trade_filter?.evidence || []).length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {data.trade_filter?.evidence?.slice(0, 4).map((item) => (
                        <span key={item} className="module-badge">{item}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {(data.factor_engine?.factors || []).length ? (
                <div className="grid gap-3">
                  {data.factor_engine?.factors?.map((factor) => (
                    <div key={factor.name} className="scan-row">
                      <div className="scan-row-copy">
                        <strong>{factor.name}</strong>
                        <span>{factor.detail}</span>
                      </div>
                      <div className="scan-row-value">{factor.score}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {(data.factor_engine?.signals || []).length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {data.factor_engine?.signals?.map((signal) => (
                  <div key={signal.name} className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                    <div className="text-[11px] tracking-[0.14em] text-[var(--text-muted)]">{signal.name}</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{signal.verdict}</div>
                    <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{signal.value}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </ModuleShell>

          {data.strategic_views ? (
            <ModuleShell
              title="长短线参考"
              badge="按需看"
              variant="strategy"
              motion="drift"
              compact
            >
              <div className="module-columns xl:grid-cols-2">
                <div className="module-node">
                  <div className="module-node__label">长线</div>
                  <div className="module-node__title">{data.strategic_views.long_term.stance}</div>
                  <div className="module-node__copy">{data.strategic_views.long_term.rationale}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(data.strategic_views.long_term.themes || []).map((theme) => (
                      <span key={theme} className="module-badge">{theme}</span>
                    ))}
                  </div>
                </div>
                <div className="module-node">
                  <div className="module-node__label">短线</div>
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
            </ModuleShell>
          ) : null}

          <ModuleShell
            title="候选池"
            badge="今天重点关注"
            variant="stockpool"
            motion="drift"
            compact
          >
            <div className="module-columns xl:grid-cols-2">
              <StockLane title={data.mainlines.logic_a?.name || '逻辑 A'} stocks={data.recommended_stocks.attack || []} accent="attack" />
              <StockLane title={data.mainlines.logic_b?.name || '逻辑 B'} stocks={data.recommended_stocks.defense || []} accent="defense" />
            </div>
          </ModuleShell>
        </div>
      ) : null}
    </AppShell>
  );
}
