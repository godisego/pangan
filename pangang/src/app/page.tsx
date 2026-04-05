'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import CommanderOverview from '@/components/CommanderOverview';
import ModuleShell from '@/components/ModuleShell';
import MacroStrategyDashboard from '@/components/MacroStrategyCard';
import NewsBriefBoard from '@/components/NewsBriefBoard';
import { useFetch } from '@/hooks/useFetch';
import { btcApi, commanderApi, stockApi } from '@/lib/api';
import { StatusTag } from '@/components/ui/StatusTag';
import { REFRESH_INTERVALS } from '@/utils/constants';
import { formatNumber, formatPercent } from '@/utils/formatters';
import type { BtcSummary, CommanderSummary, StockMarket } from '@/types/api';

const MARKET_CACHE_KEY = 'pangang_cache_market_v2';
const BTC_CACHE_KEY = 'pangang_cache_btc_v2';

function readCachedJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCachedJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache write failure.
  }
}

function SmallBoard({
  step,
  title,
  badge,
  children,
}: {
  step?: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {step ? <div className="module-node__label">{step}</div> : null}
          <div className="module-node__title">{title}</div>
        </div>
        {badge ? <div className="module-badge">{badge}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function getMarketAnswer(data: StockMarket) {
  if (data.statsUnavailable) {
    return '当前只拿到了基础指数快照，统计项暂未就绪。';
  }
  if (data.canOperate && data.breadth >= 55) {
    return '市场可操作，允许围绕主线试错。';
  }
  if (data.canOperate) {
    return '市场可做，但需要聚焦核心，不宜过度分散。';
  }
  return '市场偏保守，先等更清晰的确认信号。';
}

function getMarketSourceLabel(data: StockMarket) {
  if (data.statsSource === 'TushareFetcher') {
    return 'Tushare 增强源';
  }
  if (data.statsSource === 'SinaFetcher') {
    return '新浪公开源';
  }
  if (data.statsSource === 'AKShareFetcher') {
    return 'AKShare 公开源';
  }
  if (data.statsSource === 'market_indices_snapshot' || data.statsSource === 'local_snapshot') {
    return '本地快照';
  }
  return '免费公开源';
}

function MarketEnvironment() {
  const [data, setData] = useState<StockMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrateTimer = window.setTimeout(() => {
      const cached = readCachedJson<StockMarket>(MARKET_CACHE_KEY);
      if (cached && !cancelled) {
        setData(cached);
        setLoading(false);
      }
    }, 0);

    const run = async () => {
      try {
        const json = await stockApi.getMarket();
        if (cancelled) return;
        setData(json);
        writeCachedJson(MARKET_CACHE_KEY, json);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err as Error);
        setLoading(false);
      }
    };

    const initialTimer = window.setTimeout(() => {
      void run();
    }, 0);
    const interval = window.setInterval(() => {
      void run();
    }, REFRESH_INTERVALS.STOCK_MARKET);

    return () => {
      cancelled = true;
      window.clearTimeout(hydrateTimer);
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <SmallBoard step="A" title="市场能不能做">
        <div className="text-sm text-[var(--text-secondary)]">正在载入 A 股数据...</div>
      </SmallBoard>
    );
  }

  if (!data) {
    return (
      <SmallBoard step="A" title="市场能不能做">
        <div className="text-sm text-[var(--text-secondary)]">A 股数据暂时不可用。</div>
      </SmallBoard>
    );
  }

  return (
    <SmallBoard
      step="A"
      title="市场能不能做"
      badge={data.statsUnavailable ? '基础快照' : data.canOperate ? '可操作' : '先保守'}
    >
      <div className="mb-4 text-sm leading-7 text-[var(--text-secondary)]">{getMarketAnswer(data)}</div>
      {data.providerHint ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
            {getMarketSourceLabel(data)}
          </span>
          <span>{data.providerHint}</span>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="data-tile">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Index</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{formatNumber(data.index.value)}</div>
              <div className={`mt-1 text-sm ${data.index.change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                {data.index.name} {formatPercent(data.index.change)}
              </div>
            </div>
            <StatusTag status={data.status as string} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="data-tile">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Breadth</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.statsUnavailable ? '--' : `${data.breadth}%`}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.statsUnavailable ? '统计未就绪' : '红盘率'}</div>
          </div>
          <div className="data-tile">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Limit Up</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.statsUnavailable ? '--' : `${data.limitUp} 家`}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.statsUnavailable ? '统计未就绪' : '封板强度'}</div>
          </div>
          <div className="data-tile">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Capital Flow</div>
            <div className={`mt-2 text-lg font-semibold ${(data.capitalFlow?.net ?? data.northFlow) >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
              {data.statsUnavailable ? '--' : `${(data.capitalFlow?.net ?? data.northFlow) >= 0 ? '+' : ''}${data.capitalFlow?.net ?? data.northFlow} 亿`}
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {data.statsUnavailable ? '统计未就绪' : data.capitalFlow?.focus || (data.canOperate ? '适合操作' : '先保守')}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{data.summary || '当前市场摘要暂无补充说明。'}</div>
      {data.statsAsOf ? (
        <div className="mt-2 text-[11px] tracking-[0.14em] text-[var(--text-muted)]">
          STATS AS OF {data.statsAsOf}
        </div>
      ) : null}
      {error ? <div className="mt-3 text-xs text-orange-300">后台刷新失败，当前保留最近一次成功结果。</div> : null}
    </SmallBoard>
  );
}

function getBtcAnswer(data: BtcSummary) {
  if (data.unavailable) {
    return 'BTC 实时行情暂不可用，当前只保留降级快照。';
  }
  if (data.stale) {
    return '当前为降级快照，只把 BTC 当成风险偏好参考，不拿它直接下结论。';
  }
  if (data.change24h >= 2 && data.fearGreed >= 60) {
    return '风险偏好偏扩张，市场更容易接受进攻型题材。';
  }
  if (data.change24h <= -2 || data.fearGreed <= 40) {
    return '风险偏好偏收缩，更适合防守和等待确认。';
  }
  return '风险偏好中性，BTC 只作为辅助参考，不喧宾夺主。';
}

function BtcCard() {
  const [data, setData] = useState<BtcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrateTimer = window.setTimeout(() => {
      const cached = readCachedJson<BtcSummary>(BTC_CACHE_KEY);
      if (cached && !cancelled) {
        setData(cached);
        setLoading(false);
      }
    }, 0);

    const run = async () => {
      try {
        const json = await btcApi.getSummary();
        if (cancelled) return;
        setData(json);
        writeCachedJson(BTC_CACHE_KEY, json);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err as Error);
        setLoading(false);
      }
    };

    const initialTimer = window.setTimeout(() => {
      void run();
    }, 0);
    const interval = window.setInterval(() => {
      void run();
    }, REFRESH_INTERVALS.BTC_SUMMARY);

    return () => {
      cancelled = true;
      window.clearTimeout(hydrateTimer);
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <SmallBoard step="B" title="BTC 风险偏好">
        <div className="text-sm text-[var(--text-secondary)]">正在载入 BTC 数据...</div>
      </SmallBoard>
    );
  }

  if (!data) {
    return (
      <SmallBoard step="B" title="BTC 风险偏好">
        <div className="text-sm text-[var(--text-secondary)]">BTC 数据暂时不可用。</div>
      </SmallBoard>
    );
  }

  return (
    <SmallBoard
      step="B"
      title="BTC 风险偏好"
      badge={data.unavailable ? '数据不可用' : data.stale ? '降级快照' : '实时摘要'}
    >
      <div className="mb-4 text-sm leading-7 text-[var(--text-secondary)]">{getBtcAnswer(data)}</div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
          {data.source || '未标注来源'}
        </span>
        {data.updatedAt ? (
          <span>更新于 {data.updatedAt.replace('T', ' ').slice(0, 19)}</span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="data-tile">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Price</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            {data.unavailable || data.price <= 0 ? '--' : `$${formatNumber(data.price)}`}
          </div>
          <div className={`mt-1 text-sm ${data.change24h >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {data.unavailable ? '数据未就绪' : `24H ${formatPercent(data.change24h)}`}
          </div>
        </div>
        <div className="data-tile">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Fear & Greed</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.unavailable ? '--' : data.fearGreed}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.unavailable ? '数据未就绪' : data.fearGreedLabel}</div>
        </div>
        <div className="data-tile">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Mode</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.unavailable ? '数据不可用' : data.stale ? '降级快照' : '实时摘要'}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.strategy?.summary || '当前暂无策略摘要'}</div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Link href="/btc" className="btn btn-secondary px-4 py-2 text-sm">
          查看 BTC 详情
        </Link>
      </div>
      {error ? <div className="mt-3 text-xs text-orange-300">后台刷新失败，当前保留最近一次成功结果。</div> : null}
    </SmallBoard>
  );
}

function TodayNewsModule() {
  const { data, loading } = useFetch<CommanderSummary>(
    () => commanderApi.getSummary(),
    { interval: 60000, cacheKey: 'pangang_cache_commander_summary_v4' }
  );

  return (
    <ModuleShell
      code="02"
      eyebrow="News Brief"
      title="先把今天最重要的新闻收入眼底"
      badge="主新闻 / 次新闻 / 风险项"
      variant="strategy"
      motion="scan"
    >
      {loading && !data ? (
        <div className="module-node">
          <div className="module-node__label">Loading</div>
          <div className="module-node__title">正在整理新闻简报...</div>
          <div className="module-node__copy">会先返回主新闻，再补次新闻、风险项和今日看点。</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.snapshot_meta ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
                {data.snapshot_meta.state === 'fresh'
                  ? '实时新闻摘要'
                  : data.snapshot_meta.state === 'stale'
                    ? '缓存新闻摘要'
                    : '启动快照'}
              </span>
              {data.snapshot_meta.updated_at ? (
                <span>更新于 {data.snapshot_meta.updated_at.replace('T', ' ').slice(0, 19)}</span>
              ) : null}
            </div>
          ) : null}
          <NewsBriefBoard analysis={data?.news_analysis} />
        </div>
      )}
    </ModuleShell>
  );
}

export default function Home() {
  const [currentTime, setCurrentTime] = useState('');
  const [showMacro, setShowMacro] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = window.setInterval(updateTime, 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <AppShell
      title="今日总览"
      subtitle="先看结论，再看证据。"
      badge="新闻驱动趋势判断"
      maxWidthClassName="max-w-6xl"
      actions={(
        <div className="metric-chip">
          <strong>{currentTime || '--:--'}</strong>
        </div>
      )}
    >
      <CommanderOverview />

      <TodayNewsModule />

      <ModuleShell
        code="03"
        eyebrow="Market Evidence"
        title="先看市场，再看风险偏好，最后决定要不要深读宏观"
        badge={showMacro ? '宏观已展开' : '摘要模式'}
        variant="evidence"
        motion="scan"
        actions={(
          <button
            type="button"
            onClick={() => setShowMacro((prev) => !prev)}
            className={showMacro ? 'btn btn-primary px-4 py-2 text-sm' : 'btn btn-secondary px-4 py-2 text-sm'}
          >
            {showMacro ? '收起宏观解释' : '展开宏观解释'}
          </button>
        )}
      >
        <div className="module-columns xl:grid-cols-2">
          <MarketEnvironment />
          <BtcCard />
        </div>

      </ModuleShell>

      {showMacro ? (
        <ModuleShell
          code="04"
          eyebrow="Macro AI"
          title="把今天的新闻放进更大的周期框架里"
          badge="News + Cycle"
          variant="macro"
          motion="orbit"
          actions={(
            <button type="button" onClick={() => setShowMacro(false)} className="btn btn-secondary px-4 py-2 text-sm">
              收起
            </button>
          )}
        >
          <MacroStrategyDashboard />
        </ModuleShell>
      ) : null}
    </AppShell>
  );
}
