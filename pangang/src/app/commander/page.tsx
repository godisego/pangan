'use client';

import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderLogic, CommanderOrder, CommanderStock } from '@/types/api';

function SectionCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle ? <p className="text-sm text-[var(--text-secondary)] mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function LogicCard({ label, logic }: { label: string; logic: CommanderLogic }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--accent-green)]">{label}</span>
        <span className="text-xs text-[var(--text-secondary)]">有效期：{logic.validity}</span>
      </div>
      <div className="text-base font-semibold text-[var(--text-primary)]">{logic.name}</div>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{logic.reason}</p>
      {logic.us_mapping ? <p className="text-xs text-[var(--text-secondary)]">{logic.us_mapping}</p> : null}
      <div className="rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]">
        <strong>验证点：</strong>{logic.verify_point}
      </div>
      <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
        <strong>证伪信号：</strong>{logic.fake_signal}
      </div>
    </div>
  );
}

function StockTable({ title, stocks }: { title: string; stocks: CommanderStock[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">优先级</th>
              <th className="px-3 py-2 text-left">股票</th>
              <th className="px-3 py-2 text-left">竞价预期</th>
              <th className="px-3 py-2 text-left">竞价状态</th>
              <th className="px-3 py-2 text-left">战术</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={`${title}-${stock.code}`} className="border-t border-[var(--border-color)] text-[var(--text-primary)]">
                <td className="px-3 py-3">{stock.priority}</td>
                <td className="px-3 py-3">
                  <div>{stock.stock}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{stock.code}</div>
                </td>
                <td className="px-3 py-3">{stock.auction_price}</td>
                <td className="px-3 py-3">{stock.auction_status}</td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">{stock.tactic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CommanderPage() {
  const { data, loading, error, refetch } = useFetch<CommanderOrder>(
    () => commanderApi.getOrder(),
    { interval: 60000 }
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="space-y-1">
            <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← 返回总控台</Link>
            <h1 className="text-xl font-semibold">开盘作战室</h1>
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-full border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            刷新指令
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loading ? (
          <section className="card text-sm text-[var(--text-secondary)]">正在生成今日作战指令...</section>
        ) : null}

        {error ? (
          <section className="card border border-red-500/30 bg-red-500/5 text-sm text-red-300">
            作战指令加载失败：{error.message}
          </section>
        ) : null}

        {data ? (
          <>
            <SectionCard
              title={`${data.battle_weather.icon} 战场天气`}
              subtitle={`生成时间：${new Date(data.timestamp).toLocaleString('zh-CN')}`}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">竞价情绪</div>
                  <div className="mt-2 text-2xl font-semibold">{data.battle_weather.weather}</div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{data.battle_weather.description}</div>
                </div>
                <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">竞价指标</div>
                  <div className="mt-2 text-sm leading-relaxed">{data.battle_weather.auction_sentiment}</div>
                </div>
                <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">隔夜外盘</div>
                  <div className="mt-2 text-sm leading-relaxed">{data.battle_weather.overnight_us || '暂无'}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="🔄 昨日验证" subtitle={data.yesterday_review.summary}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[var(--bg-secondary)] px-3 py-1 text-sm">{data.yesterday_review.status}</span>
                {data.yesterday_review.accuracy ? (
                  <span className="rounded-full bg-[var(--accent-green)]/10 px-3 py-1 text-sm text-[var(--accent-green)]">
                    准确率 {data.yesterday_review.accuracy}
                  </span>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="🦋 今日双主线" subtitle={data.today_mainlines.summary}>
              <div className="grid gap-4 md:grid-cols-2">
                <LogicCard label="逻辑 A / 进攻" logic={data.today_mainlines.logic_a} />
                <LogicCard label="逻辑 B / 防守" logic={data.today_mainlines.logic_b} />
              </div>
            </SectionCard>

            <SectionCard title="⚔️ 精锐股票池" subtitle="基于当前竞价强弱排序">
              <div className="space-y-5">
                <StockTable title="进攻池" stocks={data.elite_stock_pool.attack} />
                <StockTable title="防守池" stocks={data.elite_stock_pool.defense} />
              </div>
            </SectionCard>

            <SectionCard title="📡 指挥官军令" subtitle={data.commander_tips.focus}>
              <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">仓位军令</div>
                  <div className="mt-2 text-sm leading-7">{data.commander_tips.position_text}</div>
                </div>
                <div className="space-y-3">
                  {data.commander_tips.time_orders.map((order) => (
                    <div key={order.time} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{order.time} 前</div>
                      <div className="mt-2 text-sm text-[var(--text-secondary)]">若 {order.condition}</div>
                      <div className="mt-2 text-sm text-[var(--accent-green)]">{order.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </>
        ) : null}
      </main>
    </div>
  );
}
