'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { stockApi } from '@/lib/api';
import { formatPercent, formatNumber } from '@/utils/formatters';

// 自选股数据类型
interface WatchlistItem {
  code: string;
  name: string;
  price: number;
  change: number;
  changeAmount?: number;
  volume?: number;
  timestamp: number;
}

// 默认自选股列表
const DEFAULT_WATCHLIST = [
  { code: '000001', name: '平安银行' },
  { code: '600519', name: '贵州茅台' },
  { code: '000858', name: '五粮液' },
];

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);

  // 加载自选股数据
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        // 从本地存储获取自选股列表
        const stored = localStorage.getItem('watchlist');
        const codes = stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;

        if (codes.length > 0) {
          // 逐个获取股票报价
          const items: WatchlistItem[] = [];
          for (const c of codes.slice(0, 10)) {
            try {
              const quote = await stockApi.getQuote(c.code);
              items.push({
                code: c.code,
                name: quote?.name || c.name || c.code,
                price: quote?.price || 0,
                change: quote?.changePercent || quote?.change || 0,
                changeAmount: (quote?.price || 0) - (quote?.preClose || 0),
                timestamp: Date.now(),
              });
            } catch {
              items.push({
                code: c.code,
                name: c.name || c.code,
                price: 0,
                change: 0,
                timestamp: Date.now(),
              });
            }
          }

          setWatchlist(items);
        }
      } catch (err) {
        console.error('Failed to fetch watchlist:', err);
        // 使用默认数据
        setWatchlist([
          { code: '000001', name: '平安银行', price: 12.34, change: 0.5, timestamp: Date.now() },
          { code: '600519', name: '贵州茅台', price: 1680.0, change: -0.3, timestamp: Date.now() },
          { code: '000858', name: '五粮液', price: 145.6, change: 1.2, timestamp: Date.now() },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
    // 每 30 秒刷新一次
    const interval = setInterval(fetchWatchlist, 30000);
    return () => clearInterval(interval);
  }, []);

  // 添加自选股
  const handleAddStock = async () => {
    if (!newCode.trim()) return;

    setAdding(true);
    try {
      // 尝试获取股票信息验证代码是否有效
      const quote = await stockApi.getQuote(newCode.trim().toUpperCase());

      const newItem: WatchlistItem = {
        code: newCode.trim().toUpperCase(),
        name: quote?.name || newCode.trim(),
        price: quote?.price || 0,
        change: quote?.changePercent || quote?.change || 0,
        changeAmount: (quote?.price || 0) - (quote?.preClose || 0),
        timestamp: Date.now(),
      };

      setWatchlist(prev => [...prev, newItem]);

      // 保存到本地存储
      const stored = localStorage.getItem('watchlist');
      const codes = stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
      codes.push({ code: newItem.code, name: newItem.name });
      localStorage.setItem('watchlist', JSON.stringify(codes));

      setNewCode('');
    } catch (err) {
      console.error('Add stock error:', err);
      alert('添加失败，请检查股票代码是否正确');
    } finally {
      setAdding(false);
    }
  };

  // 删除自选股
  const handleRemoveStock = (code: string) => {
    setWatchlist(prev => prev.filter(item => item.code !== code));

    // 更新本地存储
    const stored = localStorage.getItem('watchlist');
    if (stored) {
      const codes = JSON.parse(stored);
      const filtered = codes.filter((c: any) => c.code !== code);
      localStorage.setItem('watchlist', JSON.stringify(filtered));
    }
  };

  // 按涨跌幅排序
  const sortedList = [...watchlist].sort((a, b) => b.change - a.change);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <span className="font-semibold text-[var(--text-primary)]">自选股</span>
          </div>
          <Link
            href="/"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ← 返回
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* 添加自选股 */}
        <section className="card">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">添加自选股</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="输入股票代码 (如: 600519)"
              className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-orange-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddStock()}
            />
            <button
              onClick={handleAddStock}
              disabled={adding || !newCode.trim()}
              className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {adding ? '添加中...' : '添加'}
            </button>
          </div>
        </section>

        {/* 自选股列表 */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              我的自选 ({sortedList.length})
            </h3>
            <span className="text-xs text-[var(--text-secondary)]">按涨跌幅排序</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-[var(--bg-secondary)]/50 h-16 rounded-lg" />
              ))}
            </div>
          ) : sortedList.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <p className="text-2xl mb-2">📊</p>
              <p>暂无自选股</p>
              <p className="text-xs mt-1">添加股票到自选列表</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedList.map((stock) => (
                <div
                  key={stock.code}
                  className="flex items-center justify-between p-3 bg-[var(--bg-secondary)]/30 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Link href={`/stock/${stock.code}`} className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{stock.name}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{stock.code}</span>
                      </div>
                      <div className="text-sm text-[var(--text-secondary)] mt-0.5">
                        {stock.price > 0 ? `¥${formatNumber(stock.price)}` : '--'}
                      </div>
                    </Link>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        stock.change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'
                      }`}>
                        {stock.change >= 0 ? '+' : ''}{formatPercent(stock.change)}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {stock.changeAmount ? `${stock.changeAmount > 0 ? '+' : ''}${stock.changeAmount.toFixed(2)}` : '--'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveStock(stock.code)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 快捷操作提示 */}
        <section className="card bg-[var(--bg-secondary)]/30">
          <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-2">💡 提示</h3>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1">
            <li>• 点击股票名称查看详情</li>
            <li>• 自选股数据每 30 秒自动刷新</li>
            <li>• 数据存储在本地浏览器中</li>
          </ul>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)] md:hidden">
        <div className="max-w-3xl mx-auto px-4 py-2 flex justify-around">
          <Link href="/" className="flex flex-col items-center gap-1 text-[var(--text-secondary)]">
            <span className="text-lg">📊</span>
            <span className="text-xs">信号</span>
          </Link>
          <Link href="/watchlist" className="flex flex-col items-center gap-1 text-[var(--accent-green)]">
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
