'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import CommanderOverview from '@/components/CommanderOverview';
import MacroStrategyDashboard from '../components/MacroStrategyCard';
import { btcApi, stockApi } from '@/lib/api';
import { StatusTag } from '@/components/ui/StatusTag';
import { REFRESH_INTERVALS } from '@/utils/constants';
import { formatNumber, formatPercent } from '@/utils/formatters';
import type { BtcSummary, StockMarket } from '@/types/api';

const MARKET_CACHE_KEY = 'pangang_cache_market_v1';
const BTC_CACHE_KEY = 'pangang_cache_btc_v1';

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
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-panel animate-stage p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
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
      <SmallBoard title="A 股快照">
        <div className="text-sm text-[var(--text-secondary)]">正在载入 A 股数据...</div>
      </SmallBoard>
    );
  }

  if (!data) {
    return (
      <SmallBoard title="A 股快照">
        <div className="text-sm text-[var(--text-secondary)]">A 股数据暂时不可用。</div>
      </SmallBoard>
    );
  }

  return (
    <SmallBoard title="A 股快照">
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
            <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.breadth}%</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">红盘率</div>
          </div>
          <div className="data-tile">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Limit Up</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.limitUp} 家</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">封板强度</div>
          </div>
          <div className="data-tile">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Northbound</div>
            <div className={`mt-2 text-lg font-semibold ${data.northFlow >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
              {data.northFlow >= 0 ? '+' : ''}
              {data.northFlow} 亿
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.canOperate ? '适合操作' : '先保守'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{data.summary || '当前市场摘要暂无补充说明。'}</div>
      {error ? <div className="mt-3 text-xs text-orange-300">后台刷新失败，当前保留最近一次成功结果。</div> : null}
    </SmallBoard>
  );
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
      <SmallBoard title="BTC 风险偏好">
        <div className="text-sm text-[var(--text-secondary)]">正在载入 BTC 数据...</div>
      </SmallBoard>
    );
  }

  if (!data) {
    return (
      <SmallBoard title="BTC 风险偏好">
        <div className="text-sm text-[var(--text-secondary)]">BTC 数据暂时不可用。</div>
      </SmallBoard>
    );
  }

  return (
    <SmallBoard title="BTC 风险偏好">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="data-tile">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Price</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            {data.price > 0 ? `$${formatNumber(data.price)}` : '--'}
          </div>
          <div className={`mt-1 text-sm ${data.change24h >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            24H {formatPercent(data.change24h)}
          </div>
        </div>
        <div className="data-tile">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Fear & Greed</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.fearGreed}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.fearGreedLabel}</div>
        </div>
        <div className="data-tile">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Mode</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data.stale ? '降级快照' : '实时摘要'}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{data.strategy?.summary || '当前暂无策略摘要'}</div>
        </div>
      </div>
      {error ? <div className="mt-3 text-xs text-orange-300">后台刷新失败，当前保留最近一次成功结果。</div> : null}
    </SmallBoard>
  );
}

export default function Home() {
  const [currentTime, setCurrentTime] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);
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
      subtitle="先把今天的结论、推荐和动作收入眼底；证据层只在你需要时才展开。"
      badge="新闻驱动趋势判断"
      maxWidthClassName="max-w-6xl"
      actions={(
        <div className="metric-chip">
          <strong>{currentTime || '--:--'}</strong>
        </div>
      )}
    >
      <section className="surface-panel animate-stage p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="section-kicker">Overview</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">先看结论，再看依据。</div>
            <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">首页只回答三件事：今天看什么、该不该做、下一步去哪。</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="data-tile">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Step 01</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">读结论</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">主线、仓位、推荐股票</div>
            </div>
            <div className="data-tile">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Step 02</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">核依据</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">A 股、BTC、宏观证据</div>
            </div>
            <div className="data-tile">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Step 03</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">去执行</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">进入作战室</div>
            </div>
          </div>
        </div>
      </section>

      <CommanderOverview />

      <SmallBoard title="证据层">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm leading-7 text-[var(--text-secondary)]">只有需要确认依据时，再展开 A 股、BTC 和宏观 AI。</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowEvidence((prev) => !prev)}
              className={showEvidence ? 'btn btn-primary px-4 py-2 text-sm' : 'btn btn-secondary px-4 py-2 text-sm'}
            >
              {showEvidence ? '已展开证据层' : '展开证据层'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEvidence(true);
                setShowMacro((prev) => !prev);
              }}
              className={showMacro ? 'btn btn-primary px-4 py-2 text-sm' : 'btn btn-secondary px-4 py-2 text-sm'}
            >
              {showMacro ? '隐藏宏观 AI' : '加载宏观 AI'}
            </button>
          </div>
        </div>

        {!showEvidence ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="data-tile">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">A 股</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">指数、广度、北向</div>
            </div>
            <div className="data-tile">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">BTC</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">风险偏好观察器</div>
            </div>
            <div className="data-tile">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">宏观 AI</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">主线解释层</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <MarketEnvironment />
              <BtcCard />
            </div>

            {showMacro ? (
              <div className="surface-panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">宏观 AI</div>
                  <button type="button" onClick={() => setShowMacro(false)} className="btn btn-secondary px-4 py-2 text-sm">
                    收起
                  </button>
                </div>
                <MacroStrategyDashboard />
              </div>
            ) : null}
          </div>
        )}
      </SmallBoard>
    </AppShell>
  );
}
