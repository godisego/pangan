'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { chatApi, commanderApi } from '@/lib/api';
import { getProviderById, getProviderLabel } from '@/lib/aiProviders';
import { defaultSettings, loadUserSettings, type UserSettings } from '@/lib/localSettings';
import type { ChatProviderCatalogResponse, CommanderSummary } from '@/types/api';

type MessageRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timeLabel: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const CHAT_STORAGE_KEY = 'pangang_chat_sessions_v2';
const QUICK_PROMPTS = [
  { label: '看今天', prompt: '结合当前作战上下文，先给我一句结论：今天更偏进攻还是防守？然后给出理由、验证点和证伪点。' },
  { label: 'AI 选股', prompt: '结合当前主线、市场过滤器和推荐股票池，给我 3 只今天最值得跟踪的股票，并分别说清楚原因、买点关注项和风险。' },
  { label: '盯趋势', prompt: '如果我今天只做一件事，你建议我重点盯什么趋势？请按“先看什么，再看什么，什么信号出现就行动”的格式回答。' },
];

const navLinks = [
  { href: '/', label: '总览' },
  { href: '/commander', label: '作战' },
  { href: '/review', label: '复盘' },
  { href: '/settings', label: '设置' },
];

function formatTimeLabel(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSessionDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return formatTimeLabel(date);
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function createIntroMessage(): ChatMessage {
  return {
    id: `intro-${Date.now()}`,
    role: 'assistant',
    content:
      '你好，我是盘感 AI。你可以直接问主线、个股、证伪点，或者把你的判断丢给我，我会先给结论，再给理由和风险点。',
    timeLabel: '刚刚',
  };
}

function createSession(): ChatSession {
  const now = Date.now();
  return {
    id: `session-${now}`,
    title: '新对话',
    updatedAt: now,
    messages: [createIntroMessage()],
  };
}

function deriveSessionTitle(content: string) {
  const trimmed = content.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '新对话';
  return trimmed.length > 20 ? `${trimmed.slice(0, 20)}...` : trimmed;
}

function sortSessions(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [createIntroMessage()];
  }

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<ChatMessage>;
      const role = record.role === 'user' ? 'user' : record.role === 'assistant' ? 'assistant' : null;
      const content = typeof record.content === 'string' ? record.content.trim() : '';

      if (!role || !content) return null;

      return {
        id: typeof record.id === 'string' ? record.id : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        timeLabel: typeof record.timeLabel === 'string' && record.timeLabel ? record.timeLabel : formatTimeLabel(),
      } satisfies ChatMessage;
    })
    .filter((message): message is ChatMessage => Boolean(message));

  return normalized.length > 0 ? normalized : [createIntroMessage()];
}

function loadChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortSessions(
      parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Partial<ChatSession>;
          return {
            id: typeof record.id === 'string' ? record.id : `session-${Date.now()}`,
            title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : '新对话',
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
            messages: normalizeMessages(record.messages),
          } satisfies ChatSession;
        })
        .filter((session): session is ChatSession => Boolean(session))
    );
  } catch {
    return [];
  }
}

function saveChatSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sortSessions(sessions)));
}

function buildContextPrompt(summary?: CommanderSummary | null) {
  if (!summary) return '';

  const attack = summary.mainlines.logic_a?.name || '无';
  const defense = summary.mainlines.logic_b?.name || '无';
  const event = summary.news_analysis?.lead_event || summary.news_analysis?.headline || '暂无明确主事件';
  const implication = summary.news_analysis?.market_implication || '暂无明确市场含义';
  const diagnosis = summary.review?.diagnosis
    ? `复盘诊断：${summary.review.diagnosis.label}，${summary.review.diagnosis.reason}`
    : '';

  return [
    '以下是当前产品上下文，请优先基于这些信息回答：',
    `当前阶段：${summary.factor_engine?.stage || summary.phase_label || '待确认'} / ${summary.action_now || '等待确认'}`,
    `执行过滤：${summary.trade_filter?.state || '仅观察'}，${summary.trade_filter?.reason || '暂无原因'}`,
    `进攻主线：${attack}`,
    `防守主线：${defense}`,
    `主事件：${event}`,
    `市场含义：${implication}`,
    diagnosis,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function ChatPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [runtimeCatalog, setRuntimeCatalog] = useState<ChatProviderCatalogResponse | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [input, setInput] = useState('');
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [briefingContext, setBriefingContext] = useState<CommanderSummary | null>(null);
  const [contextRefreshing, setContextRefreshing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextSettings = loadUserSettings();
    const storedSessions = loadChatSessions();
    const initialSessions = storedSessions.length > 0 ? storedSessions : [createSession()];

    setSettings(nextSettings);
    setSessions(initialSessions);
    setCurrentSessionId(initialSessions[0].id);
    setIsReady(true);

    void chatApi.getProviders()
      .then((catalog) => {
        setRuntimeCatalog(catalog);
      })
      .catch(() => {
        // keep chat usable with local settings only
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadContext = async () => {
      try {
        setContextRefreshing(true);
        const summary = await commanderApi.getSummary();
        if (!cancelled) {
          setBriefingContext(summary);
        }
      } catch {
        // keep chat usable even if commander context is unavailable
      } finally {
        if (!cancelled) {
          setContextRefreshing(false);
        }
      }
    };

    void loadContext();
    const interval = window.setInterval(() => {
      void loadContext();
    }, 120000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    saveChatSessions(sessions);
  }, [isReady, sessions]);

  useEffect(() => {
    if (!sessions.length) return;

    const hasCurrent = sessions.some((session) => session.id === currentSessionId);
    if (!hasCurrent) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [currentSessionId, sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSessionId, sessions, loadingSessionId]);

  const currentSession = sessions.find((session) => session.id === currentSessionId) ?? sessions[0] ?? null;
  const messages = currentSession?.messages ?? [];
  const sharedAi = runtimeCatalog?.shared_ai;
  const hasLocalAiKey = Boolean(settings.ai.apiKey.trim());
  const activeProviderId = hasLocalAiKey
    ? settings.ai.provider
    : sharedAi?.enabled
      ? sharedAi.provider || settings.ai.provider
      : settings.ai.provider;
  const activeProvider = getProviderById(
    activeProviderId,
    runtimeCatalog?.providers?.length ? runtimeCatalog.providers : undefined
  );
  const activeModel = hasLocalAiKey
    ? settings.ai.model || activeProvider.default_model
    : sharedAi?.enabled
      ? sharedAi.model || activeProvider.default_model
      : settings.ai.model || activeProvider.default_model;
  const aiReady = hasLocalAiKey || Boolean(sharedAi?.enabled);
  const providerLabel = getProviderLabel(activeProviderId);

  const createAndSelectSession = () => {
    const nextSession = createSession();
    setSessions((prev) => sortSessions([nextSession, ...prev]));
    setCurrentSessionId(nextSession.id);
    setInput('');
    setIsHistoryOpen(false);
    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((prev) =>
      sortSessions(
        prev.map((session) => (session.id === sessionId ? updater(session) : session))
      )
    );
  };

  const appendAssistantMessage = (sessionId: string, content: string) => {
    const now = Date.now();
    updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: now,
      messages: [
        ...session.messages,
        {
          id: `msg-${now}`,
          role: 'assistant',
          content,
          timeLabel: formatTimeLabel(),
        },
      ],
    }));
  };

  const handleSend = async (overrideInput?: string) => {
    const draft = (overrideInput ?? input).trim();
    if (!draft || loadingSessionId || !currentSession) return;

    if (!aiReady) {
      appendAssistantMessage(
        currentSession.id,
        '当前站点还没有可用的 AI 能力。你可以去设置页填写个人 Key，或者让站点拥有者在服务端配置共享 AI。'
      );
      return;
    }

    const outgoingContent = draft;
    const activeSessionId = currentSession.id;
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: outgoingContent,
      timeLabel: formatTimeLabel(),
    };

    setInput('');
    setLoadingSessionId(activeSessionId);

    updateSession(activeSessionId, (session) => {
      const hasRealConversation = session.messages.some((message) => message.role === 'user');
      return {
        ...session,
        title: hasRealConversation ? session.title : deriveSessionTitle(outgoingContent),
        updatedAt: Date.now(),
        messages: [...session.messages, userMessage],
      };
    });

    try {
      const response = await chatApi.send({
        provider: activeProviderId || 'zhipu',
        api_key: hasLocalAiKey ? settings.ai.apiKey : undefined,
        model: activeModel || 'glm-4.7-flash',
        base_url: hasLocalAiKey && activeProvider.requires_base_url ? settings.ai.baseUrl || undefined : undefined,
        messages: [
          {
            role: 'system',
            content:
              '你是盘感 AI 投研助手。回答要简洁、直接、专业，优先给出结论、理由、验证点和证伪点。',
          },
          ...(briefingContext
            ? [
                {
                  role: 'system' as const,
                  content: buildContextPrompt(briefingContext),
                },
              ]
            : []),
          ...currentSession.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            role: 'user',
            content: outgoingContent,
          },
        ],
      });

      appendAssistantMessage(activeSessionId, response.reply);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI 对话失败';
      const friendlyMessage = /timed out|超时/i.test(errorMessage)
        ? `当前模型响应较慢或上游接口暂时拥堵。\n\n已自动延长等待时间；如果仍失败，建议稍后重试，或切换到更快的模型，例如 glm-4.7-flash、glm-4.5-air、qwen-flash。`
        : `对话请求失败：${errorMessage}\n\n请检查 API Key、模型名和后端服务状态。`;
      appendAssistantMessage(
        activeSessionId,
        friendlyMessage
      );
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[300px] shrink-0 border-r border-[var(--border-color)] bg-[rgba(5,14,21,0.9)] xl:flex xl:flex-col">
          <div className="border-b border-[var(--border-color)] px-5 py-5">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.06)] font-mono text-sm font-semibold">
                PG
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">盘感 AI</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">Chat Workspace</div>
              </div>
            </Link>
          </div>

          <div className="border-b border-[var(--border-color)] px-4 py-4">
            <button type="button" onClick={createAndSelectSession} className="btn btn-primary w-full px-4 py-3 text-sm">
              新对话
            </button>
          </div>

          <nav className="border-b border-[var(--border-color)] px-3 py-3">
            <div className="grid gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="px-5 pt-4 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            历史对话
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setCurrentSessionId(session.id)}
                className={`w-full rounded-[20px] px-4 py-3 text-left transition ${
                  session.id === currentSessionId
                    ? 'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.035)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="truncate text-sm font-medium">{session.title}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{formatSessionDate(session.updatedAt)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--border-color)] bg-[rgba(6,16,24,0.92)] px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="btn btn-secondary px-3 py-2 text-xs xl:hidden"
                >
                  历史
                </button>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {currentSession?.title || '新对话'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{providerLabel}</span>
                    <span>·</span>
                    <span>{activeModel || '未设置模型'}</span>
                    <span>·</span>
                    <span>{aiReady ? '已连接' : '待配置'}</span>
                    {sharedAi?.enabled && !hasLocalAiKey ? (
                      <>
                        <span>·</span>
                        <span className="text-[var(--accent-green)]">平台共享 AI</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={createAndSelectSession} className="btn btn-secondary px-3 py-2 text-xs">
                  新对话
                </button>
                <Link href="/settings" className="btn btn-secondary px-3 py-2 text-xs">
                  设置
                </Link>
              </div>
            </div>
          </header>

          {!aiReady ? (
            <div className="border-b border-[rgba(246,199,125,0.16)] bg-[rgba(246,199,125,0.08)] px-4 py-3 text-sm text-[var(--text-secondary)] md:px-6">
              当前未配置可用的 AI 能力。先去
              <Link href="/settings" className="mx-1 text-[var(--accent-gold)] underline decoration-transparent transition hover:decoration-inherit">
                设置页
              </Link>
              配置个人 Key，或在服务端启用共享 AI，再回来开始真实对话。
            </div>
          ) : null}

          {briefingContext ? (
            <div className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-secondary)] md:px-6">
              <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
                <span className="module-badge">阶段 {briefingContext.factor_engine?.stage || briefingContext.phase_label || '待确认'}</span>
                <span className="module-badge">{briefingContext.trade_filter?.state || '仅观察'}</span>
                <span className="module-badge">A {briefingContext.mainlines.logic_a?.name || '无'}</span>
                <span className="module-badge">B {briefingContext.mainlines.logic_b?.name || '无'}</span>
                {(briefingContext.news_analysis?.lead_event || briefingContext.news_analysis?.headline) ? (
                  <span className="text-xs text-[var(--text-muted)]">
                    主事件：{briefingContext.news_analysis?.lead_event || briefingContext.news_analysis?.headline}
                  </span>
                ) : null}
                {sharedAi?.enabled && !hasLocalAiKey ? (
                  <span className="text-xs text-[var(--accent-green)]">当前使用平台共享 AI</span>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setContextRefreshing(true);
                      const summary = await commanderApi.getSummary();
                      setBriefingContext(summary);
                    } finally {
                      setContextRefreshing(false);
                    }
                  }}
                  className="btn btn-secondary ml-auto px-3 py-2 text-xs"
                >
                  {contextRefreshing ? '刷新上下文中...' : '刷新上下文'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                {!isReady || !currentSession ? (
                  <div className="flex min-h-[48vh] items-center justify-center text-sm text-[var(--text-secondary)]">
                    正在准备对话...
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => void handleSend(item.prompt)}
                          className="btn btn-secondary px-3 py-2 text-xs"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}

                    {loadingSessionId === currentSession.id ? (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-cyan-dim)] text-sm font-semibold text-[var(--accent-cyan)]">
                          AI
                        </div>
                        <div className="rounded-[22px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                          正在思考...
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="px-4 pb-4 pt-3 md:px-6 md:pb-6">
              <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-[var(--border-color)] bg-[rgba(8,18,28,0.9)] p-3 shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={aiReady ? '问主线、问个股、问证伪点，或直接点上面的快捷问题' : '先去设置页配置个人 Key，或启用平台共享 AI'}
                  className="min-h-[120px] w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  rows={5}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-2 pt-3">
                  <div className="text-xs text-[var(--text-muted)]">Enter 发送，Shift + Enter 换行</div>
                  <button
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || Boolean(loadingSessionId) || !currentSession}
                    className="btn btn-primary min-w-[108px] px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingSessionId ? '发送中' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isHistoryOpen ? (
        <div className="fixed inset-0 z-[70] bg-[rgba(1,7,12,0.76)] backdrop-blur-sm xl:hidden">
          <div className="flex h-full w-[86%] max-w-[320px] flex-col border-r border-[var(--border-color)] bg-[rgba(5,14,21,0.98)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-4">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">历史对话</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">切换会话或新建</div>
              </div>
              <button type="button" onClick={() => setIsHistoryOpen(false)} className="btn btn-secondary px-3 py-2 text-xs">
                关闭
              </button>
            </div>

            <div className="border-b border-[var(--border-color)] px-4 py-4">
              <button type="button" onClick={createAndSelectSession} className="btn btn-primary w-full px-4 py-3 text-sm">
                新对话
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setCurrentSessionId(session.id);
                    setIsHistoryOpen(false);
                  }}
                  className={`w-full rounded-[18px] px-4 py-3 text-left transition ${
                    session.id === currentSessionId
                      ? 'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.035)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="truncate text-sm font-medium">{session.title}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{formatSessionDate(session.updatedAt)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-cyan-dim)] text-sm font-semibold text-[var(--accent-cyan)]">
          AI
        </div>
      ) : null}

      <div className={`max-w-[88%] ${isUser ? 'text-right' : ''}`}>
        <div className={`mb-1.5 text-xs text-[var(--text-muted)] ${isUser ? 'text-right' : ''}`}>{message.timeLabel}</div>
        <div
          className={`rounded-[24px] px-4 py-3 text-sm leading-7 ${
            isUser
              ? 'bg-[linear-gradient(135deg,rgba(246,199,125,0.96),rgba(141,220,255,0.88))] text-[#061018]'
              : 'border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] text-[var(--text-primary)]'
          }`}
        >
          <FormattedMessageContent content={message.content} isUser={isUser} />
        </div>
      </div>
    </div>
  );
}

function FormattedMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const blocks = content.split('\n\n').filter(Boolean);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter(Boolean);
        const isBulletGroup = lines.every((line) => /^(\s*[-•]|\d+\.)\s+/.test(line));

        if (isBulletGroup) {
          return (
            <ul key={`${index}-${lines[0]}`} className="space-y-2">
              {lines.map((line, lineIndex) => (
                <li key={`${lineIndex}-${line}`} className="flex gap-2">
                  <span className={isUser ? 'text-[#061018]/60' : 'text-[var(--accent-cyan)]'}>•</span>
                  <span>{renderInline(line.replace(/^(\s*[-•]|\d+\.)\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        return <p key={`${index}-${lines[0]}`}>{renderInline(block)}</p>;
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
