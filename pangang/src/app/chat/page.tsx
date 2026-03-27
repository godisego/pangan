'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { chatApi } from '@/lib/api';
import { loadUserSettings } from '@/lib/localSettings';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  stocks?: Stock[];
  timestamp: Date;
}

interface Stock {
  name: string;
  code: string;
  score: number;
  reason: string;
}

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    content:
      '我是盘感 AI。适合问主题、问个股、做验证。试试这些问题：\n\n• 今天 AI 算力还能不能继续做？\n• 帮我分析一下宁德时代\n• 我觉得高股息要继续走强，你帮我找证伪点',
    timestamp: new Date(),
  },
];

const quickPrompts = [
  { label: 'AI 算力', prompt: '今天 AI 算力方向还能不能继续做？' },
  { label: '宁德时代', prompt: '帮我分析一下宁德时代现在适合低吸还是继续等。' },
  { label: '高股息', prompt: '我觉得高股息要继续走强，你帮我找证伪点。' },
  { label: '今日市场', prompt: '今天市场最值得盯的两个方向是什么？' },
];

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const settings = loadUserSettings();
  const aiReady = Boolean(settings.ai.apiKey);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!aiReady) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: '当前没有可用的 AI Key。先去设置中心填写智谱 API Key，并把模型名保持为 `glm-4.7-flash`。',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatApi.send({
        provider: settings.ai.provider || 'zhipu',
        api_key: settings.ai.apiKey,
        model: settings.ai.model || 'glm-4.7-flash',
        messages: [
          {
            role: 'system',
            content:
              '你是盘感 AI 投研助手。回答要简洁、直接、专业，优先围绕 A 股、板块趋势、个股逻辑、风险点和执行建议来组织。',
          },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            role: 'user',
            content: userMessage.content,
          },
        ],
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI 对话失败';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `对话请求失败：${errorMessage}\n\n请检查：\n1. API Key 是否有效\n2. 模型名是否为 \`glm-4.7-flash\`\n3. 后端服务是否正常运行`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <AppShell
      title="AI 助手"
      subtitle="这里不做花架子，只保留当前引擎、快捷问题和对话主线程。"
      badge="解释层"
      maxWidthClassName="max-w-6xl"
      contentClassName="space-y-5 pb-40"
      showMobileNav={false}
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link href="/commander" className="btn btn-secondary px-4 py-2 text-sm">
            作战室
          </Link>
          <Link href="/settings" className="btn btn-secondary px-4 py-2 text-sm">
            设置中心
          </Link>
        </div>
      )}
    >
      <section className="surface-panel animate-stage p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="引擎" value={settings.ai.provider || '未设置'} hint={settings.ai.model || '未设置模型'} />
          <Metric label="状态" value={aiReady ? '已配置' : '未配置'} hint={aiReady ? '可以直接发起真实对话' : '先去设置页填写 API Key'} />
          <Metric label="线程" value={`${messages.length}`} hint="当前对话消息数" />
          <Metric label="用途" value="问主题 / 问个股 / 做验证" hint="今天的执行动作仍回到作战室确认" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className="surface-panel animate-stage p-5">
          <div className="text-lg font-semibold text-[var(--text-primary)]">快捷问题</div>
          <div className="mt-4 grid gap-3">
            {quickPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setInput(item.prompt)}
                className="action-card compact text-left"
              >
                <div className="action-label">填入问题</div>
                <div className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{item.label}</div>
                <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{item.prompt}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="surface-panel animate-stage p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-[var(--text-primary)]">对话主线程</div>
            <div className="metric-chip"><strong>{messages.length} 条消息</strong></div>
          </div>

          <div className="mt-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isLoading ? (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-green)]/15 shadow-[0_0_0_1px_rgba(90,242,181,0.18)]">
                  <SparkleIcon className="h-4 w-4 text-[var(--accent-green)]" />
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <div className="text-sm text-[var(--text-secondary)]">AI 正在思考...</div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/94 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="rounded-[22px] border border-[var(--border-color)] bg-[rgba(9,19,28,0.9)] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入你的问题、投资假设或想验证的逻辑..."
                className="input min-h-[60px] max-h-[140px] flex-1 resize-none rounded-[18px]"
                rows={1}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isLoading}
                className="btn btn-primary px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const roleLabel = isUser ? '你' : '盘感AI';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)] ${
          isUser ? 'bg-[var(--bg-card)]' : 'bg-[var(--accent-green)]/15'
        }`}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-[var(--text-secondary)]" />
        ) : (
          <SparkleIcon className="h-4 w-4 text-[var(--accent-green)]" />
        )}
      </div>

      <div className={`max-w-[84%] ${isUser ? 'text-right' : ''}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span
            className={`rounded-full px-2 py-1 ${
              isUser ? 'bg-[var(--accent-gold-dim)] text-[var(--accent-gold)]' : 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]'
            }`}
          >
            {roleLabel}
          </span>
          <span>{message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <div
          className={`rounded-[20px] border px-4 py-4 ${
            isUser
              ? 'border-[rgba(246,199,125,0.18)] bg-[linear-gradient(135deg,rgba(246,199,125,0.92),rgba(141,220,255,0.78))] text-[#061018]'
              : 'border-[var(--border-color)] bg-[var(--bg-card)]/95'
          }`}
        >
          <FormattedMessageContent content={message.content} isUser={isUser} />
        </div>

        {message.stocks?.length ? (
          <div className="mt-3 space-y-2">
            {message.stocks.map((stock) => (
              <Link
                key={stock.code}
                href={`/stock/${stock.code}`}
                className="data-tile flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{stock.name}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{stock.code}</div>
                </div>
                <div className="text-right">
                  <div className="score text-sm">⭐ {stock.score}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">{stock.reason}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FormattedMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const blocks = content.split('\n\n').filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-7">
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter(Boolean);
        const isBulletGroup = lines.every((line) => /^(\s*[-•]|\d+\.)\s+/.test(line));

        if (isBulletGroup) {
          return (
            <ul key={`${index}-${lines[0]}`} className={`space-y-2 ${isUser ? 'text-[#061018]/88' : 'text-[var(--text-secondary)]'}`}>
              {lines.map((line, lineIndex) => (
                <li key={`${lineIndex}-${line}`} className="flex gap-2">
                  <span className={isUser ? 'text-[#061018]/60' : 'text-[var(--accent-green)]'}>•</span>
                  <span>{renderInline(line.replace(/^(\s*[-•]|\d+\.)\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${index}-${lines[0]}`} className={isUser ? 'text-[#061018]/90' : 'text-[var(--text-secondary)]'}>
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={`${token}-${index}`} className="rounded-md bg-black/20 px-1.5 py-0.5 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={`${token}-${index}`} className="font-semibold text-inherit">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return token;
  });
}

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function UserIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
        clipRule="evenodd"
      />
    </svg>
  );
}
