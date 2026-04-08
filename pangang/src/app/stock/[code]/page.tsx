'use client';

import Link from 'next/link';
import { use } from 'react';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <AppShell
      title="个股详情"
      subtitle="这一页原来混用了示例数据、本地直连和展示型分析卡片，当前先不把它当成真实能力入口。"
      badge={code}
      maxWidthClassName="max-w-4xl"
    >
      <ModuleShell
        title="先回主流程"
        summary="避免把旧的 mock 详情页继续包装成可用能力，这里先明确提示并提供更可靠的入口。"
        badge="已降级"
        variant="review"
        motion="pulse"
      >
        <div className="grid gap-4">
          <div className="module-node">
            <div className="module-node__label">当前状态</div>
            <div className="module-node__title">{code} 暂不提供独立详情页</div>
            <div className="module-node__copy">
              旧版个股详情混有大量示例内容和不稳定链路，继续保留会让页面看起来很完整，但实际并不可靠。当前先收起，避免误导判断。
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Link href="/commander" className="action-card compact text-left">
              <div className="module-node__label">看作战</div>
              <div className="module-node__title">先看今天主线</div>
              <div className="module-node__copy">从主线和候选池先判断值不值得继续跟。</div>
            </Link>
            <Link href="/review" className="action-card compact text-left">
              <div className="module-node__label">看复盘</div>
              <div className="module-node__title">先看有没有验证</div>
              <div className="module-node__copy">如果这个方向近期做过，会先在复盘里留下结果。</div>
            </Link>
            <Link href="/chat" className="action-card compact text-left">
              <div className="module-node__label">去对话</div>
              <div className="module-node__title">直接问 {code}</div>
              <div className="module-node__copy">让对话结合今天上下文，直接解释逻辑、风险和证伪点。</div>
            </Link>
          </div>
        </div>
      </ModuleShell>
    </AppShell>
  );
}
