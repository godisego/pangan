'use client';

import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderHistoryRecord, CommanderReviewDetail } from '@/types/api';

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="data-tile">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{hint}</div>
    </div>
  );
}

function HistoryItem({
  record,
  active,
  onSelect,
}: {
  record: CommanderHistoryRecord;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active ? 'true' : 'false'}
      className="action-card compact w-full text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{record.date}</div>
        <div className="text-xs text-[var(--text-secondary)]">
          {record.verify_result ? `${record.verify_result.accuracy}%` : record.verified ? '已验证' : '待验证'}
        </div>
      </div>
      <div className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
        A {record.logic_a?.name || '无'} / B {record.logic_b?.name || '无'}
      </div>
    </button>
  );
}

export default function ReviewPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const history = useFetch<CommanderHistoryRecord[]>(
    () => commanderApi.getHistory(12),
    { interval: 60000, cacheKey: 'pangang_cache_commander_history_v1' }
  );

  const records = useMemo(() => history.data || [], [history.data]);
  const activeDate = useMemo(() => selectedDate || records[0]?.date || null, [selectedDate, records]);

  const detail = useFetch<CommanderReviewDetail | null>(
    () => (activeDate ? commanderApi.getReviewByDate(activeDate) : Promise.resolve(null)),
    { enabled: !!activeDate, interval: 60000, cacheKey: activeDate ? `pangang_cache_review_${activeDate}` : undefined }
  );

  const verify = detail.data?.verify_result;

  return (
    <AppShell
      title="复盘室"
      subtitle="只看三件事：昨天说了什么、今天有没有兑现、这套逻辑还值不值得延续。"
      badge="验证层"
      maxWidthClassName="max-w-6xl"
    >
      <section className="surface-panel animate-stage p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="日期" value={activeDate || '未选择'} hint="当前复盘对象" />
          <Metric
            label="准确率"
            value={verify ? `${verify.accuracy}%` : '待验证'}
            hint={verify ? `命中 ${verify.correct}/${verify.total}` : '还没有可用验证结果'}
          />
          <Metric
            label="状态"
            value={detail.isRefreshing || history.isRefreshing ? '更新中' : '已就绪'}
            hint="刷新时保留当前内容"
          />
          <Metric
            label="记录数"
            value={`${records.length}`}
            hint="最近作战记录"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="surface-panel animate-stage p-5 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-[var(--text-primary)]">最近记录</div>
            {history.isRefreshing ? <div className="metric-chip">更新中</div> : null}
          </div>

          {history.loading ? (
            <div className="mt-4 text-sm text-[var(--text-secondary)]">正在加载复盘记录...</div>
          ) : (
            <div className="mt-4 grid gap-3">
              {records.map((record) => (
                <HistoryItem
                  key={record.date}
                  record={record}
                  active={activeDate === record.date}
                  onSelect={() => setSelectedDate(record.date)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-5">
          <section className="surface-panel animate-stage p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold text-[var(--text-primary)]">主线回看</div>
              {!detail.loading && detail.isRefreshing ? <div className="metric-chip">静默更新中</div> : null}
            </div>

            {detail.loading ? (
              <div className="mt-4 text-sm text-[var(--text-secondary)]">正在加载复盘详情...</div>
            ) : detail.data ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="data-tile">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">进攻主线</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{detail.data.logic_a?.name || '无'}</div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{detail.data.logic_a?.reason || '暂无说明'}</div>
                </div>
                <div className="data-tile">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">防守主线</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{detail.data.logic_b?.name || '无'}</div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{detail.data.logic_b?.reason || '暂无说明'}</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-[var(--text-secondary)]">请选择一条记录查看复盘详情。</div>
            )}
          </section>

          <section className="surface-panel animate-stage p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-[var(--text-primary)]">验证结果</div>
              {verify ? <div className="metric-chip"><strong>{verify.accuracy}%</strong></div> : null}
            </div>

            {verify ? (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="准确率" value={`${verify.accuracy}%`} hint="这一天的命中率" />
                  <Metric label="命中" value={`${verify.correct}/${verify.total}`} hint="上涨或符合预期的数量" />
                  <Metric label="结果" value="已生成" hint="可以据此判断这套逻辑是否延续" />
                </div>

                <div className="overflow-hidden rounded-[22px] border border-[var(--border-color)] bg-[rgba(8,18,28,0.72)]">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-3 text-left">股票</th>
                        <th className="px-4 py-3 text-left">涨跌幅</th>
                        <th className="px-4 py-3 text-left">结果</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(verify.stocks || []).map((stock) => (
                        <tr key={`${detail.data?.date}-${stock.code}`} className="border-t border-[var(--border-color)]">
                          <td className="px-4 py-4">
                            <div className="font-medium text-[var(--text-primary)]">{stock.name}</div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{stock.code}</div>
                          </td>
                          <td className="px-4 py-4 text-[var(--text-secondary)]">{stock.change}%</td>
                          <td className="px-4 py-4 text-[var(--text-primary)]">{stock.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-4 data-tile">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Waiting</div>
                <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">当前还没有验证结果</div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                  可能是当天记录，或者市场数据还不够完整。这里不会编造结果。
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
