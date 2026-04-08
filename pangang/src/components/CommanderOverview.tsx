'use client';

import Link from 'next/link';
import ModuleShell from '@/components/ModuleShell';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderDirectionLeg, CommanderStock, CommanderSummary } from '@/types/api';

const COMMANDER_SUMMARY_CACHE_KEY = 'pangang_cache_commander_summary_v4';

type CommanderOverviewProps = {
  summary?: CommanderSummary | null;
  loading?: boolean;
  error?: Error | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  showEvidence?: boolean;
  showStockLanes?: boolean;
  showStrategicViews?: boolean;
};

function tradeStateClass(state?: string) {
  if (state === '真启动') return 'text-[var(--accent-green)]';
  if (state === '拉高出货') return 'text-[var(--accent-red)]';
  return 'text-[var(--accent-gold)]';
}

function directionLabel(type?: string) {
  if (type === 'direct') return '直接受益';
  if (type === 'second_order') return '二阶扩散';
  if (type === 'hedge') return '对冲';
  if (type === 'defensive') return '防守';
  return '方向';
}

function directionTone(direction?: string) {
  if (direction === 'bullish') return 'text-[var(--accent-green)]';
  if (direction === 'bearish') return 'text-[var(--accent-red)]';
  return 'text-[var(--accent-gold)]';
}

function directionValueLabel(direction?: string) {
  if (direction === 'bullish') return '看多';
  if (direction === 'bearish') return '看空';
  return '中性';
}

function formatSnapshotStatus(summary?: CommanderSummary) {
  const meta = summary?.snapshot_meta;
  if (!meta) return null;
  if (meta.state === 'fresh') return '实时摘要';
  if (meta.state === 'stale') return '缓存摘要';
  if (meta.state === 'boot') return '启动快照';
  return '摘要快照';
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
    <div className="module-node module-kpi-card">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
      <div className="module-node__copy">{detail}</div>
    </div>
  );
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

function StrategicViewCard({
  title,
  view,
}: {
  title: string;
  view: NonNullable<CommanderSummary['strategic_views']>['long_term'] | NonNullable<CommanderSummary['strategic_views']>['short_term'];
}) {
  const chips = view.target_assets_or_themes || view.focus || view.themes || [];

  return (
    <div className="module-node">
      <div className="module-node__label">{title}</div>
      <div className="module-node__title">{view.stance}</div>
      <div className="module-node__copy">{view.rationale}</div>
      {view.transmission_summary ? (
        <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">传导摘要</div>
          <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{view.transmission_summary}</div>
        </div>
      ) : null}
      {chips.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((theme) => (
            <span key={`${title}-${theme}`} className="module-badge">{theme}</span>
          ))}
        </div>
      ) : null}
      {view.falsification || view.contrarian_note || view.risk_trigger ? (
        <div className="mt-4 grid gap-3">
          {view.falsification ? (
            <div className="rounded-[18px] border border-[rgba(255,123,136,0.2)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
              证伪：{view.falsification}
            </div>
          ) : null}
          {view.contrarian_note ? (
            <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
              反共识：{view.contrarian_note}
            </div>
          ) : null}
          {view.risk_trigger ? (
            <div className="text-xs leading-6 text-[var(--text-muted)]">风险触发：{view.risk_trigger}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
          <div className="module-node__label">{accent === 'attack' ? '进攻方向' : '防守方向'}</div>
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
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs leading-6 text-[var(--text-secondary)]">
                    <span>{stock.auction_status}</span>
                    <span>· {stock.tactic}</span>
                    {stock.beneficiary_type ? <span>· {directionLabel(stock.beneficiary_type)}</span> : null}
                  </div>
                </div>
                <div className={`shrink-0 text-right ${accentClass}`}>
                  <div className="text-sm font-semibold">{stock.auction_price}</div>
                  {stock.actionability ? (
                    <div className="mt-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">{stock.actionability}</div>
                  ) : null}
                </div>
              </div>
              {stock.execution_note || stock.risk_note || stock.related_event || stock.falsification ? (
                <div className="mt-3 grid gap-2">
                  {stock.related_event ? (
                    <div className="text-xs leading-6 text-[var(--text-muted)]">事件：{stock.related_event}</div>
                  ) : null}
                  {stock.execution_note ? (
                    <div className="text-sm leading-7 text-[var(--text-secondary)]">{stock.execution_note}</div>
                  ) : null}
                  {stock.falsification ? (
                    <div className="text-xs leading-6 text-[var(--text-secondary)]">证伪：{stock.falsification}</div>
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

function CommanderOverviewBody({
  data,
  error,
  isRefreshing,
  onRefresh,
  showEvidence = true,
  showStockLanes = true,
  showStrategicViews = true,
}: {
  data: CommanderSummary;
  error: Error | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  showEvidence?: boolean;
  showStockLanes?: boolean;
  showStrategicViews?: boolean;
}) {
  const attackName = data.mainlines.logic_a?.name || '无';
  const defenseName = data.mainlines.logic_b?.name || '无';
  const attackStocks = data.recommended_stocks?.attack || [];
  const defenseStocks = data.recommended_stocks?.defense || [];
  const transmissionChain = data.news_analysis?.transmission_chain || data.news_analysis?.event_path || [];
  const directionMap = data.news_analysis?.direction_map || [];
  const falsifiers = data.news_analysis?.falsifiers || data.trade_filter?.falsifiers || [];
  const eventDriver = data.news_analysis?.event_driver || data.news_analysis?.lead_event;

  return (
    <ModuleShell
      title="今日结论"
      badge={`${data.weather.icon} ${data.weather.weather}`}
      variant="briefing"
      motion="pulse"
      compact
      actions={(
        <>
          <Link href="/commander" className="btn btn-primary px-4 py-2 text-sm">
            去作战
          </Link>
          <Link href="/review" className="btn btn-secondary px-4 py-2 text-sm">
            去复盘
          </Link>
          <button type="button" onClick={onRefresh} className="btn btn-secondary px-4 py-2 text-sm">
            {isRefreshing ? '刷新中...' : '刷新结论'}
          </button>
        </>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="module-node">
          <div className="module-node__label">今日判断</div>
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
          {showEvidence && (eventDriver || data.news_analysis?.market_implication) ? (
            <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">事件结论</div>
              <div className="mt-2 text-sm leading-7 text-[var(--text-primary)]">
                {eventDriver || '当前暂无明确主事件。'}
              </div>
              {data.news_analysis?.market_implication ? (
                <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                  {data.news_analysis.market_implication}
                </div>
              ) : null}
            </div>
          ) : null}
          {showEvidence && transmissionChain.length ? (
            <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">传导链</div>
              <div className="mt-3 module-flow-list">
                {transmissionChain.slice(0, 4).map((step) => (
                  <div key={step} className="module-flow-step">
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {showEvidence && directionMap.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {directionMap.slice(0, 4).map((item) => (
                <DirectionCard key={`${item.label}-${item.direction}-${item.beneficiary_type || 'lane'}`} item={item} />
              ))}
            </div>
          ) : null}
          {showEvidence && falsifiers.length ? (
            <div className="mt-4 rounded-[18px] border border-[rgba(255,123,136,0.2)] bg-[var(--accent-red-dim)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent-red)]">证伪条件</div>
              <div className="mt-3 grid gap-2">
                {falsifiers.slice(0, 3).map((item) => (
                  <div key={item} className="text-sm leading-7 text-[var(--text-secondary)]">{item}</div>
                ))}
              </div>
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
        </div>

        <div className="module-kpi-stack">
          <BriefMetric
            label="阶段"
            value={data.phase_label || '盘中阶段'}
            detail={data.action_now || '沿着主线和仓位执行。'}
          />
          <div className="module-kpi-grid module-kpi-grid--relaxed">
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
      </div>

      {showStockLanes ? (
        <div className="module-columns xl:grid-cols-2">
          <StockLane title={attackName} accent="attack" stocks={attackStocks} />
          <StockLane title={defenseName} accent="defense" stocks={defenseStocks} />
        </div>
      ) : null}

      {showStrategicViews && data.strategic_views ? (
        <div className="module-columns xl:grid-cols-2">
          <StrategicViewCard title="中长期看法" view={data.strategic_views.long_term} />
          <StrategicViewCard title="短线看法" view={data.strategic_views.short_term} />
        </div>
      ) : null}

      {data.learning_feedback?.summary ? (
        <div className="module-node">
          <div className="module-node__label">复盘纠偏</div>
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

export default function CommanderOverview(props: CommanderOverviewProps) {
  const controlled = Object.prototype.hasOwnProperty.call(props, 'summary');
  const fetched = useFetch<CommanderSummary>(
    () => commanderApi.getSummary(),
    { interval: 60000, cacheKey: COMMANDER_SUMMARY_CACHE_KEY, enabled: !controlled }
  );

  const data = controlled ? props.summary ?? null : fetched.data;
  const loading = controlled ? props.loading ?? false : fetched.loading;
  const error = controlled ? props.error ?? null : fetched.error;
  const isRefreshing = controlled ? props.isRefreshing ?? false : fetched.isRefreshing;
  const onRefresh = controlled
    ? props.onRefresh || (() => undefined)
    : () => {
        void fetched.refetch();
      };
  const showEvidence = props.showEvidence ?? true;
  const showStockLanes = props.showStockLanes ?? true;
  const showStrategicViews = props.showStrategicViews ?? true;

  if (loading && !data) {
    return (
      <ModuleShell
        title="正在整理今日结论"
        badge="处理中"
        variant="briefing"
        motion="pulse"
      >
        <div className="module-node">
          <div className="module-node__label">处理中</div>
          <div className="module-node__title">正在生成今日结论...</div>
          <div className="module-node__copy">当前会优先读取快照，再在后台刷新主线与股票池。</div>
        </div>
      </ModuleShell>
    );
  }

  if (!data) {
    return (
      <ModuleShell
        title="今日总控台暂时不可用"
        badge="加载失败"
        variant="briefing"
        motion="pulse"
      >
        <div className="module-node">
          <div className="module-node__label">加载失败</div>
          <div className="module-node__title">摘要加载失败</div>
          <div className="module-node__copy">{error ? error.message : '当前还没有拿到今日摘要。'}</div>
        </div>
      </ModuleShell>
    );
  }

  return (
    <CommanderOverviewBody
      data={data}
      error={error}
      isRefreshing={isRefreshing}
      onRefresh={onRefresh}
      showEvidence={showEvidence}
      showStockLanes={showStockLanes}
      showStrategicViews={showStrategicViews}
    />
  );
}
