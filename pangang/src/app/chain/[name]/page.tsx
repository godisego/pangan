'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';

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
  benefitLevel: number;
  stocks: Stock[];
}

interface DimensionScore {
  id: string;
  label: string;
  score: number;
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
  logic?: {
    status: 'valid' | 'invalid' | 'neutral';
    summary: string;
    supports: string[];
    risks: string[];
  };
}

function scoreTone(score: number) {
  if (score >= 75) return 'text-[var(--accent-green)]';
  if (score >= 50) return 'text-[var(--accent-gold)]';
  return 'text-[var(--accent-red)]';
}

function StockList({ title, stocks }: { title: string; stocks: Stock[] }) {
  return (
    <div className="module-node">
      <div className="module-node__label">{title}</div>
      <div className="mt-4 scan-list">
        {stocks.length ? (
          stocks.map((stock, index) => (
            <div key={`${title}-${stock.code}`} className="scan-row">
              <div className="scan-row-copy">
                <strong>
                  {typeof stock.rank === 'number' ? `${stock.rank}. ` : `${index + 1}. `}
                  {stock.name}
                </strong>
                <span>
                  {stock.code}
                  {stock.elasticity ? ` · ${stock.elasticity}` : ''}
                  {typeof stock.coreScore === 'number' ? ` · 核心度 ${stock.coreScore}` : ''}
                </span>
              </div>
              <div className="scan-row-value">
                {typeof stock.change === 'number' ? `${stock.change > 0 ? '+' : ''}${stock.change}%` : '--'}
              </div>
            </div>
          ))
        ) : (
          <div className="scan-row">
            <div className="scan-row-copy">
              <strong>暂无数据</strong>
              <span>当前没有拿到这一组的实时标的。</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChainDetailPage() {
  const params = useParams();
  const chainName = useMemo(() => (params.name ? decodeURIComponent(params.name as string) : ''), [params.name]);

  const [data, setData] = useState<ConceptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!chainName) return;

    try {
      const res = await fetch(`/api/stock/chain/${encodeURIComponent(chainName)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('链路详情加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [chainName]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const overview = data?.overview;
  const sourceLabel =
    data?.dataSource?.sector === 'sector_detail'
      ? '实时板块成分股'
      : data?.dataSource?.sector === 'theme_fallback_quotes'
        ? '主题映射实时股价'
        : '当前未拿到实时成分股';

  const sourceDetail = data?.dataSource
    ? data.dataSource.hotSectorMatched && data.dataSource.matchedSectorName
      ? `已命中实时热板块：${data.dataSource.matchedSectorName}`
      : '当前未命中热板块榜单，先按成分股分布观察。'
    : '当前只保留真实状态，不补示例数据。';

  return (
    <AppShell
      title="链路详情"
      subtitle="只保留真实链路和成分股状态，方便从主线往下多看一层。"
      badge={chainName || '未命名'}
      maxWidthClassName="max-w-6xl"
      actions={
        <button type="button" onClick={() => void fetchData()} className="btn btn-secondary px-4 py-2 text-sm">
          刷新
        </button>
      }
    >
      {loading && !data ? (
        <ModuleShell title="正在加载" badge="处理中" variant="review" motion="pulse">
          <div className="module-node">
            <div className="module-node__label">处理中</div>
            <div className="module-node__title">正在拉取 {chainName || '链路'} 的实时详情</div>
            <div className="module-node__copy">这里只展示当前能拿到的真实数据，不再补 mock 内容。</div>
          </div>
        </ModuleShell>
      ) : null}

      {!loading && !data ? (
        <ModuleShell title="暂时不可用" badge="加载失败" variant="review" motion="pulse">
          <div className="module-node">
            <div className="module-node__label">加载失败</div>
            <div className="module-node__title">这条链路详情暂时没拿到</div>
            <div className="module-node__copy">{error || '稍后再试。'}</div>
          </div>
        </ModuleShell>
      ) : null}

      {data ? (
        <div className="grid gap-4">
          <ModuleShell
            title="当前状态"
            summary="先看这条链路现在处在哪个阶段，再决定要不要继续深读。"
            badge={overview?.stage || '观察中'}
            variant="strategy"
            motion="scan"
          >
            <div className="module-kpi-grid">
              <div className="module-node">
                <div className="module-node__label">板块涨幅</div>
                <div className={`module-node__title ${overview && overview.sectorChange >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                  {typeof overview?.sectorChange === 'number'
                    ? `${overview.sectorChange >= 0 ? '+' : ''}${overview.sectorChange.toFixed(2)}%`
                    : '--'}
                </div>
                <div className="module-node__copy">{data.name} 当前的实时变化。</div>
              </div>
              <div className="module-node">
                <div className="module-node__label">上涨家数</div>
                <div className="module-node__title">
                  {typeof overview?.positiveCount === 'number' && typeof data.count === 'number'
                    ? `${overview.positiveCount}/${data.count}`
                    : '暂无'}
                </div>
                <div className="module-node__copy">当前拿到的成分股里，上涨数量占比。</div>
              </div>
              <div className="module-node">
                <div className="module-node__label">阶段判断</div>
                <div className="module-node__title">{overview?.stage || '观察中'}</div>
                <div className="module-node__copy">结合成分股状态给出的当前阶段。</div>
              </div>
              <div className="module-node">
                <div className="module-node__label">置信度</div>
                <div className={`module-node__title ${scoreTone(overview?.confidence || 0)}`}>
                  {typeof overview?.confidence === 'number' ? `${overview.confidence}%` : '--'}
                </div>
                <div className="module-node__copy">当前阶段判断的可信程度。</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="module-node">
                <div className="module-node__label">前排均价</div>
                <div className="module-node__title">
                  {typeof overview?.leaderAveragePrice === 'number' && overview.leaderAveragePrice > 0
                    ? overview.leaderAveragePrice.toFixed(2)
                    : '--'}
                </div>
                <div className="module-node__copy">前排标的的平均价格水平。</div>
              </div>
              <div className="module-node">
                <div className="module-node__label">平均换手</div>
                <div className="module-node__title">
                  {typeof overview?.turnover === 'number' ? `${overview.turnover.toFixed(2)}%` : '--'}
                </div>
                <div className="module-node__copy">当前成分股的平均换手水平。</div>
              </div>
              <div className="module-node">
                <div className="module-node__label">龙头强度</div>
                <div className="module-node__title">
                  {typeof overview?.leaderTurnoverRatio === 'number' ? `${overview.leaderTurnoverRatio.toFixed(2)}x` : '--'}
                </div>
                <div className="module-node__copy">看前排是否明显强于板块平均。</div>
              </div>
            </div>
          </ModuleShell>

          {data.logic ? (
            <ModuleShell title="逻辑判断" badge={data.logic.status === 'valid' ? '逻辑成立' : data.logic.status === 'invalid' ? '逻辑证伪' : '继续观察'} variant="review" motion="track">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="module-node">
                  <div className="module-node__label">当前结论</div>
                  <div className="module-node__title">{data.logic.status === 'valid' ? '逻辑成立' : data.logic.status === 'invalid' ? '逻辑证伪' : '继续观察'}</div>
                  <div className="module-node__copy">{data.logic.summary}</div>
                </div>
                <div className="grid gap-3">
                  <div className="module-node">
                    <div className="module-node__label">支撑因素</div>
                    <div className="mt-3 grid gap-2">
                      {(data.logic.supports || []).length ? (
                        data.logic.supports.map((item) => (
                          <div key={item} className="text-sm leading-7 text-[var(--text-secondary)]">{item}</div>
                        ))
                      ) : (
                        <div className="text-sm leading-7 text-[var(--text-secondary)]">暂无补充。</div>
                      )}
                    </div>
                  </div>
                  <div className="module-node">
                    <div className="module-node__label">风险提示</div>
                    <div className="mt-3 grid gap-2">
                      {(data.logic.risks || []).length ? (
                        data.logic.risks.map((item) => (
                          <div key={item} className="text-sm leading-7 text-[var(--accent-red)]">{item}</div>
                        ))
                      ) : (
                        <div className="text-sm leading-7 text-[var(--text-secondary)]">暂无补充。</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ModuleShell>
          ) : null}

          {data.news?.length ? (
            <ModuleShell title="新闻证据" summary="只放这条链路当前关联到的消息。" badge={`${data.news.length} 条`} variant="strategy" motion="scan">
              <div className="scan-list">
                {data.news.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="scan-row">
                    <div className="scan-row-copy">
                      <strong>{item.title}</strong>
                      <span>{item.source} · {item.time || '实时'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ModuleShell>
          ) : null}

          {data.dimensions?.length ? (
            <ModuleShell title="维度评分" badge={`${data.dimensions.length} 项`} variant="evidence" motion="drift">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.dimensions.map((item) => (
                  <div key={item.id} className="module-node">
                    <div className="module-node__label">{item.label}</div>
                    <div className={`module-node__title ${scoreTone(item.score)}`}>{item.score}分</div>
                    <div className="module-node__copy">分数越高，说明这一维当前越支持继续观察这条链路。</div>
                  </div>
                ))}
              </div>
            </ModuleShell>
          ) : null}

          {data.chainStructure?.length ? (
            <ModuleShell title="结构拆解" summary="看板块内部最值得盯的环节。" badge={`${data.chainStructure.length} 段`} variant="strategy" motion="track">
              <div className="grid gap-4">
                {data.chainStructure.map((segment) => (
                  <div key={`${segment.segment}-${segment.tag}`} className="module-node">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="module-node__label">{segment.tag || '当前环节'}</div>
                        <div className="module-node__title">{segment.segment}</div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {segment.stage || '观察中'} · 受益程度 {segment.benefitLevel || 0}/5
                      </div>
                    </div>
                    <div className="mt-4 scan-list">
                      {(segment.stocks || []).length ? (
                        segment.stocks.map((stock, index) => (
                          <div key={`${segment.segment}-${stock.code}`} className="scan-row">
                            <div className="scan-row-copy">
                              <strong>
                                {typeof stock.rank === 'number' ? `${stock.rank}. ` : `${index + 1}. `}
                                {stock.name}
                              </strong>
                              <span>
                                {stock.code}
                                {typeof stock.coreScore === 'number' ? ` · 核心度 ${stock.coreScore}` : ''}
                                {stock.elasticity ? ` · ${stock.elasticity}` : ''}
                              </span>
                            </div>
                            <div className="scan-row-value">
                              {typeof stock.change === 'number' ? `${stock.change > 0 ? '+' : ''}${stock.change}%` : '--'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="scan-row">
                          <div className="scan-row-copy">
                            <strong>暂无标的</strong>
                            <span>这一环节当前还没拿到实时成分股。</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ModuleShell>
          ) : null}

          {data.groups ? (
            <ModuleShell title="分组观察" summary="按前排、跟随和走弱分开看，不再跳旧个股详情页。" badge="实时分组" variant="review" motion="drift">
              <div className="grid gap-4 xl:grid-cols-3">
                <StockList title="前排" stocks={data.groups.leaders || []} />
                <StockList title="跟随" stocks={data.groups.followers || []} />
                <StockList title="走弱" stocks={data.groups.declining || []} />
              </div>
            </ModuleShell>
          ) : null}

          <ModuleShell title="数据说明" badge={sourceLabel} variant="review" motion="pulse">
            <div className="module-node">
              <div className="module-node__label">当前来源</div>
              <div className="module-node__title">{sourceLabel}</div>
              <div className="module-node__copy">{sourceDetail}</div>
            </div>
            {data.count === 0 ? (
              <div className="mt-4 module-node">
                <div className="module-node__label">当前状态</div>
                <div className="module-node__title">暂未拿到实时成分股</div>
                <div className="module-node__copy">这个页面不会再补 mock 数据。等数据源恢复后，这里的结构和分组会自动切回真实内容。</div>
              </div>
            ) : null}
          </ModuleShell>
        </div>
      ) : null}
    </AppShell>
  );
}
