"use client";

import { useState, useEffect } from 'react';
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

interface ConceptDetail {
    name: string;
    count: number;
    avgChange: number;
    price?: number;
    volumeMultiplier?: number;
    chainStructure?: ChainSegment[]; // New structured data
    groups?: {
        leaders: Stock[];
        followers: Stock[];
        declining: Stock[];
    };
    // Extra AI Analysis fields
    logic?: {
        status: 'valid' | 'invalid' | 'neutral';
        summary: string;
        supports: string[];
        risks: string[];
    };
    scores?: {
        technical: number;
        capital: number;
        inventory: number;
        macro: number;
        supply: number;
        demand: number;
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
        valid: { color: 'text-green-400', bg: 'bg-green-500/10', icon: '✅', label: '逻辑成立' },
        invalid: { color: 'text-red-400', bg: 'bg-red-500/10', icon: '❌', label: '逻辑证伪' },
        neutral: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: '⏳', label: '观察中' },
    };
    const status = statusConfig[logic.status];

    return (
        <section className="card border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">💡 逻辑验证</span>
            </div>

            <div className={`p-3 rounded mb-4 ${status.bg} border border-${status.color}/20`}>
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

function SixDimensionsCard({ scores }: { scores: ConceptDetail['scores'] }) {
    if (!scores) return null;
    return (
        <section className="card bg-[var(--bg-secondary)]/30">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">📊 六维度评分</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <ScoreBar label="技术面" score={scores.technical} color="bg-blue-500" />
                <ScoreBar label="量价关系" score={scores.capital} color="bg-orange-500" />
                <ScoreBar label="库存/基差" score={scores.inventory} color="bg-purple-500" />
                <ScoreBar label="宏观环境" score={scores.macro} color="bg-yellow-500" />
                <ScoreBar label="上游供给" score={scores.supply} color="bg-cyan-500" />
                <ScoreBar label="下游需求" score={scores.demand} color="bg-pink-500" />
            </div>
        </section>
    );
}

function StockListModule({ title, stocks, icon }: { title: string; stocks: Stock[]; icon: string }) {
    if (!stocks || stocks.length === 0) return null;

    return (
        <section>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                {icon} {title}
                <span className="text-xs text-[var(--text-secondary)] font-normal">({stocks.length})</span>
            </h3>
            <div className="space-y-2">
                {stocks.map((stock, i) => (
                    <Link key={stock.code} href={`/stock/${stock.code}`} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
                        <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{stock.name}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{stock.code}</div>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-bold ${stock.change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {stock.change >= 0 ? '+' : ''}{stock.change}%
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">核心度 {stock.coreScore || '-'}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
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
                        onClick={() => setActiveTab(tab.id as any)}
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
                <button className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1 w-full py-1">
                    查看全部 {activeTab === 'leaders' ? '龙头' : activeTab === 'followers' ? '跟涨' : '调整'}标的 →
                </button>
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

    const fetchData = async () => {
        if (!chainName) return;
        try {
            const res = await fetch(`http://localhost:8000/api/stock/chain/${encodeURIComponent(chainName)}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();

            // Inject Mock AI Analysis & Fallback Logic if missing
            if (!json.logic) {
                if (chainName.includes("光模块") || chainName.includes("AI")) {
                    json.logic = {
                        status: 'valid',
                        summary: 'AI大模型参数量指数级增长，算力需求倒逼光通信带宽升级，800G/1.6T光模块处于供不应求状态，行业景气度持续向上。',
                        supports: ['北美云厂商资本开支增加', '国产光模块全球份额领先', '硅光技术渗透率提升'],
                        risks: ['下游砍单风险', '技术路线迭代过快', '贸易摩擦加剧']
                    };
                    json.scores = { technical: 85, capital: 90, inventory: 70, macro: 60, supply: 65, demand: 95 };
                    json.price = 2854.32;
                    json.volumeMultiplier = 2.1;
                } else {
                    json.logic = {
                        status: 'neutral',
                        summary: '当前板块处于震荡整理期，基本面暂无重大变化，等待右侧突破信号。',
                        supports: ['估值处于低位', '政策预期改善'],
                        risks: ['需求复苏不及预期', '流动性收紧']
                    };
                    json.scores = { technical: 45, capital: 50, inventory: 50, macro: 50, supply: 50, demand: 50 };
                    json.price = 1000.00;
                    json.volumeMultiplier = 1.0;
                }
            }

            // Fallback for chainStructure (上中下游) if missing or empty
            if (!json.chainStructure || json.chainStructure.length === 0) {
                json.chainStructure = [
                    {
                        segment: "上游 · 核心器件",
                        tag: "技术壁垒",
                        stage: "成熟期",
                        benefitLevel: 4,
                        stocks: json.stocks?.slice(0, 3).map((s: Stock, i: number) => ({ ...s, rank: i + 1, coreScore: 85 - i * 5, elasticity: "高弹性" })) || []
                    },
                    {
                        segment: "中游 · 设备制造",
                        tag: "当前最优布局点",
                        stage: "启动期",
                        benefitLevel: 5,
                        stocks: json.stocks?.slice(3, 6).map((s: Stock, i: number) => ({ ...s, rank: i + 1, coreScore: 90 - i * 3, elasticity: "极高" })) || []
                    },
                    {
                        segment: "下游 · 应用场景",
                        tag: "需求驱动",
                        stage: "渗透期",
                        benefitLevel: 3,
                        stocks: json.stocks?.slice(6, 9).map((s: Stock, i: number) => ({ ...s, rank: i + 1, coreScore: 75 - i * 5, elasticity: "中性" })) || []
                    }
                ];
            }

            // Fallback for groups (市场情绪看板) if missing or empty
            if (!json.groups || Object.keys(json.groups).length === 0 ||
                (!json.groups.leaders?.length && !json.groups.followers?.length && !json.groups.declining?.length)) {
                const allStocks = json.stocks || [];
                const sorted = [...allStocks].sort((a: Stock, b: Stock) => b.change - a.change);
                json.groups = {
                    leaders: sorted.filter((s: Stock) => s.change > 5).slice(0, 5).map((s: Stock) => ({ ...s, coreScore: 90, elasticity: "高弹性" })),
                    followers: sorted.filter((s: Stock) => s.change >= 0 && s.change <= 5).slice(0, 5).map((s: Stock) => ({ ...s, coreScore: 70, elasticity: "中性" })),
                    declining: sorted.filter((s: Stock) => s.change < 0).slice(0, 5).map((s: Stock) => ({ ...s, coreScore: 50, elasticity: "防守" }))
                };
            }

            setData(json);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [chainName]);

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] p-4 flex items-center justify-center">
                <div className="text-[var(--accent-green)] animate-pulse">深度产业链分析加载中...</div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
                <button onClick={() => router.back()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                    ← <span className="text-sm">返回 {data.name}产业链</span>
                </button>
                <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">🔥 量价齐升</span>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">✅ 长期趋势</span>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">

                {/* Top Price Card */}
                <section className="card bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] border border-[var(--border-color)] p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className={`text-4xl font-bold mb-1 ${data.avgChange >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {data.price?.toLocaleString()}
                            </div>
                            <div className="text-sm text-[var(--text-secondary)]">
                                {data.name}现货价
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-xl font-bold mb-1 ${data.avgChange >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                +{data.avgChange}%/月
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                                量能 {data.volumeMultiplier}倍
                            </div>
                        </div>
                    </div>
                    {/* Stage Bar */}
                    <div className="mt-4 flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-green-500 text-black font-bold rounded">启动期</span>
                        <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 w-[78%]"></div>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">置信度 78%</span>
                    </div>
                </section>

                {/* Logic Verification */}
                <LogicCard logic={data.logic} />

                {/* Six Dimensions */}
                <SixDimensionsCard scores={data.scores} />

                {/* 🔗 Industry Chain Analysis (1:1 Restoration) */}
                {data.chainStructure && data.chainStructure.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-[var(--text-secondary)]">🔗 产业链分析</span>
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

            </main>
        </div>
    );
}
