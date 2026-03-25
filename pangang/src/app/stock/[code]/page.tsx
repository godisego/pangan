'use client';

import Link from 'next/link';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 模拟股票数据
interface FinancialData {
    revenue: string;
    revenue_yoy: number;
    net_profit: string;
    net_profit_yoy: number;
    roe: number;
    gross_margin: number;
    report_date: string;
}

interface FundFlowData {
    main_net_5d: number;
    main_net_today: number;
    retail_net_today: number;
    main_pct: number;
    history: { date: string; main_net: number; retail_net: number }[];
}

// 实盘数据接口
interface StockDetailData {
    code: string;
    name: string;
    price: number;
    change: number;
    changeAmount: number;
    industry: string;
    metrics: {
        pe: number;
        pb: number;
        marketCap: string;
        roe: number;
        dividend: number;
    };
}
const mockStockData: Record<string, {
    code: string;
    name: string;
    price: number;
    change: number;
    changeAmount: number;
    industry: string;
    concept: string[];
    coreScore: number;
    // 基本面指标
    metrics: {
        pe: number;
        pb: number;
        marketCap: string;
        dividend: number;
        roe: number;
        revenueGrowth: number;
        profitGrowth: number;
    };
    // 多维度AI分析
    aiAnalysis: {
        // 财报分析
        financialReport: {
            annual: string;
            quarterly: string;
            trend: 'up' | 'down' | 'stable';
            lastUpdate: string;
        };
        // 消息面
        news: {
            sentiment: 'positive' | 'negative' | 'neutral';
            summary: string;
            keyEvents: string[];
            lastUpdate: string;
        };
        // 资金面
        capital: {
            northFlow: string;
            institutionHolding: string;
            trend: 'inflow' | 'outflow' | 'stable';
        };
        // 技术面
        technical: {
            position: string;
            support: number;
            resistance: number;
            signals: string[];
        };
        // 产业链位置
        chainPosition: {
            chain: string;
            position: string;
            benefitLevel: number;
            stage: string;
        };
        // 综合评分
        overallScore: number;
        recommendation: string;
        risks: string[];
    };
}> = {
    '002466': {
        code: '002466',
        name: '天齐锂业',
        price: 52.30,
        change: 3.2,
        changeAmount: 1.62,
        industry: '有色金属',
        concept: ['锂矿', '新能源', '碳中和'],
        coreScore: 95,
        metrics: {
            pe: 15.2,
            pb: 2.8,
            marketCap: '868亿',
            dividend: 0.8,
            roe: 18.5,
            revenueGrowth: 25,
            profitGrowth: 32,
        },
        aiAnalysis: {
            financialReport: {
                annual: '2024年报显示营收同比+25%，净利润+32%，锂盐产能持续释放，澳洲矿山贡献增量。毛利率维持45%高位。',
                quarterly: 'Q3季报超预期，单季净利润环比+18%，锂价企稳后量增逻辑兑现。在手订单充足，Q4指引乐观。',
                trend: 'up',
                lastUpdate: '2024-10-28',
            },
            news: {
                sentiment: 'positive',
                summary: '近期消息面偏积极，锂价止跌回升提振市场信心，公司澳洲Greenbushes矿扩产项目顺利推进。',
                keyEvents: [
                    '🔥 碳酸锂价格突破10万/吨，较底部回升20%',
                    '✅ Greenbushes矿四期扩产获批，预计2025年投产',
                    '📊 机构上调盈利预测，多家给予"买入"评级',
                ],
                lastUpdate: '2024-01-30',
            },
            capital: {
                northFlow: '近20日净流入12.5亿',
                institutionHolding: '机构持仓占比38%，较上季+2.5%',
                trend: 'inflow',
            },
            technical: {
                position: '站上60日均线，多头排列形成',
                support: 48.5,
                resistance: 58.0,
                signals: ['MACD金叉', 'RSI 62适中', '量能温和放大'],
            },
            chainPosition: {
                chain: '碳酸锂',
                position: '上游（锂矿）',
                benefitLevel: 5,
                stage: 'start',
            },
            overallScore: 88,
            recommendation: '碳酸锂涨价启动期，作为上游锂矿龙头直接受益，当前估值合理，建议关注。',
            risks: ['锂价上涨持续性待验证', '澳洲矿山政策风险', '下游需求不及预期'],
        },
    },
    '688981': {
        code: '688981',
        name: '中芯国际',
        price: 85.60,
        change: 2.8,
        changeAmount: 2.33,
        industry: '半导体',
        concept: ['芯片制造', '国产替代', 'AI算力'],
        coreScore: 75,
        metrics: {
            pe: 45.2,
            pb: 2.1,
            marketCap: '6800亿',
            dividend: 0,
            roe: 8.5,
            revenueGrowth: 15,
            profitGrowth: -12,
        },
        aiAnalysis: {
            financialReport: {
                annual: '2024年报营收同比+15%，但净利润-12%，主要受折旧及研发投入增加影响。产能利用率回升至85%。',
                quarterly: 'Q3产能利用率提升带动毛利率改善，AI相关订单占比提升至20%，本土客户贡献增量。',
                trend: 'stable',
                lastUpdate: '2024-10-28',
            },
            news: {
                sentiment: 'positive',
                summary: 'AI算力需求带动成熟制程订单回暖，国产替代持续受益，但需关注美国制裁升级风险。',
                keyEvents: [
                    '🔥 14nm产能满载，AI芯片代工订单排队',
                    '⚠️ 美国拟扩大对华芯片设备限制',
                    '✅ 上海新厂产能逐步释放',
                ],
                lastUpdate: '2024-01-29',
            },
            capital: {
                northFlow: '近20日净流入8.2亿',
                institutionHolding: '机构持仓占比25%，较上季+1.2%',
                trend: 'inflow',
            },
            technical: {
                position: '震荡整理，等待突破',
                support: 78.0,
                resistance: 92.0,
                signals: ['RSI 55中性', '缩量整理', '等待方向选择'],
            },
            chainPosition: {
                chain: 'AI算力',
                position: '上游（晶圆代工）',
                benefitLevel: 4,
                stage: 'accelerate',
            },
            overallScore: 72,
            recommendation: 'AI算力受益标的，但估值偏高，建议等待回调或突破后介入。',
            risks: ['制裁升级风险', '估值偏高', '利润率承压'],
        },
    },
    '300308': {
        code: '300308',
        name: '中际旭创',
        price: 128.50,
        change: 5.2,
        changeAmount: 6.35,
        industry: '通信设备',
        concept: ['光模块', 'AI算力', '数据中心'],
        coreScore: 92,
        metrics: {
            pe: 28.5,
            pb: 6.2,
            marketCap: '1280亿',
            dividend: 0.5,
            roe: 22.5,
            revenueGrowth: 85,
            profitGrowth: 120,
        },
        aiAnalysis: {
            financialReport: {
                annual: '2024年报业绩爆发，营收同比+85%，净利润+120%。800G光模块出货量全球第一，1.6T产品开始放量。',
                quarterly: 'Q3业绩超预期，单季净利润15亿+，环比+25%。北美大客户订单持续增加，明年指引乐观。',
                trend: 'up',
                lastUpdate: '2024-10-28',
            },
            news: {
                sentiment: 'positive',
                summary: 'AI算力需求持续超预期，光模块景气度高企，公司800G/1.6T产品技术领先，订单能见度强。',
                keyEvents: [
                    '🔥 获得北美大客户1.6T光模块大单',
                    '🔥 800G出货量持续创新高',
                    '✅ 泰国工厂投产，产能瓶颈缓解',
                ],
                lastUpdate: '2024-01-30',
            },
            capital: {
                northFlow: '近20日净流入25.8亿',
                institutionHolding: '机构持仓占比45%，较上季+5.2%',
                trend: 'inflow',
            },
            technical: {
                position: '强势上涨通道，沿20日均线运行',
                support: 115.0,
                resistance: 145.0,
                signals: ['MACD红柱放大', 'RSI 68偏强', '量价齐升'],
            },
            chainPosition: {
                chain: 'AI算力',
                position: '中游（光模块）',
                benefitLevel: 5,
                stage: 'accelerate',
            },
            overallScore: 92,
            recommendation: 'AI算力核心受益股，业绩高增长兑现中，虽估值不便宜但景气度强支撑。',
            risks: ['估值偏高', '北美客户集中度高', '竞争加剧'],
        },
    },
};

// 默认股票数据
const defaultStock = mockStockData['002466'];

// 情绪标签
function SentimentTag({ sentiment }: { sentiment: string }) {
    const config: Record<string, { label: string; color: string }> = {
        positive: { label: '📈 偏多', color: 'bg-green-500/20 text-green-400' },
        negative: { label: '📉 偏空', color: 'bg-red-500/20 text-red-400' },
        neutral: { label: '➖ 中性', color: 'bg-gray-500/20 text-gray-400' },
    };
    const { label, color } = config[sentiment] || config.neutral;
    return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>;
}

// 趋势标签
function TrendTag({ trend }: { trend: string }) {
    const config: Record<string, { label: string; color: string }> = {
        up: { label: '↑ 上行', color: 'text-green-400' },
        down: { label: '↓ 下行', color: 'text-red-400' },
        stable: { label: '→ 平稳', color: 'text-yellow-400' },
        inflow: { label: '📥 流入', color: 'text-green-400' },
        outflow: { label: '📤 流出', color: 'text-red-400' },
    };
    const { label, color } = config[trend] || { label: trend, color: 'text-gray-400' };
    return <span className={`text-sm ${color}`}>{label}</span>;
}

// 指标卡片
function MetricCard({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) {
    return (
        <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">{value}</div>
            {subValue && <div className="text-xs text-[var(--text-secondary)]">{subValue}</div>}
        </div>
    );
}


// 资金流向实盘模块
function CapitalRealSection({ code, mockData }: { code: string; mockData: any }) {
    const [data, setData] = useState<FundFlowData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`http://localhost:8000/api/stock/${code}/fund-flow`)
            .then(r => r.json())
            .then(d => {
                if (d && d.main_net_today !== undefined) setData(d);
            })
            .catch(e => console.error("Fund flow fetch failed", e))
            .finally(() => setLoading(false));
    }, [code]);

    if (loading) return <div className="card animate-pulse h-32"></div>;

    // Fallback to mock if no data
    if (!data) {
        return (
            <AnalysisCard title="💰 资金面 (Mock)">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-[var(--text-secondary)]">资金趋势</span>
                    <TrendTag trend={mockData.trend} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="text-xs text-[var(--text-secondary)] mb-1">北向资金</div>
                        <div className="text-sm text-[var(--text-primary)]">{mockData.northFlow}</div>
                    </div>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="text-xs text-[var(--text-secondary)] mb-1">机构持仓</div>
                        <div className="text-sm text-[var(--text-primary)]">{mockData.institutionHolding}</div>
                    </div>
                </div>
            </AnalysisCard>
        );
    }

    // Real Data Rendering
    const isInflow = data.main_net_today > 0;

    return (
        <AnalysisCard title="💰 资金面 (实盘)">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-[var(--text-secondary)]">今日主力</span>
                <span className={`text-sm font-bold ${isInflow ? 'text-red-400' : 'text-green-400'}`}>
                    {isInflow ? '流入' : '流出'} {(data.main_net_today / 100000000).toFixed(2)}亿
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                    占比 {data.main_pct}%
                </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">5日主力净额</div>
                    <div className={`text-sm ${data.main_net_5d > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {(data.main_net_5d / 100000000).toFixed(2)}亿
                    </div>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">今日散户净额</div>
                    <div className={`text-sm ${data.retail_net_today > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {(data.retail_net_today / 100000000).toFixed(2)}亿
                    </div>
                </div>
            </div>
        </AnalysisCard>
    );
}

// 财务分析实盘模块
function FinancialRealSection({ code, mockData, metrics }: { code: string; mockData: any; metrics: any }) {
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`http://localhost:8000/api/stock/${code}/financial`)
            .then(r => r.json())
            .then(d => {
                if (d && d.revenue) setData(d);
            })
            .catch(e => console.error("Financial fetch failed", e))
            .finally(() => setLoading(false));
    }, [code]);

    if (loading) return <div className="card animate-pulse h-40"></div>;

    if (!data) {
        return (
            <AnalysisCard title="📊 财报分析 (Mock)" lastUpdate={mockData.lastUpdate}>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">业绩趋势</span>
                    <TrendTag trend={mockData.trend} />
                </div>
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-[var(--text-secondary)] mb-1">📋 年报摘要</div>
                        <p className="text-sm text-[var(--text-primary)]">{mockData.annual}</p>
                    </div>
                    <div>
                        <div className="text-xs text-[var(--text-secondary)] mb-1">📈 季报亮点</div>
                        <p className="text-sm text-[var(--text-primary)]">{mockData.quarterly}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="p-2 bg-[var(--bg-secondary)] rounded">
                        <span className="text-xs text-[var(--text-secondary)]">营收增速</span>
                        <span className={`text-sm font-bold ml-2 ${metrics.revenueGrowth >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                            {metrics.revenueGrowth >= 0 ? '+' : ''}{metrics.revenueGrowth}%
                        </span>
                    </div>
                    <div className="p-2 bg-[var(--bg-secondary)] rounded">
                        <span className="text-xs text-[var(--text-secondary)]">利润增速</span>
                        <span className={`text-sm font-bold ml-2 ${metrics.profitGrowth >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                            {metrics.profitGrowth >= 0 ? '+' : ''}{metrics.profitGrowth}%
                        </span>
                    </div>
                </div>
            </AnalysisCard>
        );
    }

    return (
        <AnalysisCard title="📊 财报分析 (实盘)" lastUpdate={data.report_date}>
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <div className="text-xs text-[var(--text-secondary)] mb-1">营业总收入</div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">{data.revenue}</div>
                    <div className={`text-xs ${data.revenue_yoy >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        同比 {data.revenue_yoy >= 0 ? '+' : ''}{data.revenue_yoy}%
                    </div>
                </div>
                <div>
                    <div className="text-xs text-[var(--text-secondary)] mb-1">归母净利润</div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">{data.net_profit}</div>
                    <div className={`text-xs ${data.net_profit_yoy >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        同比 {data.net_profit_yoy >= 0 ? '+' : ''}{data.net_profit_yoy}%
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[var(--border-color)]">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-secondary)]">ROE</span>
                    <span className="font-medium text-[var(--text-primary)]">{data.roe}%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-secondary)]">毛利率</span>
                    <span className="font-medium text-[var(--text-primary)]">{data.gross_margin}%</span>
                </div>
            </div>
        </AnalysisCard>
    );
}

// 实盘量价分析模块
function TechnicalSection({ code }: { code: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTechnical = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/stock/${code}/technical`);
                const json = await res.json();
                if (json && json.status !== '未知') {
                    setData(json);
                }
            } catch (e) {
                console.error("Failed technical fetch", e);
            } finally {
                setLoading(false);
            }
        };
        fetchTechnical();
    }, [code]);

    if (loading) return <div className="card animate-pulse h-40"></div>;
    if (!data) return null; // Fallback to mock if failed

    // 计算价格在支撑压力区间的位置 (0-100%)
    const range = data.resistance - data.support;
    const position = range > 0 ? ((data.price - data.support) / range) * 100 : 50;
    const clampedPos = Math.max(5, Math.min(95, position)); // Clamp for visual

    const statusMap: Record<string, { color: string; bg: string; icon: string }> = {
        '突破': { color: 'text-red-400', bg: 'bg-red-500/20', icon: '🚀 强势突破' },
        '加速': { color: 'text-red-400', bg: 'bg-red-500/20', icon: '🔥 加速上涨' },
        '上升': { color: 'text-red-400', bg: 'bg-red-500/10', icon: '📈 上升通道' },
        '回踩': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '🦶 缩量回踩' },
        '震荡': { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: '〰️ 区间震荡' },
        '下降': { color: 'text-green-400', bg: 'bg-green-500/20', icon: '📉 下行趋势' },
        '加速下跌': { color: 'text-green-400', bg: 'bg-green-500/20', icon: '❄️加速下跌' },
    };
    const statusStyle = statusMap[data.status] || statusMap['震荡'];

    return (
        <section className="card border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">📊 量价形态分析 (实盘)</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${statusStyle.bg} ${statusStyle.color}`}>
                    {statusStyle.icon}
                </span>
            </div>

            {/* 支撑压力进度条 */}
            <div className="mb-6 relative">
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-2">
                    <span>支撑 {data.support}</span>
                    <span>压力 {data.resistance}</span>
                </div>
                <div className="h-2 bg-[var(--bg-secondary)] rounded-full relative">
                    <div className="absolute top-0 bottom-0 bg-[var(--accent-green)]/30 rounded-l-full" style={{ width: `${clampedPos}%` }}></div>
                    <div className="absolute top-[-4px] w-1 h-4 bg-white shadow-lg rounded" style={{ left: `${clampedPos}%` }}></div>
                </div>
                <div className="mt-2 text-center text-xs text-[var(--text-primary)] font-mono">
                    现价 {data.price}
                </div>
            </div>

            {/* 关键信号 */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">多空地位</div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{data.position}</div>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">信号特征</div>
                    <div className="flex flex-wrap gap-1">
                        {data.signals.length > 0 ? (
                            data.signals.map((s: string, i: number) => (
                                <span key={i} className="text-xs text-[var(--accent-green)]">{s}</span>
                            ))
                        ) : (
                            <span className="text-xs text-[var(--text-secondary)]">无明显信号</span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function AnalysisCard({ title, children, lastUpdate }: { title: string; children: React.ReactNode; lastUpdate?: string }) {
    return (
        <section className="card">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
                {lastUpdate && <span className="text-xs text-[var(--text-secondary)]">更新：{lastUpdate}</span>}
            </div>
            {children}
        </section>
    );
}

export default function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);

    // 实盘数据状态
    const [realData, setRealData] = useState<StockDetailData | null>(null);
    const [loading, setLoading] = useState(true);

    // Mock数据用于AI分析部分
    const mockStock = mockStockData[resolvedParams.code];
    const hasAiAnalysis = !!mockStock?.aiAnalysis;

    // 获取实盘数据
    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/stock/${resolvedParams.code}/detail`);
                if (res.ok) {
                    const data = await res.json();
                    setRealData(data);
                }
            } catch (e) {
                console.error('Failed to fetch stock detail', e);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [resolvedParams.code]);

    // 合并数据源：实盘优先，Mock补充
    const stock = {
        code: realData?.code || resolvedParams.code,
        name: realData?.name || mockStock?.name || `股票${resolvedParams.code}`,
        price: realData?.price || mockStock?.price || 0,
        change: realData?.change || mockStock?.change || 0,
        changeAmount: realData?.changeAmount || mockStock?.changeAmount || 0,
        industry: realData?.industry || mockStock?.industry || '未知',
        concept: mockStock?.concept || [realData?.industry || '热门'].filter(Boolean),
        coreScore: mockStock?.coreScore || 70,
        metrics: {
            pe: realData?.metrics?.pe || mockStock?.metrics?.pe || 0,
            pb: realData?.metrics?.pb || mockStock?.metrics?.pb || 0,
            marketCap: realData?.metrics?.marketCap || mockStock?.metrics?.marketCap || 'N/A',
            roe: realData?.metrics?.roe || mockStock?.metrics?.roe || 0,
            dividend: realData?.metrics?.dividend || mockStock?.metrics?.dividend || 0,
            revenueGrowth: mockStock?.metrics?.revenueGrowth || 0,
            profitGrowth: mockStock?.metrics?.profitGrowth || 0,
        }
    };

    // AI分析：有Mock则用，否则用通用占位
    const ai = hasAiAnalysis ? mockStock.aiAnalysis : {
        financialReport: { annual: '暂无年报分析', quarterly: '暂无季报分析', trend: 'stable' as const, lastUpdate: '-' },
        news: { sentiment: 'neutral' as const, summary: '暂无消息面分析', keyEvents: [], lastUpdate: '-' },
        capital: { northFlow: '暂无数据', institutionHolding: '暂无数据', trend: 'stable' as const },
        technical: { position: '暂无', support: 0, resistance: 0, signals: [] },
        chainPosition: { chain: stock.industry, position: '待分析', benefitLevel: 3, stage: 'unknown' },
        overallScore: 60,
        recommendation: '暂无AI分析，请等待数据更新。',
        risks: ['数据加载中'],
    };

    const isUp = stock.change >= 0;

    // 加载中状态
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
                <div className="text-[var(--text-secondary)]">加载中...</div>
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
                            <div>
                                <span className="text-lg font-semibold text-[var(--text-primary)]">{stock.name}</span>
                                <span className="text-sm text-[var(--text-secondary)] ml-2">{stock.code}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded text-xs bg-[var(--accent-green)]/20 text-[var(--accent-green)]">
                                核心度 {stock.coreScore}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                {/* 价格信息 */}
                <section className="card">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className={`text-3xl font-bold ${isUp ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {stock.price.toFixed(2)}
                            </div>
                            <div className={`text-sm ${isUp ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                {isUp ? '+' : ''}{stock.change}% ({isUp ? '+' : ''}{stock.changeAmount.toFixed(2)})
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                            {stock.concept.map((c) => (
                                <span key={c} className="px-2 py-0.5 rounded text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <MetricCard label="PE(TTM)" value={stock.metrics.pe} />
                        <MetricCard label="PB" value={stock.metrics.pb} />
                        <MetricCard label="市值" value={stock.metrics.marketCap} />
                        <MetricCard label="ROE" value={`${stock.metrics.roe}%`} />
                    </div>
                </section>

                {/* K线图 */}
                <section className="card">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">📈 K线走势</h3>
                        <div className="flex gap-2">
                            {['日K', '周K', '月K'].map((period) => (
                                <button key={period} className="px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* 模拟K线图 - 真实场景会用 TradingView 或 ECharts */}
                    <div className="h-48 bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center relative overflow-hidden">
                        {/* 模拟K线背景网格 */}
                        <div className="absolute inset-0 opacity-20">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="absolute w-full border-t border-[var(--border-color)]" style={{ top: `${(i + 1) * 20}%` }} />
                            ))}
                        </div>
                        {/* 模拟K线蜡烛图 */}
                        <div className="absolute bottom-4 left-4 right-4 h-32 flex items-end gap-1">
                            {[35, 42, 38, 45, 50, 48, 55, 52, 58, 62, 65, 60, 68, 72, 70, 75, 78, 82, 85, 80].map((h, i) => {
                                const isUp = i === 0 ? true : h > [35, 42, 38, 45, 50, 48, 55, 52, 58, 62, 65, 60, 68, 72, 70, 75, 78, 82, 85, 80][i - 1];
                                return (
                                    <div
                                        key={i}
                                        className={`flex-1 rounded-sm ${isUp ? 'bg-[var(--accent-green)]' : 'bg-[var(--accent-red)]'}`}
                                        style={{ height: `${h}%`, minWidth: '4px' }}
                                    />
                                );
                            })}
                        </div>
                        {/* MA线 */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                            <path
                                d="M10,70 Q30,65 50,55 T90,45 T130,35 T170,28 T190,25"
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="1.5"
                                opacity="0.8"
                            />
                            <path
                                d="M10,75 Q30,72 50,65 T90,55 T130,48 T170,40 T190,35"
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                                opacity="0.8"
                            />
                        </svg>
                        {/* 成交量条 */}
                        <div className="absolute bottom-0 left-4 right-4 h-8 flex items-end gap-1 opacity-50">
                            {[40, 55, 35, 60, 75, 50, 80, 65, 90, 70, 85, 55, 95, 75, 60, 85, 90, 100, 80, 70].map((h, i) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-[var(--text-secondary)] rounded-t-sm"
                                    style={{ height: `${h}%`, minWidth: '4px' }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-secondary)]">
                        <span>📊 成交量: 12.5亿</span>
                        <span>🔶 MA5: {(stock.price * 0.98).toFixed(2)} 🔵 MA20: {(stock.price * 0.95).toFixed(2)}</span>
                    </div>
                </section>

                {/* AI综合评分 */}
                <section className="card bg-gradient-to-r from-[var(--accent-green)]/10 to-transparent">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">🤖 AI综合评分</h3>
                        <div className="text-2xl font-bold text-[var(--accent-green)]">{ai.overallScore}/100</div>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] mb-3">{ai.recommendation}</p>
                    <div className="flex flex-wrap gap-1">
                        {ai.risks.map((risk, i) => (
                            <span key={i} className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">
                                ⚠️ {risk}
                            </span>
                        ))}
                    </div>
                </section>

                {/* 财报分析 */}
                <FinancialRealSection code={resolvedParams.code} mockData={ai.financialReport} metrics={stock.metrics} />

                {/* 消息面分析 */}
                <AnalysisCard title="📰 消息面" lastUpdate={ai.news.lastUpdate}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-[var(--text-secondary)]">舆情情绪</span>
                        <SentimentTag sentiment={ai.news.sentiment} />
                    </div>
                    <p className="text-sm text-[var(--text-primary)] mb-3">{ai.news.summary}</p>
                    <div className="space-y-2">
                        {ai.news.keyEvents.map((event, i) => (
                            <div key={i} className="text-sm text-[var(--text-primary)] p-2 bg-[var(--bg-secondary)] rounded">
                                {event}
                            </div>
                        ))}
                    </div>
                </AnalysisCard>

                {/* 资金面分析 */}
                <CapitalRealSection code={resolvedParams.code} mockData={ai.capital} />

                {/* 技术面分析 - 实盘替换 Mock */}
                <TechnicalSection code={resolvedParams.code} />

                {/* 产业链位置 */}
                <AnalysisCard title="🔗 产业链位置">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 rounded text-sm bg-orange-500/20 text-orange-400 font-medium">
                            {ai.chainPosition.chain}
                        </span>
                        <span className="text-sm text-[var(--text-primary)]">{ai.chainPosition.position}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-yellow-400">
                            受益程度：{'★'.repeat(ai.chainPosition.benefitLevel)}{'☆'.repeat(5 - ai.chainPosition.benefitLevel)}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                            当前阶段：
                            <span className={ai.chainPosition.stage === 'start' ? 'text-green-400' : 'text-yellow-400'}>
                                {ai.chainPosition.stage === 'start' ? '启动期' : ai.chainPosition.stage === 'accelerate' ? '加速期' : '见顶期'}
                            </span>
                        </span>
                    </div>
                </AnalysisCard>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                    <button className="btn btn-primary flex-1">加入自选</button>
                    <Link href="/chat" className="btn btn-secondary flex-1 text-center">询问AI</Link>
                </div>
            </main>
        </div>
    );
}
