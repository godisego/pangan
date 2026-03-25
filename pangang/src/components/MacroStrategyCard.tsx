'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { stockApi, macroApi } from '@/lib/api';
import type { MacroDashboard, TrendingItem, StockSignal, SelectionData } from '@/types/api';

// --- Interfaces ---
// MacroDashboard 类型已从 @/types/api 导入
// --- Sub Components ---

function CatalystStrengthTag({ strength }: { strength: string }) {
    const config: Record<string, { label: string; cls: string }> = {
        Strong: { label: '🔥 强催化', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
        Medium: { label: '⚡ 中催化', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
        Weak: { label: '📍 观察期', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    };
    const { label, cls } = config[strength] || config.Weak;
    return <span className={`px-1.5 py-0.5 rounded text-[10px] border ${cls} whitespace-nowrap`}>{label}</span>;
}

function CatalystLevelIcon({ level }: { level?: string }) {
    if (level === 'strong') return <span className="text-red-400" title="强催化">🔥</span>;
    if (level === 'medium') return <span className="text-orange-400" title="中催化">⚡</span>;
    if (level === 'weak') return <span className="text-blue-300" title="观察期">📍</span>;
    return null;
}

function SignalRow({ signal }: { signal: StockSignal }) {
    const change = Number(signal.change) || 0;
    return (
        <Link href={`/chain/${encodeURIComponent(signal.name)}`} className="block">
            <div className="px-3 py-2.5 flex items-center justify-between hover:bg-[var(--bg-secondary)]/30 transition-colors cursor-pointer border-b border-[var(--border-color)] last:border-b-0">
                <div className="flex items-center gap-2">
                    {signal.catalystLevel && signal.catalystLevel !== 'none' && (
                        <CatalystLevelIcon level={signal.catalystLevel} />
                    )}
                    <span className="text-sm font-medium text-[var(--text-primary)]">{signal.name}</span>
                    {signal.volume && (
                        <span className="text-[10px] text-[var(--text-secondary)]">{signal.volume}</span>
                    )}
                    {signal.recommendation && (
                        <span className="text-[10px] text-[var(--text-secondary)]">{signal.recommendation}</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">换手 {signal.turnover}%</span>
                    <span className={`text-sm font-mono font-medium ${change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                        {change >= 0 ? '+' : ''}{Number(change).toFixed(2)}%
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">→</span>
                </div>
            </div>
        </Link>
    );
}

// --- Skeleton Components ---

function SkeletonPulse({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-[var(--bg-secondary)]/50 rounded ${className}`} />;
}

function MacroSkeleton() {
    return (
        <div className="space-y-3">
            <SkeletonPulse className="h-4 w-32" />
            <SkeletonPulse className="h-16 w-full rounded-lg" />
        </div>
    );
}

function TrendingSkeleton() {
    return (
        <div className="rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-secondary)]/10">
            <div className="px-3 py-2 bg-[var(--bg-secondary)]/20 border-b border-[var(--border-color)]">
                <SkeletonPulse className="h-3.5 w-20 inline-block" />
            </div>
            <div className="divide-y divide-[var(--border-color)]">
                {[1, 2, 3].map(i => (
                    <div key={i} className="px-3 py-2.5 flex items-start gap-2">
                        <SkeletonPulse className="h-3.5 w-3.5 rounded-full shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1.5">
                            <SkeletonPulse className="h-4 w-full" />
                            <SkeletonPulse className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DefenseSkeleton() {
    return (
        <div className="space-y-2 mt-2">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-[var(--bg-secondary)]/30 rounded p-2.5 flex items-center gap-2">
                    <SkeletonPulse className="h-4 w-4 rounded shrink-0" />
                    <SkeletonPulse className="h-4 w-32" />
                </div>
            ))}
        </div>
    );
}

// --- Helper ---
function formatRelativeTime(timeStr: string): string {
    if (!timeStr) return '';
    try {
        const date = new Date(timeStr.replace(/(\d{4}-\d{2}-\d{2})\s/, '$1T'));
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        if (isNaN(diffMs) || diffMs < 0) return '';
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return '刚刚';
        if (diffMin < 60) return `${diffMin}分钟前`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour}小时前`;
        return `${Math.floor(diffHour / 24)}天前`;
    } catch {
        return '';
    }
}

// --- Main Component ---

export default function MacroStrategyDashboard({ className = "" }: { className?: string }) {
    // 三路独立数据状态
    const [macroData, setMacroData] = useState<MacroDashboard | null>(null);
    const [stockData, setStockData] = useState<SelectionData>({ volumePriceSynergy: [], watchList: [] });
    const [trendingData, setTrendingData] = useState<TrendingItem[]>([]);

    const [macroLoading, setMacroLoading] = useState(true);
    const [stockLoading, setStockLoading] = useState(true);
    const [trendingLoading, setTrendingLoading] = useState(true);

    const [macroError, setMacroError] = useState(false);
    const [macroElapsed, setMacroElapsed] = useState(0); // 已等待秒数

    const macroStartRef = useRef<number>(Date.now());
    const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // --- 1. 量价齐升（3s 轮询，最快到达） ---
    useEffect(() => {
        const fetchStocks = async () => {
            try {
                const json = await stockApi.getSelection();
                if (json.volumePriceSynergy || json.watchList) {
                    setStockData(json);
                }
                setStockLoading(false);
            } catch (err) {
                console.error('Failed to fetch stock selection:', err);
                setStockLoading(false);
            }
        };
        fetchStocks();
        const interval = setInterval(fetchStocks, 3000);
        return () => clearInterval(interval);
    }, []);

    // --- 2. 舆情热搜（独立轻量请求，5s 级响应） ---
    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const json = await macroApi.getTrending();
                if (json.trending) {
                    setTrendingData(json.trending);
                }
                setTrendingLoading(false);
            } catch (err) {
                console.error('Failed to fetch trending:', err);
                setTrendingLoading(false);
            }
        };
        fetchTrending();
        // 舆情 2 分钟刷新一次
        const interval = setInterval(fetchTrending, 120000);
        return () => clearInterval(interval);
    }, []);

    // --- 3. AI 宏观分析（最慢，60-120s） ---
    const fetchMacro = useCallback(async () => {
        setMacroLoading(true);
        setMacroError(false);
        macroStartRef.current = Date.now();
        setMacroElapsed(0);

        // 启动倒计时
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = setInterval(() => {
            setMacroElapsed(Math.floor((Date.now() - macroStartRef.current) / 1000));
        }, 1000);

        try {
            const json = await macroApi.getDashboard();
            setMacroData(json);
            // 如果 AI 分析返回了 trending，覆盖独立请求的数据
            if (json.trending && json.trending.length > 0) {
                setTrendingData(json.trending);
            }
            setMacroLoading(false);
        } catch (err) {
            console.error('Failed to fetch macro dashboard:', err);
            setMacroError(true);
            setMacroLoading(false);
        } finally {
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        }
    }, []);

    useEffect(() => {
        fetchMacro();
        const interval = setInterval(fetchMacro, 300000);
        return () => {
            clearInterval(interval);
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        };
    }, [fetchMacro]);

    // --- 主题色计算 ---
    const getTheme = () => {
        if (!macroData) return 'indigo';
        const score = macroData.macro_mainline.score;
        if (score >= 7) return 'red';
        if (score <= 4) return 'slate';
        return 'indigo';
    };
    const theme = getTheme();

    const themeStyles = {
        red: {
            bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/20',
            gradFrom: 'from-red-500/5', ring: 'ring-red-500/10', borderLeft: 'border-red-500/50',
        },
        slate: {
            bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500/20',
            gradFrom: 'from-slate-500/5', ring: 'ring-slate-500/10', borderLeft: 'border-slate-500/50',
        },
        indigo: {
            bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/20',
            gradFrom: 'from-indigo-500/5', ring: 'ring-indigo-500/10', borderLeft: 'border-indigo-500/50',
        },
    };
    const ts = themeStyles[theme];

    const score = macroData?.macro_mainline?.score ?? 0;

    // === ALWAYS RENDER — 渐进式布局 ===
    return (
        <div className={`space-y-4 ${className}`}>
            {/* === 模块标题 === */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🏛️</span>
                    <span className="font-semibold text-[var(--text-primary)]">宏观战略仪表盘</span>
                </div>
                <div className="flex items-center gap-2">
                    {macroData?.confidence_score && (
                        <span className="text-[10px] px-1.5 rounded bg-white/5 text-[var(--text-secondary)] border border-white/10">
                            AI置信度: {macroData.confidence_score === 'High' ? '高' : '中'}
                        </span>
                    )}
                    {macroData ? (
                        <span className={`text-xs px-2 py-0.5 rounded ${ts.bg}/20 ${ts.text} font-medium`}>
                            评分 {score}/10
                        </span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium animate-pulse">
                            分析中...
                        </span>
                    )}
                </div>
            </div>

            {/* === 三层金字塔 === */}
            <div className={`p-4 space-y-5 rounded-lg bg-gradient-to-b ${ts.gradFrom} to-transparent border ${ts.border}`}>

                {/* 🔺 顶层：宏观主线 */}
                <div className={`relative pl-4 border-l-2 ${ts.borderLeft}`}>
                    <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ${ts.bg} ring-4 ${ts.ring}`} />
                    {macroData ? (
                        <>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-mono text-[var(--text-secondary)]">🔺 顶层：宏观主线 (3-12M)</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    周期：{macroData.macro_mainline.cycle_stage}
                                </span>
                            </div>
                            <div className="bg-[var(--bg-secondary)]/50 rounded p-3 backdrop-blur-sm animate-fadeIn">
                                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                    {macroData.macro_mainline.narrative}
                                </p>
                            </div>
                        </>
                    ) : macroError ? (
                        <div className="space-y-2">
                            <span className="text-xs font-mono text-[var(--text-secondary)]">🔺 顶层：宏观主线 (3-12M)</span>
                            <div className="bg-[var(--bg-secondary)]/30 rounded p-3 flex items-center justify-between">
                                <span className="text-sm text-[var(--text-secondary)]">⚠️ 分析加载失败</span>
                                <button
                                    onClick={fetchMacro}
                                    className="px-3 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30 transition-colors"
                                >
                                    🔄 重试
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-mono text-[var(--text-secondary)]">🔺 顶层：宏观主线 (3-12M)</span>
                                <span className="text-[10px] text-[var(--text-secondary)] animate-pulse">
                                    🧠 AI 分析中... {macroElapsed > 0 ? `(${macroElapsed}s)` : ''}
                                </span>
                            </div>
                            <div className="bg-[var(--bg-secondary)]/30 rounded p-3 space-y-2">
                                <SkeletonPulse className="h-4 w-full" />
                                <SkeletonPulse className="h-4 w-3/4" />
                            </div>
                        </div>
                    )}
                </div>

                {/* ⚡ 中层：催化信号 + 量价齐升 */}
                <div className="relative pl-4 border-l-2 border-orange-500/50">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500 ring-4 ring-orange-500/10" />
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-[var(--text-secondary)]">⚡ 中层：催化信号 + 量价齐升 (1-5D)</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-green)]/20 text-[var(--accent-green)]">
                            实时·3s刷新
                        </span>
                    </div>

                    {/* AI 催化事件 */}
                    {macroData?.catalysts && macroData.catalysts.length > 0 ? (
                        <div className="space-y-2 mb-3 animate-fadeIn">
                            {macroData.catalysts.map((cat, idx) => (
                                <div key={idx} className="flex items-start gap-3 bg-[var(--bg-secondary)]/30 rounded p-2.5 text-sm">
                                    <CatalystStrengthTag strength={cat.strength} />
                                    <div>
                                        <span className="text-[var(--text-primary)] font-medium mr-2">{cat.sector}</span>
                                        <span className="text-[var(--text-secondary)] text-xs">{cat.event}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : macroLoading ? (
                        <div className="space-y-2 mb-3">
                            {[1, 2].map(i => (
                                <div key={i} className="flex items-center gap-3 bg-[var(--bg-secondary)]/20 rounded p-2.5">
                                    <SkeletonPulse className="h-5 w-16 rounded" />
                                    <SkeletonPulse className="h-4 w-48" />
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* 量价齐升板块列表 — 立即渲染 */}
                    <div className="rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-secondary)]/10">
                        <div className="px-3 py-2 bg-[var(--bg-secondary)]/30 border-b border-[var(--border-color)] flex items-center justify-between">
                            <span className="text-xs font-medium text-orange-400">🔥 量价齐升方向</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                                {stockData.volumePriceSynergy.length} 个板块量价共振
                            </span>
                        </div>
                        {stockLoading && stockData.volumePriceSynergy.length === 0 ? (
                            <div className="p-6 text-center text-[var(--text-secondary)] text-sm animate-pulse">
                                加载量价信号...
                            </div>
                        ) : stockData.volumePriceSynergy.length > 0 ? (
                            stockData.volumePriceSynergy.map((signal) => (
                                <SignalRow key={signal.id || signal.name} signal={signal} />
                            ))
                        ) : (
                            <div className="p-6 text-center text-[var(--text-secondary)] text-sm">
                                暂无量价齐升信号
                            </div>
                        )}
                    </div>

                    {/* 其他关注（非量价齐升） */}
                    {stockData.watchList.length > 0 && (
                        <div className="mt-3 rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-secondary)]/5">
                            <div className="px-3 py-2 bg-[var(--bg-secondary)]/20 border-b border-[var(--border-color)]">
                                <span className="text-xs text-[var(--text-secondary)]">👀 其他关注（涨价但量能不足）</span>
                            </div>
                            {stockData.watchList.map((signal) => (
                                <SignalRow key={signal.id || signal.name} signal={signal} />
                            ))}
                        </div>
                    )}
                </div>

                {/* 🛡️ 底层：防守/补涨 */}
                <div className="relative pl-4 border-l-2 border-emerald-500/50">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                    <span className="text-xs font-mono text-[var(--text-secondary)]">🛡️ 底层：防守/补涨</span>
                    {macroData?.defense?.sectors && macroData.defense.sectors.length > 0 ? (
                        <div className="mt-2 space-y-2 animate-fadeIn">
                            {(() => {
                                const reasonParts = (macroData.defense.reason || '').split(' | ');
                                const reasonMap: Record<string, string> = {};
                                for (const part of reasonParts) {
                                    const colonIdx = part.indexOf(': ');
                                    if (colonIdx > 0) {
                                        reasonMap[part.substring(0, colonIdx)] = part.substring(colonIdx + 2);
                                    }
                                }
                                return macroData.defense.sectors.map((sec, idx) => (
                                    <div key={idx} className="bg-[var(--bg-secondary)]/30 rounded p-2.5 flex items-start gap-2">
                                        <span className="text-emerald-400 text-sm">🛡️</span>
                                        <div>
                                            <span className="text-sm font-medium text-emerald-400">{sec}</span>
                                            {reasonMap[sec] && (
                                                <span className="text-xs text-[var(--text-secondary)] ml-2">{reasonMap[sec]}</span>
                                            )}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    ) : macroLoading ? (
                        <DefenseSkeleton />
                    ) : (
                        <div className="mt-2 text-xs text-[var(--text-secondary)]">无防守配置建议</div>
                    )}
                </div>
            </div>

            {/* === 📰 市场热议（独立加载，不受 AI 分析阻塞） === */}
            {trendingLoading ? (
                <TrendingSkeleton />
            ) : trendingData.length > 0 ? (
                <div className="rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-secondary)]/10 animate-fadeIn">
                    <div className="px-3 py-2 bg-[var(--bg-secondary)]/20 border-b border-[var(--border-color)]">
                        <span className="text-xs font-medium text-[var(--text-primary)]">📰 市场热议</span>
                        <span className="text-[10px] text-[var(--text-secondary)] ml-2">实时舆情</span>
                    </div>
                    <div className="divide-y divide-[var(--border-color)]">
                        {trendingData.map((item, idx) => {
                            const heatIcon = item.heat_score >= 70 ? '🔴' : item.heat_score >= 55 ? '🟡' : '🔵';
                            const timeStr = formatRelativeTime(item.time);
                            const content = (
                                <div key={idx} className={`px-3 py-2.5 flex items-start gap-2 ${item.url ? 'hover:bg-[var(--bg-secondary)]/30 cursor-pointer transition-colors' : ''}`}>
                                    <span className="text-xs mt-0.5 shrink-0">{heatIcon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[var(--text-primary)] leading-snug line-clamp-2">{item.title}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[10px] text-[var(--text-secondary)]">{item.source}</span>
                                            {timeStr && <span className="text-[10px] text-[var(--text-secondary)]">{timeStr}</span>}
                                            {item.tags && item.tags.map((tag, ti) => (
                                                <span key={ti} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {item.url && <span className="text-[10px] text-[var(--text-secondary)] shrink-0 mt-1">→</span>}
                                </div>
                            );
                            return item.url ? (
                                <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className="block">{content}</a>
                            ) : content;
                        })}
                    </div>
                </div>
            ) : null}

            {/* === 操作建议 === */}
            {macroData ? (
                <div className={`p-3 rounded-lg border ${ts.border} bg-[var(--bg-secondary)]/20 flex items-start gap-3 animate-fadeIn`}>
                    <span className="text-lg">💡</span>
                    <div>
                        <div className={`text-xs ${ts.text} mb-0.5`}>操作建议</div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                            {macroData.operational_logic}
                        </p>
                    </div>
                </div>
            ) : macroError ? (
                <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <span className="text-sm text-[var(--text-secondary)]">AI 分析暂不可用</span>
                    </div>
                    <button
                        onClick={fetchMacro}
                        className="px-3 py-1.5 text-xs bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors flex items-center gap-1"
                    >
                        🔄 重新分析
                    </button>
                </div>
            ) : (
                <div className="p-3 rounded-lg border border-indigo-500/20 bg-[var(--bg-secondary)]/20 flex items-center gap-3">
                    <span className="text-lg animate-pulse">🧠</span>
                    <div className="flex-1">
                        <div className="text-xs text-indigo-400 mb-0.5">操作建议</div>
                        <div className="flex items-center gap-2">
                            <SkeletonPulse className="h-4 w-3/4" />
                            {macroElapsed > 15 && (
                                <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                                    已等待 {macroElapsed}s
                                    {macroElapsed > 45 && (
                                        <button onClick={fetchMacro} className="ml-2 text-indigo-400 hover:underline">重试</button>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 时间戳 */}
            <div className="text-center">
                <span className="text-[10px] text-[var(--text-secondary)] opacity-50">
                    AI驱动 · 三层金字塔模型 · {macroData ? new Date(macroData.timestamp || Date.now()).toLocaleString() : '加载中...'} 更新
                </span>
            </div>
        </div>
    );
}
