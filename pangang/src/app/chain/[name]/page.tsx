"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Interfaces ---
interface Stock {
    code: string;
    name: string;
    price: number;
    change: number;
    coreScore?: number;
    rank?: number;
    elasticity?: string;
}

interface ChainSegment {
    segment: string;
    tag: string;
    stage: string;
    benefitLevel: number; // 1-5
    stocks: Stock[];
}

interface DimensionScore {
    id: string;
    label: string;
    score: number;
    color: string;
}

interface ConceptOverview {
    stage: string;
    confidence: number;
    sectorChange: number;
    positiveCount: number;
    negativeCount: number;
    leaderAveragePrice: number;
    turnover: number;
    leaderTurnoverRatio: number;
}

interface ConceptDetail {
    name: string;
    count: number;
    avgChange: number;
    chainStructure?: ChainSegment[];
    groups?: {
        leaders: Stock[];
        followers: Stock[];
        declining: Stock[];
    };
    dimensions?: DimensionScore[];
    overview?: ConceptOverview;
    news?: Array<{
        title: string;
        source: string;
        time: string;
    }>;
    dataSource?: {
        sector: string;
        hotSectorMatched: boolean;
        matchedSectorName?: string | null;
    };
    // Extra AI Analysis fields
    logic?: {
        status: 'valid' | 'invalid' | 'neutral';
        summary: string;
        supports: string[];
        risks: string[];
    };
    stocks: Stock[]; // Keep for compatibility
}

// --- Components ---

function ScoreBar({ label, score, color = 'bg-green-500' }: { label: string; score: number; color?: string }) {
    return (
        <div className="mb-2">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className="text-[var(--text-primary)] font-medium">{score}分</span>
            </div>
            <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${score}%` }}></div>
            </div>
        </div>
    );
}

function StarRating({ level }: { level: number }) {
    return (
        <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-xs ${i < level ? 'text-yellow-400' : 'text-[var(--text-secondary)]'}`}>
                    ★
                </span>
            ))}
        </div>
    )
}

function LogicCard({ logic }: { logic: ConceptDetail['logic'] }) {
    if (!logic) return null;

    const statusConfig = {
        valid: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: '✅', label: '逻辑成立' },
        invalid: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: '❌', label: '逻辑证伪' },
        neutral: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: '⏳', label: '观察中' },
    };
    const status = statusConfig[logic.status];

    return (
        <section className="card border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">💡 逻辑验证</span>
            </div>

            <div className={`p-3 rounded mb-4 border ${status.bg} ${status.border}`}>
                <div className={`flex items-center gap-2 font-bold mb-1 ${status.color}`}>
                    <span>{status.icon}</span>
                    <span>{status.label}</span>
                </div>
                <p className="text-sm text-[var(--text-primary)] opacity-90 leading-relaxed">
                    {logic.summary}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs font-medium text-green-400 mb-2">✅ 支撑因素</div>
                    <ul className="space-y-1">
                        {logic.supports.map((s, i) => (
                            <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1">
                                <span className="text-green-500/50">•</span> {s}
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="text-xs font-medium text-red-400 mb-2">⚠️ 风险提示</div>
                    <ul className="space-y-1">
                        {logic.risks.map((s, i) => (
                            <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1">
                                <span className="text-red-500/50">•</span> {s}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}

function SixDimensionsCard({ dimensions }: { dimensions: ConceptDetail['dimensions'] }) {
    if (!dimensions || dimensions.length === 0) return null;
    return (
        <section className="card bg-[var(--bg-secondary)]/30">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">📊 六维度评分</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {dimensions.map((item) => (
                    <ScoreBar key={item.id} label={item.label} score={item.score} color={item.color} />
                ))}
            </div>
        </section>
    );
}

// --- New Component: MarketSentimentTabs ---

function MarketSentimentTabs({ groups }: { groups: ConceptDetail['groups'] }) {
    const [activeTab, setActiveTab] = useState<'leaders' | 'followers' | 'declining'>('leaders');

    if (!groups) return null;

    const leaders = groups.leaders || [];
    const followers = groups.followers || [];
    const declining = groups.declining || [];

    const tabs = [
        { id: 'leaders', label: '🔥 核心龙头', count: leaders.length, color: 'text-orange-400' },
        { id: 'followers', label: '⚡️ 强势跟涨', count: followers.length, color: 'text-yellow-400' },
        { id: 'declining', label: '📉 震荡调整', count: declining.length, color: 'text-blue-400' },
    ];

    const currentStocks = (activeTab === 'leaders' ? leaders : activeTab === 'followers' ? followers : declining);

    return (
        <section className="card p-0 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]/10">
            {/* Tabs Header */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/20">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'leaders' | 'followers' | 'declining')}
                        className={`flex-1 py-3 text-sm font-medium transition-all relative ${activeTab === tab.id
                            ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/30'
                            }`}
                    >
                        <span className={activeTab === tab.id ? tab.color : ''}>{tab.label}</span>
                        <span className="ml-1 text-xs opacity-60">({tab.count})</span>

                        {activeTab === tab.id && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.id === 'leaders' ? 'bg-orange-500' : tab.id === 'followers' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content: Stock List Table */}
            <div className="divide-y divide-[var(--border-color)]">
                {currentStocks.length > 0 ? (
                    currentStocks.map((stock, idx) => (
                        <Link key={stock.code} href={`/stock/${stock.code}`} className="grid grid-cols-4 px-4 py-3 hover:bg-[var(--bg-secondary)]/30 transition-colors items-center">
                            {/* Col 1: Name & Rank */}
                            <div className="col-span-1">
                                <div className="flex items-center gap-2">
                                    {activeTab === 'leaders' && idx < 3 && (
                                        <span className="text-base">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                                    )}
                                    <div>
                                        <div className="text-sm font-medium text-[var(--text-primary)]">{stock.name}</div>
                                        <div className="text-xs text-[var(--text-secondary)]">{stock.code}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Col 2: Price */}
                            <div className="col-span-1 text-right">
                                <div className="text-sm font-mono text-[var(--text-primary)]">{stock.price.toFixed(2)}</div>
                            </div>

                            {/* Col 3: Change */}
                            <div className="col-span-1 text-right">
                                <span className={`inline-block min-w-[60px] text-center px-1.5 py-0.5 rounded text-xs font-bold ${stock.change > 0
                                    ? 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
                                    : stock.change < 0
                                        ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                                        : 'bg-gray-500/10 text-gray-400'
                                    }`}>
                                    {stock.change > 0 ? '+' : ''}{stock.change}%
                                </span>
                            </div>

                            {/* Col 4: Score/Elasticity */}
                            <div className="col-span-1 text-right">
                                <div className="text-xs font-medium text-purple-400">核心 {stock.coreScore || 80}</div>
                                <div className="text-[10px] text-[var(--text-secondary)]">{stock.elasticity || '中性'}</div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                        暂无数据
                    </div>
                )}
            </div>

            {/* Footer / View All */}
            <div className="p-2 text-center border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/10">
                <div className="text-xs text-[var(--text-secondary)] py-1">
                    当前展示 {activeTab === 'leaders' ? '最强龙头' : activeTab === 'followers' ? '中军承接' : '回调观察'} 前排标的
                </div>
            </div>
        </section>
    );
}

// --- Main Page ---

export default function ChainDetailPage() {
    const params = useParams();
    const router = useRouter();
    const chainName = params.name ? decodeURIComponent(params.name as string) : '';

    const [data, setData] = useState<ConceptDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!chainName) return;
        try {
            const res = await fetch(`/api/stock/chain/${encodeURIComponent(chainName)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('实时行业数据加载失败，请稍后重试。');
        } finally {
            setLoading(false);
        }
    }, [chainName]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] p-4 flex items-center justify-center">
                <div className="text-[var(--accent-green)] animate-pulse">深度产业链分析加载中...</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] p-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-sm text-red-400 mb-2">{error || '行业详情暂时不可用'}</div>
                    <button onClick={() => fetchData()} className="btn btn-secondary">重试</button>
                </div>
            </div>
        );
    }

    const overview = data.overview;
    const changeColor = (overview?.sectorChange || 0) >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';
    const sourceLabel = data.dataSource?.sector === 'sector_detail'
        ? '实时板块成分股'
        : data.dataSource?.sector === 'theme_fallback_quotes'
            ? '主题映射实时股价'
            : '当前未拿到实时成分股';

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
                <button onClick={() => router.back()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                    ← <span className="text-sm">返回 {data.name}深度分析</span>
                </button>
                <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">{overview?.stage || '观察期'}</span>
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">{sourceLabel}</span>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">

                {/* Top Price Card */}
                <section className="card bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] border border-[var(--border-color)] p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className={`text-4xl font-bold mb-1 ${changeColor}`}>
                                {(overview?.sectorChange || 0) >= 0 ? '+' : ''}{(overview?.sectorChange || 0).toFixed(2)}%
                            </div>
                            <div className="text-sm text-[var(--text-secondary)]">
                                {data.name}板块即时涨幅
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold mb-1 text-[var(--text-primary)]">
                                {data.count > 0 ? `${overview?.positiveCount || 0}/${data.count}` : '暂无'}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                                {data.count > 0 ? '上涨家数' : '成分股数据'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                        <div className="rounded-lg bg-[var(--bg-secondary)]/40 px-3 py-2">
                            <div className="text-[var(--text-secondary)] mb-1">前排均价</div>
                            <div className="text-[var(--text-primary)] font-semibold">
                                {overview?.leaderAveragePrice ? overview.leaderAveragePrice.toFixed(2) : '--'}
                            </div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-secondary)]/40 px-3 py-2">
                            <div className="text-[var(--text-secondary)] mb-1">平均换手</div>
                            <div className="text-[var(--text-primary)] font-semibold">
                                {(overview?.turnover || 0).toFixed(2)}%
                            </div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-secondary)]/40 px-3 py-2">
                            <div className="text-[var(--text-secondary)] mb-1">龙头强度</div>
                            <div className="text-[var(--text-primary)] font-semibold">
                                {(overview?.leaderTurnoverRatio || 1).toFixed(2)}x
                            </div>
                        </div>
                    </div>
                    {/* Stage Bar */}
                    <div className="mt-4 flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-green-500 text-black font-bold rounded">{overview?.stage || '观察期'}</span>
                        <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${overview?.confidence || 0}%` }}></div>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">置信度 {overview?.confidence || 0}%</span>
                    </div>
                </section>

                {data.count === 0 && (
                    <section className="card border border-yellow-500/20 bg-yellow-500/5">
                        <div className="text-sm font-medium text-yellow-300 mb-1">当前未拿到实时成分股</div>
                        <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            这个页面已经不再填充 mock 数据。若数据源暂时不可用，会明确保留空态和观察结论；等数据源恢复后，成分股、结构拆解和情绪分组会自动更新为真实数据。
                        </div>
                    </section>
                )}

                {/* Logic Verification */}
                <LogicCard logic={data.logic} />

                {/* Six Dimensions */}
                <SixDimensionsCard dimensions={data.dimensions} />

                {/* 新闻证据 */}
                {data.news && data.news.length > 0 && (
                    <section className="card border border-[var(--border-color)] bg-[var(--bg-secondary)]/20">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-[var(--text-primary)]">📰 新闻证据</span>
                        </div>
                        <div className="space-y-2">
                            {data.news.map((item, idx) => (
                                <div key={`${item.title}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)]/40 p-3">
                                    <div className="text-sm text-[var(--text-primary)] leading-relaxed">{item.title}</div>
                                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{item.source} · {item.time || '实时'}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 板块结构分析 */}
                {data.chainStructure && data.chainStructure.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-[var(--text-secondary)]">🔗 板块结构分析</span>
                        </div>

                        {/* Iterating Segments */}
                        {data.chainStructure.map((segment, idx) => {
                            const isHighlight = segment.tag === '当前最优布局点';
                            return (
                                <div key={idx} className={`card border ${isHighlight ? 'border-orange-500/50 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden' : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/10'}`}>
                                    {isHighlight && (
                                        <div className="absolute top-0 right-0 bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded-bl">
                                            🔥 重点关注
                                        </div>
                                    )}
                                    {/* Segment Header */}
                                    <div className={`flex items-center justify-between mb-3 border-b ${isHighlight ? 'border-orange-500/20' : 'border-[var(--border-color)]'} pb-2`}>
                                        <div className="flex items-center gap-2">
                                            <h3 className={`text-base font-bold ${isHighlight ? 'text-orange-400' : 'text-[var(--text-primary)]'}`}>{segment.segment}</h3>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isHighlight ? 'bg-orange-500 text-black font-bold' : 'bg-green-500/20 text-green-400'}`}>
                                                {segment.tag || '布局点'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-[var(--text-secondary)]">{segment.stage}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs mb-4">
                                        <span className="text-[var(--text-secondary)]">受益程度:</span>
                                        <StarRating level={segment.benefitLevel} />
                                    </div>

                                    {/* Stock List in Segment */}
                                    <div className="space-y-2">
                                        {segment.stocks.map((stock, sIdx) => (
                                            <Link key={stock.code} href={`/stock/${stock.code}`} className="block bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] rounded-lg p-3 transition-colors border border-transparent hover:border-[var(--border-color)]">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {/* Rank Icon */}
                                                        <div className="w-5 flex justify-center">
                                                            {stock.rank === 1 && <span className="text-lg">🥇</span>}
                                                            {stock.rank === 2 && <span className="text-lg">🥈</span>}
                                                            {stock.rank === 3 && <span className="text-lg">🥉</span>}
                                                            {(!stock.rank || stock.rank > 3) && <span className="text-xs text-[var(--text-secondary)]">{sIdx + 1}</span>}
                                                        </div>

                                                        <div>
                                                            <div className="text-sm font-bold text-[var(--text-primary)]">{stock.name}</div>
                                                            <div className="text-xs text-[var(--text-secondary)]">{stock.code}</div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="text-xs font-medium text-green-400 mb-1">
                                                            核心度 {stock.coreScore || 80}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--text-secondary)]">
                                                            弹性 {stock.elasticity || '中性'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                )}

                {/* Unified Market Sentiment Tabs */}
                {data.groups && (
                    <div className="mt-6 pt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-[var(--text-secondary)]">📊 市场情绪看板</span>
                        </div>
                        <MarketSentimentTabs groups={data.groups} />
                    </div>
                )}

                {data.dataSource && (
                    <section className="card border border-[var(--border-color)] bg-[var(--bg-secondary)]/20">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-2">数据说明</div>
                        <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            当前页面使用的是
                            <span className="text-[var(--text-primary)]"> {sourceLabel} </span>
                            生成的结构分析，不再使用前端 mock 占位值。
                            {data.dataSource.hotSectorMatched && data.dataSource.matchedSectorName ? ` 已命中实时热板块：${data.dataSource.matchedSectorName}。` : ' 当前未命中热板块榜单，逻辑以成分股分布为主。'}
                        </div>
                    </section>
                )}

            </main>
        </div>
    );
}
