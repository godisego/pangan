'use client';

import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';
import { useFetch } from '@/hooks/useFetch';
import { commanderApi } from '@/lib/api';
import type { CommanderHistoryRecord, CommanderLearningItem, CommanderReviewDetail } from '@/types/api';

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
      <div className="module-node__copy">{detail}</div>
    </div>
  );
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
      {record.verify_result?.attribution ? (
        <div className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
          {record.verify_result.attribution.label}
        </div>
      ) : record.verification_meta?.message ? (
        <div className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
          {record.verification_meta.message}
        </div>
      ) : null}
    </button>
  );
}

function LearningRow({ item, tone }: { item: CommanderLearningItem; tone: 'good' | 'risk' }) {
  return (
    <div className="scan-row">
      <div className="scan-row-copy">
        <strong>{item.theme || item.name || item.code || '未命名'}</strong>
        <span>{item.lane === 'attack' ? '进攻侧' : '防守侧'} · 样本 {item.total} · 命中 {item.wins}</span>
      </div>
      <div className={`scan-row-value ${tone === 'good' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
        {item.accuracy}%
      </div>
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

export default function ReviewPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const history = useFetch<CommanderHistoryRecord[]>(
    () => commanderApi.getHistory(12),
    { interval: 300000, cacheKey: 'pangang_cache_commander_history_v4' }
  );

  const records = useMemo(() => history.data || [], [history.data]);
  const activeDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    const firstVerified = records.find((record) => Boolean(record.verify_result));
    return firstVerified?.date || records[0]?.date || null;
  }, [selectedDate, records]);

  const detail = useFetch<CommanderReviewDetail | null>(
    () => (activeDate ? commanderApi.getReviewByDate(activeDate) : Promise.resolve(null)),
    { enabled: !!activeDate, interval: 300000, cacheKey: activeDate ? `pangang_cache_review_v4_${activeDate}` : undefined }
  );

  const verify = detail.data?.verify_result;
  const learning = detail.data?.learning_feedback;
  const verificationMeta = detail.data?.verification_meta;

  return (
    <AppShell
      title="复盘室"
      subtitle="先选日期，再看主线和结果。"
      badge="Review Deck"
      maxWidthClassName="max-w-6xl"
    >
      <ModuleShell
        code="01"
        eyebrow="Review Snapshot"
        title="先看复盘状态，再深入单日记录"
        badge={activeDate || '未选择'}
        variant="review"
        motion="pulse"
      >
        <div className="module-kpi-grid">
          <StatusCard label="当前日期" value={activeDate || '未选择'} detail="正在查看的复盘对象" />
          <StatusCard label="准确率" value={verify ? `${verify.accuracy}%` : '待验证'} detail={verify ? `命中 ${verify.correct}/${verify.total}` : '当前还没有验证结果'} />
          <StatusCard
            label="验证状态"
            value={verify ? '已验证' : verificationMeta?.status || '待验证'}
            detail={verificationMeta?.retry_after ? `下次重试 ${verificationMeta.retry_after.replace('T', ' ').slice(0, 19)}` : '刷新时保留已有内容'}
          />
          <StatusCard label="最近记录" value={`${records.length}`} detail="按日期排列的作战记录" />
        </div>
      </ModuleShell>

      <div className="module-columns xl:grid-cols-[320px_minmax(0,1fr)]">
        <ModuleShell
          code="02"
          eyebrow="History"
          title="选择一条记录"
          badge={`${records.length} 条`}
          variant="review"
          motion="drift"
        >
          {history.loading ? (
            <div className="module-node">
              <div className="module-node__label">Loading</div>
              <div className="module-node__title">正在加载复盘记录...</div>
              <div className="module-node__copy">记录按日期倒序排列。</div>
            </div>
          ) : (
            <div className="scan-list">
              {records.map((record) => (
                <RecordButton
                  key={record.date}
                  record={record}
                  active={activeDate === record.date}
                  onSelect={() => setSelectedDate(record.date)}
                />
              ))}
            </div>
          )}
        </ModuleShell>

        <div className="grid gap-4">
          <ModuleShell
            code="03"
            eyebrow="Mainline Replay"
            title="主线回看"
            badge={detail.data ? '已载入' : '待选择'}
            variant="review"
            motion="scan"
          >
            {detail.loading ? (
              <div className="module-node">
                <div className="module-node__label">Loading</div>
                <div className="module-node__title">正在加载复盘详情...</div>
                <div className="module-node__copy">会优先保留已有结果。</div>
              </div>
            ) : detail.data ? (
              <div className="module-columns md:grid-cols-2">
                <div className="module-node">
                  <div className="module-node__label">进攻主线</div>
                  <div className="module-node__title">{detail.data.logic_a?.name || '无'}</div>
                  <div className="module-node__copy">{detail.data.logic_a?.reason || '暂无说明'}</div>
                </div>
                <div className="module-node">
                  <div className="module-node__label">防守主线</div>
                  <div className="module-node__title">{detail.data.logic_b?.name || '无'}</div>
                  <div className="module-node__copy">{detail.data.logic_b?.reason || '暂无说明'}</div>
                </div>
              </div>
            ) : (
              <div className="module-node">
                <div className="module-node__label">Empty</div>
                <div className="module-node__title">请选择一条记录</div>
                <div className="module-node__copy">选中左侧日期后，这里会展示当日主线与验证结果。</div>
              </div>
            )}
          </ModuleShell>

          <ModuleShell
            code="04"
            eyebrow="Verification"
            title="验证结果"
            badge={verify ? '已验证' : '待验证'}
            variant="review"
            motion="track"
          >
            {verify ? (
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <StatusCard label="准确率" value={`${verify.accuracy}%`} detail="这一天的命中率" />
                  <StatusCard label="命中" value={`${verify.correct}/${verify.total}`} detail="上涨或符合预期的数量" />
                  <StatusCard label="验证日" value={verify.verify_date || '已生成'} detail="按下一交易日结果做验证" />
                </div>

                {verify.attribution ? (
                  <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">失败归因 / 纠偏建议</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{verify.attribution.label}</div>
                    <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{verify.attribution.reason}</div>
                    {verify.attribution.failed_link || verify.attribution.next_action ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {verify.attribution.failed_link ? (
                          <div className="text-xs leading-6 text-[var(--accent-red)]">
                            失效环节：{verify.attribution.failed_link}
                          </div>
                        ) : null}
                        {verify.attribution.next_action ? (
                          <div className="text-xs leading-6 text-[var(--accent-green)]">
                            下次动作：{verify.attribution.next_action}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="scan-list">
                  {(verify.stocks || []).map((stock) => (
                    <div key={`${detail.data?.date}-${stock.code}`} className="scan-row">
                      <div className="scan-row-copy">
                        <strong>{stock.name}</strong>
                        <span>{stock.code} · {stock.result}</span>
                      </div>
                      <div className="scan-row-value">{stock.change}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="module-node">
                <div className="module-node__label">Waiting</div>
                <div className="module-node__title">当前还没有验证结果</div>
                <div className="module-node__copy">
                  {verificationMeta?.message || '可能是当天记录，或者市场数据还不够完整。这里不会编造结果。'}
                </div>
                {verificationMeta?.retry_after ? (
                  <div className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
                    下次自动重试：{verificationMeta.retry_after.replace('T', ' ').slice(0, 19)}
                  </div>
                ) : null}
                {verificationMeta?.last_error ? (
                  <div className="mt-2 text-xs leading-6 text-[var(--accent-red)]">
                    最近失败：{verificationMeta.last_error}
                  </div>
                ) : null}
              </div>
            )}
          </ModuleShell>

          <ModuleShell
            code="05"
            eyebrow="Self Correction"
            title="系统最近在纠偏什么"
            badge={learning?.window_days ? `${learning.window_days} 日样本` : '样本不足'}
            variant="review"
            motion="pulse"
          >
            {learning ? (
              <div className="grid gap-4">
                <div className="module-node">
                  <div className="module-node__label">Summary</div>
                  <div className="module-node__title">复盘反馈</div>
                  <div className="module-node__copy">{learning.summary}</div>
                </div>

                <div className="module-columns md:grid-cols-2">
                  <div className="module-node">
                    <div className="module-node__label">近期加权方向</div>
                    <div className="mt-4 scan-list">
                      {(learning.top_themes || []).length ? (
                        learning.top_themes.map((item) => (
                          <LearningRow key={`${item.lane}-${item.theme || item.code}`} item={item} tone="good" />
                        ))
                      ) : (
                        <div className="scan-row">
                          <div className="scan-row-copy">
                            <strong>暂无明显强势方向</strong>
                            <span>样本积累后这里会给出加权建议。</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="module-node">
                    <div className="module-node__label">近期降权方向</div>
                    <div className="mt-4 scan-list">
                      {(learning.risk_themes || []).length ? (
                        learning.risk_themes.map((item) => (
                          <LearningRow key={`${item.lane}-${item.theme || item.code}`} item={item} tone="risk" />
                        ))
                      ) : (
                        <div className="scan-row">
                          <div className="scan-row-copy">
                            <strong>暂无明显弱势方向</strong>
                            <span>系统不会为了显得聪明而编造纠偏结论。</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="module-node">
                <div className="module-node__label">Waiting</div>
                <div className="module-node__title">历史样本还不够</div>
                <div className="module-node__copy">复盘样本累积到一定规模后，系统会自动对主题和个股做加减权。</div>
              </div>
            )}
          </ModuleShell>
        </div>
      </div>
    </AppShell>
  );
}
