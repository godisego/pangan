'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import MacroStrategyDashboard from '../components/MacroStrategyCard';
import { stockApi, btcApi } from '@/lib/api';
import { StatusTag } from '@/components/ui/StatusTag';
import { formatPercent, formatNumber } from '@/utils/formatters';
import { REFRESH_INTERVALS } from '@/utils/constants';
import type { StockMarket, BtcSummary } from '@/types/api';

// --- 大盘环境卡片（精简版，不再折叠宏观） ---
function MarketEnvironment() {
  const [data, setData] = useState<StockMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      const json = await stockApi.getMarket();
      setData(json);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Market data:', err);
      setError(err as Error);
      if (!data) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVALS.STOCK_MARKET);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="card bg-gradient-to-r from-[var(--accent-green)]/10 to-transparent animate-pulse">
        <div className="h-20 flex items-center justify-center text-[var(--accent-green)] text-sm">
          加载A股实盘...
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="card bg-gradient-to-r from-orange-500/5 to-transparent border-orange-500/20">
        <div className="h-20 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          📊 A股数据加载失败，稍后重试
        </div>
      </section>
    );
  }

  const status = data.status as string;

  return (
    <section className="card bg-gradient-to-r from-[var(--accent-green)]/10 to-transparent">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <span className="font-semibold text-[var(--text-primary)]">A股大盘</span>
          <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-green)]/20 text-[var(--accent-green)]">实盘·5s刷新</span>
        </div>
        <StatusTag status={status} />
      </div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-2xl font-bold text-[var(--accent-green)]">
            {formatNumber(data.index.value)}
          </div>
          <div className={`text-sm ${data.index.change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {data.index.name} {formatPercent(data.index.change)}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-[var(--text-secondary)]">
            涨跌比：<span className={data.breadth > 50 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}>{data.breadth}%</span>
          </div>
          <div className="text-[var(--text-secondary)]">
            涨停家数：{data.limitUp}家
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-green)]/10 text-[var(--accent-green)]">
          成交 {formatNumber(data.volume)}亿
        </span>
        <span className={`px-2 py-0.5 rounded text-xs ${data.northFlow >= 0 ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]' : 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]'}`}>
          北向 {data.northFlow >= 0 ? '+' : ''}{data.northFlow}亿
        </span>
        {data.canOperate ? (
          <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-green)]/10 text-[var(--accent-green)]">✓ 适合操作</span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-red)]/10 text-[var(--accent-red)]">⚠️ 空仓观望</span>
        )}
      </div>
    </section>
  );
}

// --- BTC 卡片组件 ---
function BtcCard() {
  const [data, setData] = useState<BtcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      const json = await btcApi.getSummary();
      setData(json);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch BTC data:', err);
      setError(err as Error);
      if (!data) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVALS.BTC_SUMMARY);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="card animate-pulse bg-gradient-to-r from-orange-500/5 to-transparent border-orange-500/20">
        <div className="h-20 flex items-center justify-center text-orange-400 text-sm">
          加载实盘数据中...
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="card bg-gradient-to-r from-orange-500/5 to-transparent border-orange-500/20">
        <div className="h-20 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          ₿ 比特币数据加载失败，稍后重试
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">₿</span>
          <span className="font-semibold text-[var(--text-primary)]">比特币</span>
          <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">实盘·15s刷新</span>
        </div>
        <Link href="/btc" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          详情 →
        </Link>
      </div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-2xl font-bold text-orange-400">
            ${formatNumber(data.price)}
          </div>
          <div className={`text-sm ${data.change24h >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {formatPercent(data.change24h)}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-[var(--text-secondary)]">
            恐贪指数：<span className={data.fearGreed > 50 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}>{data.fearGreed}</span>
          </div>
          <div className="text-[var(--text-secondary)]">
            情绪：{data.fearGreedLabel}
          </div>
        </div>
      </div>
    </section>
  );
}

// --- 首页 ---
export default function Home() {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="font-semibold text-[var(--text-primary)]">盘感</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)]">{currentTime}</span>
            <Link
              href="/settings"
              className="px-3 py-1.5 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full text-sm font-medium transition-colors"
            >
              ⚙️ 设置
            </Link>
            <Link
              href="/chat"
              className="px-3 py-1.5 bg-[var(--accent-green)]/10 text-[var(--accent-green)] rounded-full text-sm font-medium hover:bg-[var(--accent-green)]/20 transition-colors"
            >
              💬 AI对话
            </Link>
            <Link
              href="/commander"
              className="px-3 py-1.5 bg-orange-500/10 text-orange-300 rounded-full text-sm font-medium hover:bg-orange-500/20 transition-colors"
            >
              ⚔️ 作战室
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content — 新布局顺序 */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* 1️⃣ A股大盘实时环境 */}
        <MarketEnvironment />

        {/* 2️⃣ BTC 专属模块 */}
        <BtcCard />

        {/* 3️⃣ 宏观战略仪表盘（三层金字塔 + 量价齐升信号 + 市场热议） */}
        <MacroStrategyDashboard />

        {/* 使用说明 */}
        <section className="card bg-[var(--bg-secondary)]">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">💡 使用指南</h3>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1">
            <li>1. 先看宏观主线，判断大方向（进攻/防守）</li>
            <li>2. 在中层催化区找到量价齐升的板块方向</li>
            <li>3. 点击板块名进入产业链，查看上中下游布局</li>
            <li>4. 结合A股大盘环境判断操作时机</li>
          </ul>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)] md:hidden">
        <div className="max-w-3xl mx-auto px-4 py-2 flex justify-around">
          <Link href="/" className="flex flex-col items-center gap-1 text-[var(--accent-green)]">
            <span className="text-lg">📊</span>
            <span className="text-xs">信号</span>
          </Link>
          <Link href="/watchlist" className="flex flex-col items-center gap-1 text-[var(--text-secondary)]">
            <span className="text-lg">⭐</span>
            <span className="text-xs">追踪</span>
          </Link>
          <Link href="/chat" className="flex flex-col items-center gap-1 text-[var(--text-secondary)]">
            <span className="text-lg">💬</span>
            <span className="text-xs">对话</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 text-[var(--text-secondary)]">
            <span className="text-lg">⚙️</span>
            <span className="text-xs">设置</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
