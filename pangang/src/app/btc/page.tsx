'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { btcApi } from '@/lib/api';
import { formatPercent, formatNumber, formatRelativeTime } from '@/utils/formatters';
import { KLineSkeleton } from '@/components/ui/LoadingSkeleton';
import type { BtcDetail, BtcStrategy, StatusType } from '@/types/api';

const KLineChart = dynamic(() => import('../../components/KLineChart'), { ssr: false });

// 异动提示卡组件 - 展示智能多因子分析
function MarketAlertCard({ change24h, fearGreed, strategy }: { change24h: number; fearGreed: number; strategy?: BtcStrategy }) {
    if (!strategy) return null;

    const isExtreme = Math.abs(change24h) >= 5 || fearGreed <= 25 || fearGreed >= 75;
    if (!isExtreme) return null;

    const alertConfig = {
        crash: { bg: 'bg-red-500/20', border: 'border-red-500/50', icon: '🚨', label: '市场暴跌' },
        dump: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', icon: '⚠️', label: '大幅回调' },
        surge: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', icon: '🚀', label: '市场暴涨' },
        pump: { bg: 'bg-green-500/20', border: 'border-green-500/50', icon: '📈', label: '强势拉升' },
        normal: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', icon: '📊', label: '市场异动' },
    };

    const marketState = strategy?.marketState ?? 'normal';
    const config = alertConfig[marketState as keyof typeof alertConfig] || alertConfig.normal;

    // 判断整体倾向颜色
    const overallColor = strategy.overall?.includes('bullish')
        ? 'text-[var(--accent-green)]'
        : strategy.overall?.includes('bearish')
            ? 'text-[var(--accent-red)]'
            : 'text-yellow-400';

    return (
        <section className={`card ${config.bg} border ${config.border}`}>
            {/* 头部：状态标签 + 涨跌幅 */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{config.icon}</span>
                <span className="text-lg font-bold text-[var(--text-primary)]">{config.label}</span>
                <span className={`ml-auto text-lg font-bold ${change24h >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                    {change24h >= 0 ? '+' : ''}{change24h}%
                </span>
            </div>

            {/* 核心观点 */}
            <p className="text-sm text-[var(--text-primary)] mb-3 leading-relaxed">{strategy.summary}</p>

            {/* 综合评分 + 操作建议 */}
            <div className="flex items-center justify-between mb-4 p-2 bg-[var(--bg-primary)]/50 rounded-lg">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">综合评分</span>
                    <span className={`text-lg font-bold ${overallColor}`}>
                        {strategy.totalScore?.toFixed(1) || 'N/A'}
                    </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${strategy.overall?.includes('bullish') ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]' : strategy.overall?.includes('bearish') ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {strategy.action}
                </span>
            </div>

            {/* 多因子雷达 */}
            {strategy.factors && (
                <div className="grid grid-cols-5 gap-1 mb-4">
                    {Object.entries(strategy.factors).map(([key, val]) => (
                        <div key={key} className="text-center p-1 bg-[var(--bg-primary)]/30 rounded">
                            <div className={`text-xs font-bold ${val.score > 20 ? 'text-[var(--accent-green)]' : val.score < -20 ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}`}>
                                {val.score > 0 ? '+' : ''}{val.score.toFixed(0)}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">{val.label.split(':')[0]}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* 模式识别 */}
            {strategy.patterns && strategy.patterns.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {strategy.patterns.map((p: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded text-xs bg-[var(--bg-primary)]/50 text-[var(--text-secondary)]">
                            🔍 {p}
                        </span>
                    ))}
                </div>
            )}

            {/* 可能原因 */}
            {strategy.possibleReasons && strategy.possibleReasons.length > 0 && (
                <div className="mb-3 p-2 bg-[var(--bg-primary)]/30 rounded-lg">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">💡 可能原因</div>
                    {strategy.possibleReasons.map((r: string, i: number) => (
                        <div key={i} className="text-xs text-[var(--text-primary)] leading-relaxed">{r}</div>
                    ))}
                </div>
            )}

            {/* 风险提示 */}
            {strategy.risks && strategy.risks.length > 0 && (
                <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="text-xs text-red-400 mb-1">⚠️ 风险提示</div>
                    {strategy.risks.slice(0, 2).map((r: string, i: number) => (
                        <div key={i} className="text-xs text-[var(--text-secondary)]">• {r}</div>
                    ))}
                </div>
            )}
        </section>
    );
}

// 模拟BTC详细数据
const mockBtcDetail = {
    price: 102580,
    change24h: 3.2,
    change7d: 8.5,
    change30d: 15.2,
    high24h: 103500,
    low24h: 98200,

    // 网络健康度 (替代原链上数据)
    network: {
        status: 'bullish' as const,
        score: 75,
        indicators: [
            { name: '算力', value: '加载中', meaning: '加载中', isBullish: true },
            { name: '难度', value: '加载中', meaning: '挖矿竞争度', isBullish: true },
            { name: '24H交易', value: '加载中', meaning: '链上活跃度', isBullish: true },
        ],
        summary: '加载中...',
    },

    // 市场情绪
    sentiment: {
        status: 'caution' as const,
        score: 65,
        fearGreed: 72,
        fearGreedLabel: '贪婪',
        indicators: [
            { name: '恐贪指数', value: '72', threshold: '>75需警惕', isBullish: true },
            { name: '资金费率', value: '加载中', meaning: '加载中', isBullish: true },
            { name: '未平仓量', value: '加载中', meaning: '加载中', isBullish: true },
        ],
        summary: '市场偏乐观，短期可能有回调压力',
    },

    // 全球市场 (替代原ETF资金流)
    market: {
        status: 'neutral' as const,
        score: 60,
        indicators: [
            { name: '24H市值', value: '加载中', meaning: '加载中', isBullish: true },
            { name: '加密总市值', value: '加载中', meaning: '加载中', isBullish: true },
            { name: 'BTC市占', value: '加载中', meaning: '加载中', isBullish: true },
        ],
        summary: '加载中...',
    },

    // 技术位置
    technical: {
        status: 'bullish' as const,
        score: 75,
        support: 95000,
        resistance: 108000,
        ma7: 99800,
        ma30: 95200,
        ma200: 72500,
        rsi: 68,
        indicators: [
            { name: 'MA位置', value: '站稳所有均线', meaning: '多头排列', isBullish: true },
            { name: 'RSI', value: '68', meaning: '偏强未超买', isBullish: true },
            { name: 'MACD', value: '金叉', meaning: '动能向上', isBullish: true },
        ],
        summary: '趋势向上，回调可接',
    },

    // 综合建议
    recommendation: {
        overall: 'bullish' as const,
        confidence: 75,
        summary: '当前偏多，但短期需警惕贪婪情绪引发的回调',
        reasoning: [
            '✅ 链上数据健康：交易所持续流出，巨鲸增持',
            '✅ 资金面强劲：ETF资金持续流入，机构看好',
            '⚠️ 情绪略过热：恐贪指数72进入贪婪区',
            '✅ 技术面良好：站稳10万，多头排列',
        ],
        strategies: [
            {
                type: 'conservative',
                label: '🐢 保守策略',
                action: '观望等待回调',
                range: { low: 95000, high: 98000, type: 'buy' },
                reasoning: '等待回调至MA30附近($95K)再分批建仓，风险收益比更优',
                stopLoss: 90000,
                takeProfit: 108000,
            },
            {
                type: 'balanced',
                label: '⚖️ 平衡策略',
                action: '持有观望',
                range: { low: 98000, high: 102000, type: 'hold' },
                reasoning: '当前价位可持有，不追涨。若回调至支撑位$98K可加仓',
                stopLoss: 93000,
                takeProfit: 115000,
            },
            {
                type: 'aggressive',
                label: '🔥 激进策略',
                action: '可适度参与',
                range: { low: 102000, high: 108000, type: 'buy' },
                reasoning: '趋势向上，可参与。突破$108K阻力位可追仓',
                stopLoss: 98000,
                takeProfit: 125000,
            },
        ],
    },
};

// 状态信号灯 - 支持扩展状态类型
function StatusLight({ status }: { status: string }) {
    const config: Record<string, { color: string; label: string }> = {
        bullish: { color: 'bg-[var(--accent-green)]', label: '看多' },
        cautious_bullish: { color: 'bg-green-400', label: '谨慎看多' },
        neutral: { color: 'bg-yellow-400', label: '中性' },
        cautious_bearish: { color: 'bg-orange-400', label: '谨慎看空' },
        bearish: { color: 'bg-[var(--accent-red)]', label: '看空' },
        caution: { color: 'bg-orange-400', label: '警惕' },
        opportunity: { color: 'bg-[var(--accent-green)]', label: '机会' },
    };
    const { color, label } = config[status] || config.neutral;
    return (
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color} animate-pulse`} />
            <span className={`text-sm font-medium ${color.replace('bg-', 'text-')}`}>{label}</span>
        </div>
    );
}

// 指标卡片（带依据）
function IndicatorCard({ indicator }: { indicator: { name: string; value: string; change?: number; meaning?: string; threshold?: string; isBullish: boolean } }) {
    return (
        <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-secondary)]">{indicator.name}</span>
                <span className={`text-xs ${indicator.isBullish ? 'text-[var(--accent-green)]' : 'text-orange-400'}`}>
                    {indicator.isBullish ? '✓' : '⚠'}
                </span>
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
                {indicator.value}
                {indicator.change !== undefined && (
                    <span className={`text-xs ml-1 ${indicator.change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                        {indicator.change >= 0 ? '+' : ''}{indicator.change}%
                    </span>
                )}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
                {indicator.meaning || indicator.threshold}
            </div>
        </div>
    );
}

// 分析模块
function AnalysisSection({ title, status, score, indicators, summary }: {
    title: string;
    status: 'bullish' | 'neutral' | 'bearish' | 'caution';
    score: number;
    indicators: Array<{ name: string; value: string; change?: number; meaning?: string; threshold?: string; isBullish: boolean }>;
    summary: string;
}) {
    return (
        <section className="card">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">得分 {score}/100</span>
                    <StatusLight status={status} />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
                {indicators.map((ind, i) => (
                    <IndicatorCard key={i} indicator={ind} />
                ))}
            </div>
            <div className="p-2 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-primary)]">
                💡 <span className="text-[var(--text-secondary)]">含义：</span>{summary}
            </div>
        </section>
    );
}

// 策略卡片
function StrategyCard({ strategy }: { strategy: typeof mockBtcDetail.recommendation.strategies[0] }) {
    const rangeLabel = strategy.range.type === 'buy' ? '买入区间' : strategy.range.type === 'sell' ? '卖出区间' : '持有区间';
    const rangeColor = strategy.range.type === 'buy' ? 'text-[var(--accent-green)]' : strategy.range.type === 'sell' ? 'text-[var(--accent-red)]' : 'text-yellow-400';

    return (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-[var(--text-primary)]">{strategy.label}</span>
                <span className={`text-sm font-bold ${rangeColor}`}>{strategy.action}</span>
            </div>

            {/* 价格区间 */}
            <div className="mb-3 p-2 bg-[var(--bg-primary)] rounded">
                <div className="text-xs text-[var(--text-secondary)] mb-1">{rangeLabel}</div>
                <div className={`text-lg font-bold ${rangeColor}`}>
                    ${formatNumber(strategy.range.low)} - ${formatNumber(strategy.range.high)}
                </div>
            </div>

            {/* 止损止盈 */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">止损位</span>
                    <span className="text-[var(--accent-red)]">${formatNumber(strategy.stopLoss)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">目标位</span>
                    <span className="text-[var(--accent-green)]">${formatNumber(strategy.takeProfit)}</span>
                </div>
            </div>

            {/* 逻辑解释 */}
            <div className="text-sm text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-2">
                📝 {strategy.reasoning}
            </div>
        </div>
    );
}

export default function BtcDetailPage() {
    const router = useRouter();
    const [data, setData] = useState<any>(mockBtcDetail);
    const [loading, setLoading] = useState(true);
    const [klineInterval, setKlineInterval] = useState('1H'); // K线周期状态
    const [showMA, setShowMA] = useState(true); // 显示MA均线
    const [showVolume, setShowVolume] = useState(true); // 显示成交量
    const [showRSI, setShowRSI] = useState(false); // 显示RSI
    const [showMACD, setShowMACD] = useState(false); // 显示MACD

    useEffect(() => {
        const fetchData = async () => {
            // ===== 阶段1: 核心数据优先加载 (快速响应) =====
            try {
                const [summaryRes, technicalRes] = await Promise.all([
                    btcApi.getSummary(),
                    btcApi.getTechnical()
                ]);

                if (!summaryRes || !technicalRes) throw new Error("Core API failed");

                // 立即显示核心数据
                setData((prev: any) => ({
                    ...prev,
                    price: summaryRes.price,
                    change24h: summaryRes.change24h,
                    change7d: summaryRes.change7d || prev.change7d,
                    change30d: summaryRes.change30d || prev.change30d,
                    high24h: summaryRes.high24h || summaryRes.price * 1.05,
                    low24h: summaryRes.low24h || summaryRes.price * 0.95,
                    volume24h: summaryRes.volume24h,
                    fearGreed: summaryRes.fearGreed,
                    fearGreedLabel: summaryRes.fearGreedLabel,
                    dynamicStrategy: summaryRes.strategy,
                    sentiment: {
                        ...prev.sentiment,
                        fearGreed: summaryRes.fearGreed,
                        fearGreedLabel: summaryRes.fearGreedLabel,
                        score: summaryRes.fearGreed <= 25 ? 30 : summaryRes.fearGreed >= 75 ? 80 : 50,
                        status: summaryRes.fearGreed <= 25 ? 'bearish' : summaryRes.fearGreed >= 75 ? 'caution' : 'neutral',
                        summary: summaryRes.strategy?.summary || prev.sentiment.summary,
                        // 恐贪指数在核心数据阶段即可更新
                        indicators: [
                            { name: '恐贪指数', value: summaryRes.fearGreed.toString(), threshold: summaryRes.fearGreed <= 25 ? '极度恐惧' : summaryRes.fearGreed >= 75 ? '极度贪婪' : '中性', isBullish: summaryRes.fearGreed <= 40 },
                            // 资金费率和未平仓量在第二阶段更新，这里先保留加载中状态
                            { name: '资金费率', value: '加载中', meaning: '加载中', isBullish: true },
                            { name: '未平仓量', value: '加载中', meaning: '加载中', isBullish: true },
                        ],
                    },
                    technical: {
                        ...prev.technical,
                        support: technicalRes.technical.support,
                        resistance: technicalRes.technical.resistance,
                        ma7: technicalRes.technical.ma7,
                        ma30: technicalRes.technical.ma30,
                        rsi: technicalRes.technical.rsi,
                        status: technicalRes.technical.rsi > 70 ? 'caution' : technicalRes.technical.rsi < 30 ? 'bullish' : 'neutral',
                        indicators: [
                            { name: 'MA位置', value: summaryRes.price > technicalRes.technical.ma30 ? '站稳MA30' : '跌破MA30', meaning: '均线位置', isBullish: summaryRes.price > technicalRes.technical.ma30 },
                            { name: 'RSI', value: technicalRes.technical.rsi?.toFixed(1) || '50', meaning: technicalRes.technical.rsi < 30 ? '超卖' : technicalRes.technical.rsi > 70 ? '超买' : '中性', isBullish: technicalRes.technical.rsi < 50 },
                            { name: '支撑位', value: `$${technicalRes.technical.support?.toLocaleString()}`, meaning: '关键支撑', isBullish: summaryRes.price > technicalRes.technical.support },
                        ]
                    },
                    recommendation: {
                        overall: summaryRes.strategy?.overall || prev.recommendation.overall,
                        confidence: summaryRes.strategy?.confidence || prev.recommendation.confidence,
                        summary: summaryRes.strategy?.summary || prev.recommendation.summary,
                        reasoning: summaryRes.strategy?.reasoning || prev.recommendation.reasoning,
                        strategies: (() => {
                            const price = summaryRes.price;
                            const support = technicalRes.technical.support || price * 0.9;
                            const resistance = technicalRes.technical.resistance || price * 1.1;
                            const stopLoss = summaryRes.strategy?.stopLoss || support * 0.92;
                            const takeProfit = summaryRes.strategy?.takeProfit || resistance * 1.05;
                            return [
                                {
                                    type: 'dynamic',
                                    label: '🎯 当前建议',
                                    action: summaryRes.strategy?.action || '计算中',
                                    range: {
                                        low: summaryRes.strategy?.buyRange?.low || Math.round(price * 0.95),
                                        high: summaryRes.strategy?.buyRange?.high || Math.round(price * 1.02),
                                        type: summaryRes.strategy?.overall?.includes('bullish') ? 'buy' : 'hold'
                                    },
                                    reasoning: summaryRes.strategy?.summary || '',
                                    stopLoss: Math.round(stopLoss),
                                    takeProfit: Math.round(takeProfit),
                                },
                                {
                                    type: 'conservative',
                                    label: '🐢 保守策略',
                                    action: price < support * 1.05 ? '支撑位附近可布局' : '等待回调至支撑',
                                    range: { low: Math.round(support * 0.98), high: Math.round(support * 1.02), type: 'buy' },
                                    reasoning: `等待回调至支撑位$${Math.round(support).toLocaleString()}附近再分批建仓`,
                                    stopLoss: Math.round(support * 0.90),
                                    takeProfit: Math.round(resistance),
                                },
                                {
                                    type: 'aggressive',
                                    label: '🔥 激进策略',
                                    action: price > resistance * 0.95 ? '接近阻力位谨慎' : '趋势中可参与',
                                    range: { low: Math.round(price * 0.98), high: Math.round(resistance), type: 'buy' },
                                    reasoning: `趋势向上可参与，突破阻力位$${Math.round(resistance).toLocaleString()}可追仓`,
                                    stopLoss: Math.round(support),
                                    takeProfit: Math.round(resistance * 1.15),
                                },
                            ];
                        })()
                    }
                }));

                // 核心数据加载完成，立即结束loading状态
                setLoading(false);

                // ===== 阶段2: 扩展数据后台加载 (不阻塞UI) =====
                // ===== 阶段2: 扩展数据后台加载 (不阻塞UI) =====
                const [derivativesRes, networkRes, marketRes] = await Promise.all([
                    btcApi.getDerivatives().catch(() => null),
                    btcApi.getNetwork().catch(() => null),
                    btcApi.getMarket().catch(() => null)
                ]);

                // 渐进更新扩展数据
                setData((prev: any) => ({
                    ...prev,
                    ...prev,
                    derivatives: derivativesRes || prev.derivatives,
                    sentiment: {
                        ...prev.sentiment,
                        indicators: [
                            // 恐贪指数已在第一阶段更新，这里确保它不被覆盖或使用prev.fearGreed
                            { name: '恐贪指数', value: prev.fearGreed?.toString() || '50', threshold: prev.fearGreed <= 25 ? '极度恐惧' : prev.fearGreed >= 75 ? '极度贪婪' : '中性', isBullish: prev.fearGreed <= 40 },
                            {
                                name: '资金费率',
                                value: derivativesRes?.fundingRatePct != null ? `${derivativesRes.fundingRatePct}%` : 'N/A',
                                meaning: derivativesRes?.fundingRatePct != null
                                    ? (derivativesRes.fundingRatePct > 0.01 ? '多头过热' : derivativesRes.fundingRatePct < -0.01 ? '空头过热' : '中性')
                                    : '加载中',
                                isBullish: derivativesRes?.fundingRatePct != null && derivativesRes.fundingRatePct < 0.01
                            },
                            {
                                name: '未平仓量',
                                value: derivativesRes?.openInterestUsd != null ? `$${derivativesRes.openInterestUsd}B` : 'N/A',
                                meaning: 'OKX持仓',
                                isBullish: true
                            },
                        ],
                    },
                    network: networkRes ? {
                        status: networkRes.status,
                        score: networkRes.score,
                        indicators: networkRes.indicators || prev.network.indicators,
                        summary: networkRes.summary
                    } : prev.network,
                    market: marketRes ? {
                        status: marketRes.status,
                        score: marketRes.score,
                        indicators: marketRes.indicators || prev.market.indicators,
                        summary: marketRes.summary
                    } : prev.market,
                }));

            } catch (e) {
                console.error("Failed to fetch real data, using mock", e);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 监听 K线周期变化，独立加载数据
    useEffect(() => {
        const fetchKline = async () => {
            // 清空现有K线数据以显示加载状态 (可选，但为了体验最好保留旧数据直到新数据到来，或者显示loading overlay)
            // 这里为了简洁，直接获取并覆盖
            try {
                const klineData = await btcApi.getKline(klineInterval);
                if (klineData) {
                    setData((prev: any) => ({ ...prev, kline: klineData }));
                }
            } catch (e) {
                console.error("Failed to fetch kline data", e);
            }
        };
        fetchKline();
    }, [klineInterval]);

    const isUp = data.change24h >= 0;

    // 加载中显示骨架屏
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
                <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
                    <div className="max-w-3xl mx-auto px-4 py-3">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="text-[var(--text-secondary)]">← 返回</button>
                            <span className="text-xl">₿</span>
                            <span className="text-lg font-semibold text-[var(--text-primary)]">比特币</span>
                        </div>
                    </div>
                </header>
                <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                    <section className="card bg-gradient-to-r from-orange-500/10 to-transparent">
                        <div className="animate-pulse">
                            <div className="h-10 bg-[var(--bg-secondary)] rounded w-40 mb-2"></div>
                            <div className="h-4 bg-[var(--bg-secondary)] rounded w-24 mb-4"></div>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-[var(--bg-secondary)] rounded"></div>)}
                            </div>
                        </div>
                    </section>
                    <KLineSkeleton height={160} />
                    <section className="card">
                        <div className="animate-pulse space-y-2">
                            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/3"></div>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded"></div>)}
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
                <div className="max-w-3xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                ← 返回
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">₿</span>
                                <span className="text-lg font-semibold text-[var(--text-primary)]">比特币</span>
                            </div>
                        </div>
                        <Link href="/chat" className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-full text-sm font-medium">
                            💬 询问AI
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                {/* 异动提示卡 - 最醒目的位置 */}
                <MarketAlertCard change24h={data.change24h} fearGreed={data.sentiment.fearGreed} strategy={data.dynamicStrategy} />

                {/* 价格信息 */}
                <section className="card bg-gradient-to-r from-orange-500/10 to-transparent">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="text-3xl font-bold text-orange-400">
                                ${formatNumber(data.price)}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm ${isUp ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                    24H: {formatPercent(data.change24h)}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">OKX 现货</span>
                            </div>
                        </div>
                        <div className="text-right text-sm text-[var(--text-secondary)]">
                            <div>24H高: ${formatNumber(data.high24h)}</div>
                            <div>24H低: ${formatNumber(data.low24h)}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div>
                            <div className={`font-bold ${data.change24h >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {formatPercent(data.change24h)}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">24H</div>
                        </div>
                        <div>
                            <div className={`font-bold ${data.change7d >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {formatPercent(data.change7d)}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">7D</div>
                        </div>
                        <div>
                            <div className={`font-bold ${data.change30d >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {formatPercent(data.change30d)}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">30D</div>
                        </div>
                        <div>
                            <div className="font-bold text-[var(--text-primary)]">
                                ${formatNumber(data.technical.support)}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">支撑位</div>
                        </div>
                    </div>
                </section>

                {/* K线图 - 专业版 */}
                <section className="card">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">📈 K线走势 & 策略识别</h3>
                        <div className="flex gap-1">
                            {['15m', '1H', '4H', '1D', '1W'].map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setKlineInterval(period)}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${klineInterval === period
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                        }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 指标开关 */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        <button
                            onClick={() => setShowMA(!showMA)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showMA
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                }`}
                        >
                            MA均线
                        </button>
                        <button
                            onClick={() => setShowVolume(!showVolume)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showVolume
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                }`}
                        >
                            成交量
                        </button>
                        <button
                            onClick={() => setShowRSI(!showRSI)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showRSI
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                }`}
                        >
                            RSI
                        </button>
                        <button
                            onClick={() => setShowMACD(!showMACD)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showMACD
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                                }`}
                        >
                            MACD
                        </button>
                    </div>

                    {/* 使用KLineChart组件 */}
                    {data.kline ? (
                        <div className={`w-full rounded-lg overflow-hidden border border-[var(--border-color)] bg-[#111] ${showRSI || showMACD ? 'h-[420px]' : 'h-[350px]'}`}>
                            <KLineChart
                                data={data.kline.candles}
                                markers={data.kline.markers}
                                height={showRSI || showMACD ? 420 : 350}
                                interval={klineInterval}
                                showMA={showMA}
                                showVolume={showVolume}
                                showRSI={showRSI}
                                showMACD={showMACD}
                            />
                        </div>
                    ) : (
                        <KLineSkeleton height={350} />
                    )}

                    {/* MA 均线图例 */}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#FF6B6B]"></span> MA5</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#4ECDC4]"></span> MA10</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#45B7D1]"></span> MA20</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#96CEB4]"></span> MA60</span>
                    </div>

                    {/* 策略图例 */}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef5350]"></span> 顶(射击之星)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#26a69a]"></span> 底(锤子线)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> 假突破</span>
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-[var(--text-secondary)]">
                        <span>支撑: ${formatNumber(data.technical.support)}</span>
                        <span>阻力: ${formatNumber(data.technical.resistance)}</span>
                    </div>
                </section>

                {/* 四维分析 */}
                <AnalysisSection
                    title="⛓️ 网络健康度"
                    status={data.network.status}
                    score={data.network.score}
                    indicators={data.network.indicators}
                    summary={data.network.summary}
                />

                <AnalysisSection
                    title="😱 市场情绪"
                    status={data.sentiment.status}
                    score={data.sentiment.score}
                    indicators={data.sentiment.indicators}
                    summary={data.sentiment.summary}
                />

                <AnalysisSection
                    title="🌍 全球市场"
                    status={data.market.status}
                    score={data.market.score}
                    indicators={data.market.indicators}
                    summary={data.market.summary}
                />

                <AnalysisSection
                    title="📊 技术位置"
                    status={data.technical.status}
                    score={data.technical.score}
                    indicators={data.technical.indicators}
                    summary={data.technical.summary}
                />

                {/* 综合建议区 */}
                <section className="card bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/30">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">🤖 综合判断</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text-secondary)]">置信度 {data.recommendation.confidence}%</span>
                            <StatusLight status={data.recommendation.overall} />
                        </div>
                    </div>

                    {/* 核心结论 */}
                    <div className="p-3 bg-[var(--bg-primary)] rounded-lg mb-4">
                        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                            {data.recommendation.summary}
                        </p>
                        <div className="space-y-1">
                            {data.recommendation.reasoning.map((reason: any, i: number) => (
                                <div key={i} className="text-xs text-[var(--text-secondary)]">{reason}</div>
                            ))}
                        </div>
                    </div>

                    {/* 三种策略建议 */}
                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">📋 操作建议（含价格区间）</h4>
                    <div className="space-y-3">
                        {data.recommendation.strategies.map((strategy: any, i: number) => (
                            <StrategyCard key={i} strategy={strategy} />
                        ))}
                    </div>
                </section>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                    <button className="btn btn-primary flex-1">追踪BTC</button>
                    <Link href="/chat" className="btn btn-secondary flex-1 text-center">询问AI</Link>
                </div>
            </main>
        </div>
    );
}
