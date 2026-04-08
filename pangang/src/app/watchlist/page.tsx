'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';

export default function WatchlistPage() {
  return (
    <AppShell
      title="自选"
      subtitle="这一页原来依赖本地自选和旧报价逻辑，当前先不作为主流程能力展示。"
      badge="已降级"
      maxWidthClassName="max-w-4xl"
    >
      <ModuleShell
        title="暂时收起"
        summary="为了避免继续展示不稳定的旧入口，这里先只保留说明和返回路径。"
        badge="旧功能"
        variant="review"
        motion="pulse"
      >
        <div className="grid gap-4">
          <div className="module-node">
            <div className="module-node__label">当前状态</div>
            <div className="module-node__title">自选页暂不作为日常入口</div>
            <div className="module-node__copy">
              旧版自选依赖本地浏览器存储、逐只拉报价和默认示例数据，和现在的真实决策主流程不一致，所以先明确降级，不再继续展示成可直接使用的核心能力。
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Link href="/" className="action-card compact text-left">
              <div className="module-node__label">回到首页</div>
              <div className="module-node__title">先看今天结论</div>
              <div className="module-node__copy">总览里保留了今天真正要先看的信息。</div>
            </Link>
            <Link href="/commander" className="action-card compact text-left">
              <div className="module-node__label">继续作战</div>
              <div className="module-node__title">查看主线和候选</div>
              <div className="module-node__copy">需要细看执行方向时，直接进作战页。</div>
            </Link>
            <Link href="/chat" className="action-card compact text-left">
              <div className="module-node__label">直接提问</div>
              <div className="module-node__title">让对话帮你筛</div>
              <div className="module-node__copy">想追问个股或方向时，直接在对话里问更有效。</div>
            </Link>
          </div>
        </div>
      </ModuleShell>
    </AppShell>
  );
}
