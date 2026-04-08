'use client';

import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderHistoryRecord } from '@/types/api';

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
      <div className="module-node__copy">{detail}</div>
    </div>
  );
}

function formatVerificationState(record: CommanderHistoryRecord) {
  if (record.verify_result) return `${record.verify_result.accuracy}%`;
  const status = record.verification_meta?.status;
  if (status === 'verifying') return '验证中';
  if (status === 'pending_data') return '等数据';
  if (status === 'waiting_market') return '等开盘';
  if (status === 'failed') return '待重试';
  if (status === 'queued') return '排队中';
  return record.verified ? '已验证' : '待验证';
}

function formatVerificationHint(record: CommanderHistoryRecord) {
  if (record.verify_result?.verify_date) {
    return `验证日 ${record.verify_result.verify_date}`;
  }
  if (record.verification_meta?.retry_after) {
    return `下次重试 ${record.verification_meta.retry_after.replace('T', ' ').slice(0, 19)}`;
  }
  if (record.verification_meta?.message) {
    return record.verification_meta.message;
  }
  return '当前先展示真实状态，不补造验证结果。';
}

function RecordButton({
  record,
  active,
  onSelect,
}: {
  record: CommanderHistoryRecord;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} data-active={active ? 'true' : 'false'} className="action-card compact w-full text-left">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{record.date}</div>
        <div className="text-xs text-[var(--text-secondary)]">{formatVerificationState(record)}</div>
      </div>
      <div className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
        A {record.logic_a?.name || '无'} / B {record.logic_b?.name || '无'}
      </div>
      <div className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">{formatVerificationHint(record)}</div>
    </button>
  );
}

export default function ReviewPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const history = useFetch<CommanderHistoryRecord[]>(
    () => commanderApi.getHistory(12),
    { interval: 300000, cacheKey: 'pangang_cache_commander_history_v4' }
  );

  const records = useMemo(() => history.data || [], [history.data]);
  const activeRecord = useMemo(() => {
    if (!records.length) return null;
    if (selectedDate) return records.find((record) => record.date === selectedDate) || null;
    return records[0] || null;
  }, [records, selectedDate]);

  const verifiedCount = useMemo(
    () => records.filter((record) => Boolean(record.verify_result)).length,
    [records]
  );
  const pendingCount = records.length - verifiedCount;
  const avgAccuracy = useMemo(() => {
    const verifiedRecords = records.filter((record) => typeof record.verify_result?.accuracy === 'number');
    if (!verifiedRecords.length) return null;
    const total = verifiedRecords.reduce((sum, record) => sum + (record.verify_result?.accuracy || 0), 0);
    return Math.round((total / verifiedRecords.length) * 10) / 10;
  }, [records]);

  return (
    <AppShell
      title="复盘"
      subtitle="先选最近记录，再看当天验证和归因。"
      badge="历史记录与验证"
      maxWidthClassName="max-w-6xl"
    >
      <ModuleShell
        title="当日概览"
        badge={activeRecord?.date || '未选择'}
        variant="review"
        motion="pulse"
        compact
      >
        <div className="module-kpi-grid">
          <StatusCard label="当前日期" value={activeRecord?.date || '未选择'} detail="当前查看的记录" />
          <StatusCard label="已验证" value={`${verifiedCount}`} detail="已经拿到结果的记录数" />
          <StatusCard label="待验证" value={`${pendingCount}`} detail="仍在等待市场数据或重试" />
          <StatusCard label="平均准确率" value={avgAccuracy !== null ? `${avgAccuracy}%` : '暂无'} detail="只统计已完成验证的记录" />
        </div>
      </ModuleShell>

      <div className="module-columns lg:grid-cols-[320px_minmax(0,1fr)]">
        <ModuleShell
          title="最近记录"
          badge={`${records.length} 条`}
          variant="review"
          motion="drift"
          compact
        >
          {history.loading ? (
            <div className="module-node">
              <div className="module-node__label">处理中</div>
              <div className="module-node__title">正在加载复盘记录...</div>
              <div className="module-node__copy">这里只拉历史列表，不默认再发第二次详情请求。</div>
            </div>
          ) : records.length ? (
            <div className="scan-list">
              {records.map((record) => (
                <RecordButton
                  key={record.date}
                  record={record}
                  active={activeRecord?.date === record.date}
                  onSelect={() => setSelectedDate(record.date)}
                />
              ))}
            </div>
          ) : (
            <div className="module-node">
              <div className="module-node__label">暂无记录</div>
              <div className="module-node__title">还没有复盘记录</div>
              <div className="module-node__copy">等系统积累出最近几天的历史后，这里会按日期展示。</div>
            </div>
          )}
        </ModuleShell>

        <div className="grid gap-4">
          <ModuleShell
            title="主线回看"
            badge={activeRecord?.date || '未选择'}
            variant="review"
            motion="pulse"
            compact
          >
            {activeRecord ? (
              <div className="module-columns md:grid-cols-2">
                <div className="module-node">
                  <div className="module-node__label">进攻主线</div>
                  <div className="module-node__title">{activeRecord.logic_a?.name || '无'}</div>
                  <div className="module-node__copy">{activeRecord.logic_a?.reason || '暂无说明'}</div>
                </div>
                <div className="module-node">
                  <div className="module-node__label">防守主线</div>
                  <div className="module-node__title">{activeRecord.logic_b?.name || '无'}</div>
                  <div className="module-node__copy">{activeRecord.logic_b?.reason || '暂无说明'}</div>
                </div>
              </div>
            ) : (
              <div className="module-node">
                <div className="module-node__label">待选择</div>
                <div className="module-node__title">请选择一条记录</div>
                <div className="module-node__copy">选中左侧日期后，这里会展示当日主线和当前验证状态。</div>
              </div>
            )}
          </ModuleShell>

          <ModuleShell
            title="验证结果"
            badge={activeRecord ? formatVerificationState(activeRecord) : '待选择'}
            variant="review"
            motion="track"
            compact
          >
            {activeRecord ? (
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <StatusCard
                    label="准确率"
                    value={activeRecord.verify_result ? `${activeRecord.verify_result.accuracy}%` : '待验证'}
                    detail={activeRecord.verify_result ? `命中 ${activeRecord.verify_result.correct}/${activeRecord.verify_result.total}` : '当前还没有验证结果'}
                  />
                  <StatusCard
                    label="验证状态"
                    value={activeRecord.verify_result ? '已验证' : activeRecord.verification_meta?.status || '待验证'}
                    detail={formatVerificationHint(activeRecord)}
                  />
                  <StatusCard
                    label="验证日"
                    value={activeRecord.verify_result?.verify_date || '未完成'}
                    detail="按下一交易日结果做验证"
                  />
                </div>

                {activeRecord.verify_result?.attribution ? (
                  <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">失败归因 / 纠偏建议</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{activeRecord.verify_result.attribution.label}</div>
                    <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{activeRecord.verify_result.attribution.reason}</div>
                    {activeRecord.verify_result.attribution.failed_link || activeRecord.verify_result.attribution.next_action ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {activeRecord.verify_result.attribution.failed_link ? (
                          <div className="text-xs leading-6 text-[var(--accent-red)]">
                            失效环节：{activeRecord.verify_result.attribution.failed_link}
                          </div>
                        ) : null}
                        {activeRecord.verify_result.attribution.next_action ? (
                          <div className="text-xs leading-6 text-[var(--accent-green)]">
                            下次动作：{activeRecord.verify_result.attribution.next_action}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeRecord.verify_result?.stocks?.length ? (
                  <div className="scan-list">
                    {activeRecord.verify_result.stocks.map((stock) => (
                      <div key={`${activeRecord.date}-${stock.code}`} className="scan-row">
                        <div className="scan-row-copy">
                          <strong>{stock.name}</strong>
                          <span>{stock.code} · {stock.result}</span>
                        </div>
                        <div className="scan-row-value">{stock.change}%</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="module-node">
                    <div className="module-node__label">等待结果</div>
                    <div className="module-node__title">当前还没有验证明细</div>
                    <div className="module-node__copy">
                      {activeRecord.verification_meta?.message || '可能是当天记录，或者市场数据还不够完整。这里不会编造结果。'}
                    </div>
                    {activeRecord.verification_meta?.last_error ? (
                      <div className="mt-2 text-xs leading-6 text-[var(--accent-red)]">
                        最近失败：{activeRecord.verification_meta.last_error}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="module-node">
                <div className="module-node__label">待选择</div>
                <div className="module-node__title">请选择一条记录</div>
                <div className="module-node__copy">选中左侧日期后，这里会展示对应的验证状态。</div>
              </div>
            )}
          </ModuleShell>
        </div>
      </div>
    </AppShell>
  );
}
