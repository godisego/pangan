'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { macroApi } from '@/lib/api';
import { loadUserSettings } from '@/lib/localSettings';
import { REFRESH_INTERVALS } from '@/utils/constants';
import type { MacroDashboard } from '@/types/api';

function NewsRow({
  title,
  source,
  impact,
}: {
  title: string;
  source: string;
  impact: string;
}) {
  return (
    <div className="scan-row">
      <div className="scan-row-copy">
        <strong>{title}</strong>
        <span>{impact}</span>
      </div>
      <div className="scan-row-value">{source}</div>
    </div>
  );
}

function CycleCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
      <div className="module-node__copy">{detail}</div>
    </div>
  );
}

function ThemeStrip({ themes }: { themes: string[] }) {
  if (!themes.length) {
    return <div className="module-node__copy">当前没有明确主题。</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((theme) => (
        <span key={theme} className="tag tag-hot">
          {theme}
        </span>
      ))}
    </div>
  );
}

export default function MacroStrategyDashboard({ className = '' }: { className?: string }) {
  const [macroData, setMacroData] = useState<MacroDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMacro = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const settings = loadUserSettings();
      const data = await macroApi.getDashboard({
        provider: settings.ai.provider,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model || 'glm-4.7-flash',
        baseUrl: settings.ai.provider === 'custom' ? settings.ai.baseUrl || undefined : undefined,
      });
      setMacroData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '宏观分析暂时不可用');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMacro();
    const interval = window.setInterval(() => {
      void fetchMacro();
    }, REFRESH_INTERVALS.MACRO_DASHBOARD);
    return () => window.clearInterval(interval);
  }, [fetchMacro]);

  const engineLabel = useMemo(() => {
    if (!macroData) return loading ? '分析中' : '未就绪';
    return macroData.engine?.used_api
      ? `${macroData.engine.provider} · ${macroData.engine.model}`
      : '规则兜底';
  }, [loading, macroData]);

  if (!macroData) {
    return (
      <div className={`grid gap-4 ${className}`}>
        <div className="module-node">
          <div className="module-node__label">Engine</div>
          <div className="module-node__title">{loading ? '正在生成宏观解释...' : '宏观解释暂时不可用'}</div>
          <div className="module-node__copy">
            {error || `当前引擎：${engineLabel}。正在等待新闻、周期和长短线建议返回。`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${className}`}>
      <div className="module-columns xl:grid-cols-[1.08fr_0.92fr]">
        <div className="module-node">
          <div className="module-node__label">Step 1 · 新闻模块</div>
          <div className="module-node__title">先看今天最值得纳入判断的新闻</div>
          <div className="mt-4 scan-list">
            {(macroData.news_brief || []).map((item) => (
              <NewsRow key={`${item.source}-${item.title}`} title={item.title} source={item.source} impact={item.impact} />
            ))}
          </div>
        </div>

        <div className="module-node">
          <div className="module-node__label">Step 2 · 周期框架</div>
          <div className="module-node__title">再把新闻放进长期、中期、短线三层框架</div>
          <div className="mt-4 grid gap-3">
            <CycleCard
              label="长期"
              value={macroData.cycle_framework?.secular || '未给出'}
              detail="对应技术升级、资本开支、产业渗透等更长的趋势判断。"
            />
            <CycleCard
              label="中期"
              value={macroData.cycle_framework?.cyclical || '未给出'}
              detail="对应政策、信用、盈利和风险偏好的 1-4 季变化。"
            />
            <CycleCard
              label="短线"
              value={macroData.cycle_framework?.tactical || '未给出'}
              detail="对应未来几天到两周的交易环境。"
            />
          </div>
        </div>
      </div>

      <div className="module-node">
        <div className="module-node__label">Step 3 · 解释结论</div>
        <div className="module-node__title">今天这条主线为什么能站得住</div>
        <div className="module-node__copy">
          {macroData.cycle_framework?.summary || macroData.macro_mainline?.narrative || '当前还没有主线解释。'}
        </div>
      </div>

      <div className="module-columns xl:grid-cols-2">
        <div className="module-node">
          <div className="module-node__label">Step 4 · 长线建议</div>
          <div className="module-node__title">{macroData.long_term_view?.stance || '长线暂未给出'}</div>
          <div className="mt-4">
            <ThemeStrip themes={macroData.long_term_view?.themes || []} />
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            {macroData.long_term_view?.rationale || '当前还没有长线建议。'}
          </div>
        </div>

        <div className="module-node">
          <div className="module-node__label">Step 5 · 短线建议</div>
          <div className="module-node__title">{macroData.short_term_view?.stance || '短线暂未给出'}</div>
          <div className="mt-4">
            <ThemeStrip themes={macroData.short_term_view?.focus || []} />
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            {macroData.short_term_view?.rationale || '当前还没有短线建议。'}
          </div>
          {macroData.short_term_view?.risk_trigger ? (
            <div className="mt-4 rounded-[18px] border border-[rgba(255,123,136,0.22)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
              风险触发：{macroData.short_term_view.risk_trigger}
            </div>
          ) : null}
        </div>
      </div>

      <div className="text-right text-xs text-[var(--text-muted)]">引擎：{engineLabel}</div>
    </div>
  );
}
