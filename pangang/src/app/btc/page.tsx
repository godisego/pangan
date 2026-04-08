'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';
import { KLineSkeleton } from '@/components/ui/LoadingSkeleton';
import { btcApi } from '@/lib/api';
import { formatNumber, formatPercent } from '@/utils/formatters';
import type { BtcDetail, BtcKline, BtcStrategyCard } from '@/types/api';

const KLineChart = dynamic(() => import('@/components/KLineChart'), { ssr: false });

const BTC_DETAIL_CACHE_KEY = 'pangang_cache_btc_detail_v3';
const KLINE_CACHE_PREFIX = 'pangang_cache_btc_kline_v2_';
type ChartData = ComponentProps<typeof KLineChart>['data'];
type ChartMarkers = NonNullable<ComponentProps<typeof KLineChart>['markers']>;

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
    // ignore storage failure
  }
}

function getEmptyBtcDetail(): BtcDetail {
  return {
    price: 0,
    change24h: 0,
    change7d: 0,
    change30d: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
    fearGreed: 50,
    fearGreedLabel: '中性',
    source: '未就绪',
    stale: true,
    unavailable: true,
    technical: {
      support: 0,
      resistance: 0,
      ma7: 0,
      ma30: 0,
      rsi: 50,
      status: 'neutral',
      score: 0,
      indicators: [],
      summary: '技术面尚未加载。',
    },
    network: {
      status: 'neutral',
      score: 0,
      indicators: [],
      summary: '网络健康度尚未加载。',
    },
    market: {
      status: 'neutral',
      score: 0,
      indicators: [],
      summary: '全球市场联动尚未加载。',
    },
    sentiment: {
      status: 'neutral',
      score: 0,
      fearGreed: 50,
      fearGreedLabel: '中性',
      indicators: [],
      summary: '情绪数据尚未加载。',
    },
    recommendation: {
      overall: 'neutral',
      confidence: 0,
      summary: '正在生成 BTC 判断。',
      reasoning: [],
      strategies: [],
    },
    kline: undefined,
    dynamicStrategy: undefined,
  };
}

function buildSentiment(detail: BtcDetail) {
  const fearGreed = detail.fearGreed ?? 50;
  return {
    status: fearGreed <= 25 ? 'bearish' : fearGreed >= 75 ? 'caution' : 'neutral',
    score: fearGreed <= 25 ? 30 : fearGreed >= 75 ? 80 : 55,
    fearGreed,
    fearGreedLabel: detail.fearGreedLabel,
    indicators: [
      {
        name: '恐贪指数',
        value: `${fearGreed}`,
        meaning: fearGreed <= 25 ? '极度恐惧' : fearGreed >= 75 ? '极度贪婪' : '情绪中性',
        isBullish: fearGreed < 40,
      },
      {
        name: '24H 波动',
        value: formatPercent(detail.change24h),
        meaning: Math.abs(detail.change24h) >= 3 ? '波动明显' : '波动温和',
        isBullish: detail.change24h >= 0,
      },
      {
        name: '数据状态',
        value: detail.unavailable ? '不可用' : detail.stale ? '降级快照' : '实时摘要',
        meaning: detail.source || '未标注来源',
        isBullish: !detail.unavailable,
      },
    ],
    summary: detail.strategy?.summary || 'BTC 当前主要用于判断市场风险偏好，而不是单独决定总览结论。',
  } as BtcDetail['sentiment'];
}

function buildTechnical(detail: BtcDetail) {
  const base = detail.technical;
  const status: BtcDetail['technical']['status'] =
    detail.price > base.ma30 && base.rsi < 70
      ? 'bullish'
      : detail.price < base.support || base.rsi > 75
        ? 'caution'
        : 'neutral';

  return {
    ...base,
    status,
    score:
      detail.price > base.ma30
        ? 72
        : detail.price > base.support
          ? 56
          : 38,
    indicators: [
      {
        name: 'MA30',
        value: `$${formatNumber(base.ma30)}`,
        meaning: detail.price > base.ma30 ? '价格站上中期均线' : '价格仍在均线下方',
        isBullish: detail.price > base.ma30,
      },
      {
        name: 'RSI',
        value: `${base.rsi.toFixed(1)}`,
        meaning: base.rsi < 30 ? '偏超卖' : base.rsi > 70 ? '偏超买' : '区间中性',
        isBullish: base.rsi < 55,
      },
      {
        name: '关键位',
        value: `$${formatNumber(base.support)} / $${formatNumber(base.resistance)}`,
        meaning: '支撑 / 阻力',
        isBullish: detail.price >= base.support,
      },
    ],
    summary:
      base.summary ||
      `当前支撑位在 $${formatNumber(base.support)}，阻力位在 $${formatNumber(base.resistance)}。`,
  };
}

function buildRecommendation(detail: BtcDetail): BtcDetail['recommendation'] {
  const support = detail.technical.support || detail.price * 0.94;
  const resistance = detail.technical.resistance || detail.price * 1.06;
  const dynamic = detail.strategy;

  const strategies: BtcStrategyCard[] = [
    {
      type: 'dynamic',
      label: '当前建议',
      action: dynamic?.action || '观察企稳',
      range: {
        low: dynamic?.buyRange?.low || Math.round(support),
        high: dynamic?.buyRange?.high || Math.round(detail.price * 1.01),
        type: dynamic?.overall === 'bullish' ? 'buy' : 'hold',
      },
      reasoning: dynamic?.summary || '优先跟随实时摘要，不在模糊区间盲目加仓。',
      stopLoss: Math.round(dynamic?.stopLoss || support * 0.96),
      takeProfit: Math.round(dynamic?.takeProfit || resistance * 1.04),
    },
    {
      type: 'conservative',
      label: '保守方案',
      action: '等回踩支撑',
      range: {
        low: Math.round(support * 0.99),
        high: Math.round(support * 1.01),
        type: 'buy',
      },
      reasoning: `如果价格回踩到支撑位 $${formatNumber(support)} 附近再分批考虑。`,
      stopLoss: Math.round(support * 0.94),
      takeProfit: Math.round(detail.price * 1.03),
    },
    {
      type: 'aggressive',
      label: '进攻方案',
      action: '看突破确认',
      range: {
        low: Math.round(detail.price * 0.995),
        high: Math.round(resistance),
        type: 'buy',
      },
      reasoning: `只有放量突破 $${formatNumber(resistance)} 后才考虑追击，不提前预判。`,
      stopLoss: Math.round(detail.price * 0.97),
      takeProfit: Math.round(resistance * 1.08),
    },
  ];

  return {
    overall: dynamic?.overall || 'neutral',
    confidence: dynamic?.confidence || 60,
    summary: dynamic?.summary || 'BTC 当前更适合做风险偏好的辅助判断。',
    reasoning: dynamic?.reasoning || ['先看实时摘要，再确认技术位和外部市场是否共振。'],
    strategies,
  };
}

function buildCoreDetail(current: BtcDetail, incoming: Partial<BtcDetail>): BtcDetail {
  const merged = {
    ...current,
    ...incoming,
  } as BtcDetail;

  merged.sentiment = buildSentiment(merged);
  merged.technical = buildTechnical(merged);
  merged.recommendation = buildRecommendation(merged);
  return merged;
}

function StatusChip({ label, value, accent = 'default' }: { label: string; value: string; accent?: 'default' | 'good' | 'warn' }) {
  const accentClass =
    accent === 'good'
      ? 'text-[var(--accent-green)]'
      : accent === 'warn'
        ? 'text-[var(--accent-gold)]'
        : 'text-[var(--text-primary)]';

  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className={`module-node__title ${accentClass}`}>{value}</div>
    </div>
  );
}

function FactorBlock({
  title,
  score,
  summary,
  indicators,
}: {
  title: string;
  score: number;
  summary: string;
  indicators: Array<{ name: string; value: string; meaning?: string; isBullish: boolean }>;
}) {
  return (
    <div className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="module-node__label">{title}</div>
          <div className="module-node__title">{score}/100</div>
        </div>
      </div>
      <div className="mt-4 scan-list">
        {indicators.map((indicator) => (
          <div key={`${title}-${indicator.name}`} className="scan-row">
            <div className="scan-row-copy">
              <strong>{indicator.name}</strong>
              <span>{indicator.meaning || '暂无补充说明'}</span>
            </div>
            <div className={`scan-row-value ${indicator.isBullish ? 'text-[var(--accent-green)]' : 'text-[var(--accent-gold)]'}`}>
              {indicator.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{summary}</div>
    </div>
  );
}

function StrategyLane({ strategy }: { strategy: BtcStrategyCard }) {
  const actionColor =
    strategy.range.type === 'buy'
      ? 'text-[var(--accent-green)]'
      : strategy.range.type === 'sell'
        ? 'text-[var(--accent-red)]'
        : 'text-[var(--accent-gold)]';

  return (
    <div className="module-node">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="module-node__label">{strategy.label}</div>
          <div className="module-node__title">{strategy.action}</div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${actionColor}`}>{strategy.range.type}</div>
      </div>
      <div className="mt-4 scan-list">
        <div className="scan-row">
          <div className="scan-row-copy">
            <strong>价格区间</strong>
            <span>根据当前结构给出的执行带</span>
          </div>
          <div className={`scan-row-value ${actionColor}`}>
            ${formatNumber(strategy.range.low)} - ${formatNumber(strategy.range.high)}
          </div>
        </div>
        <div className="scan-row">
          <div className="scan-row-copy">
            <strong>止损 / 目标</strong>
            <span>失效位和兑现位</span>
          </div>
          <div className="scan-row-value">
            ${formatNumber(strategy.stopLoss)} / ${formatNumber(strategy.takeProfit)}
          </div>
        </div>
      </div>
      <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{strategy.reasoning}</div>
    </div>
  );
}

export default function BtcDetailPage() {
  const [data, setData] = useState<BtcDetail>(getEmptyBtcDetail());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [klineInterval, setKlineInterval] = useState('1H');

  const refreshCore = async (background = false) => {
    try {
      if (background) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const summary = await btcApi.getSummary();
      const next = buildCoreDetail(getEmptyBtcDetail(), {
        ...summary,
        dynamicStrategy: summary.strategy,
      });

      setData((prev) => buildCoreDetail({ ...prev, ...next }, next));
      writeCachedJson(BTC_DETAIL_CACHE_KEY, next);
      setError(null);

      void refreshSecondary();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BTC 详情暂时不可用';
      const cached = readCachedJson<BtcDetail>(BTC_DETAIL_CACHE_KEY);
      if (cached) {
        setData(cached);
      }
      setError(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const refreshSecondary = async () => {
    try {
      const [technical, derivatives, network, market] = await Promise.all([
        btcApi.getTechnical().catch(() => null),
        btcApi.getDerivatives().catch(() => null),
        btcApi.getNetwork().catch(() => null),
        btcApi.getMarket().catch(() => null),
      ]);

      setData((prev) => {
        const incoming: Partial<BtcDetail> = {
          fundingRatePct: derivatives?.fundingRatePct ?? prev.fundingRatePct,
          openInterestUsd: derivatives?.openInterestUsd ?? prev.openInterestUsd,
          longShortRatio: derivatives?.longShortRatio ?? prev.longShortRatio,
          network: network || prev.network,
          market: market || prev.market,
        };

        if (technical?.technical) {
          incoming.technical = {
            ...prev.technical,
            ...technical.technical,
          };
        }

        const next = buildCoreDetail(prev, incoming);
        writeCachedJson(BTC_DETAIL_CACHE_KEY, next);
        return next;
      });
    } catch {
      // optional modules stay stale
    }
  };

  useEffect(() => {
    const cached = readCachedJson<BtcDetail>(BTC_DETAIL_CACHE_KEY);
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    void refreshCore();
    const interval = window.setInterval(() => {
      void refreshCore(true);
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const cacheKey = `${KLINE_CACHE_PREFIX}${klineInterval}`;
    const cached = readCachedJson<BtcKline>(cacheKey);
    if (cached) {
      setData((prev) => ({ ...prev, kline: cached }));
    }

    const fetchKline = async () => {
      try {
        const result = await btcApi.getKline(klineInterval);
        setData((prev) => ({ ...prev, kline: result }));
        writeCachedJson(cacheKey, result);
      } catch {
        // keep previous/cached kline
      }
    };

    void fetchKline();
  }, [klineInterval]);

  const headerBadge = useMemo(() => {
    if (data.unavailable) return '数据不可用';
    if (data.stale) return '降级快照';
    return data.source || '实时摘要';
  }, [data.source, data.stale, data.unavailable]);

  const postureText = useMemo(() => {
    if (data.unavailable) return '当前无法可靠判断 BTC 风险偏好。';
    if (data.stale) return '当前是降级快照，只把 BTC 当成辅助参考。';
    return data.recommendation.summary;
  }, [data.recommendation.summary, data.stale, data.unavailable]);

  const chartData = useMemo<ChartData>(() => (
    data.kline?.candles.map((candle) => ({
      time: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    })) || []
  ), [data.kline]);

  const chartMarkers = useMemo<ChartMarkers>(() => (
    data.kline?.markers?.map((marker) => ({
      time: marker.timestamp,
      position:
        marker.type === 'top'
          ? 'aboveBar'
          : marker.type === 'bottom'
            ? 'belowBar'
            : 'inBar',
      color:
        marker.type === 'top'
          ? '#ef5350'
          : marker.type === 'bottom'
            ? '#26a69a'
            : '#f59e0b',
      shape:
        marker.type === 'top'
          ? 'arrowDown'
          : marker.type === 'bottom'
            ? 'arrowUp'
            : 'circle',
      text: marker.label,
    })) || []
  ), [data.kline]);

  return (
    <AppShell
      title="BTC 风险偏好"
      subtitle="把 BTC 放回整个终端体系里：先看价格与情绪，再看结构，最后给执行方案。"
      badge={headerBadge}
      maxWidthClassName="max-w-6xl"
      actions={(
        <>
          <Link href="/" className="btn btn-secondary px-4 py-2 text-sm">
            返回总览
          </Link>
          <Link href="/chat" className="btn btn-secondary px-4 py-2 text-sm">
            去对话
          </Link>
          <button type="button" onClick={() => void refreshCore(true)} className="btn btn-primary px-4 py-2 text-sm">
            {isRefreshing ? '刷新中...' : '刷新 BTC'}
          </button>
        </>
      )}
    >
      <ModuleShell
        code="01"
        eyebrow="现货与姿态"
        title="先看价格、情绪和当前动作"
        summary={postureText}
        badge={data.recommendation.overall}
        variant="briefing"
        motion="pulse"
      >
        {loading ? (
          <div className="module-node">
            <div className="module-node__label">当前状态</div>
            <div className="module-node__title">正在载入 BTC 详情...</div>
            <div className="module-node__copy">会先展示快照，再后台刷新结构和策略。</div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="module-node">
              <div className="module-node__label">实时价格</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                {data.unavailable || data.price <= 0 ? '--' : `$${formatNumber(data.price)}`}
              </div>
              <div className={`mt-3 text-sm ${data.change24h >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                24H {formatPercent(data.change24h)} / 7D {formatPercent(data.change7d || 0)} / 30D {formatPercent(data.change30d || 0)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)]">
                  {data.source || '未标注来源'}
                </span>
                {data.updatedAt ? (
                  <span>更新于 {data.updatedAt.replace('T', ' ').slice(0, 19)}</span>
                ) : null}
              </div>
              <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                {data.strategy?.summary || 'BTC 当前更像风险偏好观察器，不宜脱离整体盘面单独决策。'}
              </div>
            </div>

            <div className="module-kpi-grid">
              <StatusChip label="恐贪指数" value={data.unavailable ? '--' : `${data.fearGreed}`} accent={data.fearGreed < 40 ? 'good' : 'warn'} />
              <StatusChip label="24H 高 / 低" value={data.unavailable ? '--' : `${formatNumber(data.high24h || 0)} / ${formatNumber(data.low24h || 0)}`} />
              <StatusChip label="支撑 / 阻力" value={`${formatNumber(data.technical.support)} / ${formatNumber(data.technical.resistance)}`} />
              <StatusChip label="当前动作" value={data.strategy?.action || '观察'} accent="warn" />
            </div>
          </div>
        )}

        {error ? (
          <div className="mt-4 rounded-[18px] border border-[rgba(255,123,136,0.2)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            当前展示的是最近一次成功结果。后台刷新失败：{error}
          </div>
        ) : null}
      </ModuleShell>

      <ModuleShell
        code="02"
        eyebrow="结构"
        title="再看关键位和 K 线结构"
        badge={klineInterval}
        variant="strategy"
        motion="track"
        actions={(
          <div className="flex flex-wrap gap-2">
            {['15m', '1H', '4H', '1D', '1W'].map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setKlineInterval(interval)}
                className={interval === klineInterval ? 'btn btn-primary px-3 py-2 text-xs' : 'btn btn-secondary px-3 py-2 text-xs'}
              >
                {interval}
              </button>
            ))}
          </div>
        )}
      >
        <div className="module-node">
          {data.kline ? (
            <div className="overflow-hidden rounded-[22px] border border-[var(--border-color)] bg-[#101319]">
              <KLineChart
                data={chartData}
                markers={chartMarkers}
                height={360}
                interval={klineInterval}
                showMA
                showVolume
                showRSI={false}
                showMACD={false}
              />
            </div>
          ) : (
            <KLineSkeleton height={360} />
          )}

          <div className="mt-4 scan-list">
            <div className="scan-row">
              <div className="scan-row-copy">
                <strong>技术摘要</strong>
                <span>{data.technical.summary}</span>
              </div>
              <div className="scan-row-value">{data.technical.score}/100</div>
            </div>
            <div className="scan-row">
              <div className="scan-row-copy">
                <strong>MA7 / MA30</strong>
                <span>短中期均线位置</span>
              </div>
              <div className="scan-row-value">
                {formatNumber(data.technical.ma7)} / {formatNumber(data.technical.ma30)}
              </div>
            </div>
          </div>
        </div>
      </ModuleShell>

      <ModuleShell
        code="03"
        eyebrow="Evidence"
        title="最后确认四个因子是否同向"
        badge="4 Factors"
        variant="evidence"
        motion="scan"
      >
        <div className="module-columns xl:grid-cols-2">
          <FactorBlock
            title="情绪"
            score={data.sentiment?.score || 0}
            summary={data.sentiment?.summary || '情绪模块暂未就绪。'}
            indicators={data.sentiment?.indicators || []}
          />
          <FactorBlock
            title="技术"
            score={data.technical.score}
            summary={data.technical.summary}
            indicators={data.technical.indicators}
          />
          <FactorBlock
            title="网络"
            score={data.network?.score || 0}
            summary={data.network?.summary || '网络模块暂未就绪。'}
            indicators={data.network?.indicators || []}
          />
          <FactorBlock
            title="全球市场"
            score={data.market?.score || 0}
            summary={data.market?.summary || '全球市场模块暂未就绪。'}
            indicators={data.market?.indicators || []}
          />
        </div>
      </ModuleShell>

      <ModuleShell
        code="04"
        eyebrow="Action Plan"
        title="把判断变成可执行方案"
        summary="这里只保留三种最实用的执行路径，不再把 BTC 页面做成另一个独立宇宙。"
        badge={`${data.recommendation.confidence}%`}
        variant="execution"
        motion="pulse"
      >
        <div className="module-node">
          <div className="module-node__label">Main Judgment</div>
          <div className="module-node__title">{data.recommendation.summary}</div>
          <div className="mt-4 scan-list">
            {data.recommendation.reasoning.map((reason) => (
              <div key={reason} className="scan-row">
                <div className="scan-row-copy">
                  <strong>依据</strong>
                  <span>{reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="module-columns xl:grid-cols-3">
          {data.recommendation.strategies.map((strategy) => (
            <StrategyLane key={strategy.label} strategy={strategy} />
          ))}
        </div>
      </ModuleShell>
    </AppShell>
  );
}
