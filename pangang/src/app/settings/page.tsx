'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { loadUserSettings, saveUserSettings, type UserSettings } from '@/lib/localSettings';
import { API_CONFIG } from '@/utils/constants';

type MessageState = { type: '' | 'success' | 'error' | 'info'; text: string };
type NotifyChannelResult = {
  message?: string;
  ok?: boolean;
  errcode?: number;
  StatusCode?: number;
  code?: number;
};
type NotifyResponse = {
  status?: string;
  sent?: number;
  total?: number;
  results?: Record<string, NotifyChannelResult>;
};

const inputClassName =
  'w-full rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none';

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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-panel animate-stage p-5">
      <div className="text-lg font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
        {hint ? <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-primary)]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
  const [msg, setMsg] = useState<MessageState>({ type: '', text: '' });
  const [pendingAction, setPendingAction] = useState<'' | 'save' | 'test' | 'daily'>('');

  const summarizeNotifyResult = (json: NotifyResponse, fallbackPrefix: string) => {
    const results = json?.results;
    if (!results || typeof results !== 'object') {
      return `${fallbackPrefix}：请求已返回，但格式无法识别。`;
    }

    const details = Object.entries(results).map(([channel, result]) => {
      const label =
        channel === 'telegram'
          ? 'Telegram'
          : channel === 'feishu'
            ? '飞书'
            : channel === 'wecom'
              ? '企微'
              : channel;

      if (result.message) return `${label}：${result.message}`;
      if (result.ok === true || result.errcode === 0 || result.StatusCode === 0 || result.code === 0) {
        return `${label}：发送成功`;
      }
      return `${label}：返回了未知状态`;
    });

    return `${fallbackPrefix}：${details.join('；')}`;
  };

  const updateSettings = (updater: (prev: UserSettings) => UserSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveUserSettings(next);
      return next;
    });
  };

  const status = useMemo(
    () => ({
      aiReady: Boolean(settings.ai.apiKey),
      pushReady: Boolean(
        settings.notifications.feishuWebhook ||
          settings.notifications.wecomWebhook ||
          (settings.notifications.telegramBotToken && settings.notifications.telegramChatId)
      ),
    }),
    [settings]
  );

  const handleSave = async () => {
    setPendingAction('save');
    saveUserSettings(settings);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/notify/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: {
            feishu_webhook: settings.notifications.feishuWebhook,
            wecom_webhook: settings.notifications.wecomWebhook,
            telegram_bot_token: settings.notifications.telegramBotToken,
            telegram_chat_id: settings.notifications.telegramChatId,
            telegram_api_base: settings.notifications.telegramApiBase,
            telegram_proxy_url: settings.notifications.telegramProxyUrl,
          },
          schedule: {
            enabled: settings.preferences.enablePush,
            daily_time: settings.preferences.pushTime,
            timezone: 'Asia/Shanghai',
          },
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setMsg({ type: 'success', text: '配置已保存，并同步到了后端通知中心。' });
      } else {
        setMsg({ type: 'error', text: `本地已保存，但后端同步失败：${JSON.stringify(json)}` });
      }
    } catch {
      setMsg({ type: 'error', text: '本地已保存，但同步到后端失败，请检查服务状态。' });
    } finally {
      setPendingAction('');
    }
  };

  const handleTest = async () => {
    const hasAnyChannel = Boolean(
      settings.notifications.feishuWebhook ||
        settings.notifications.wecomWebhook ||
        (settings.notifications.telegramBotToken && settings.notifications.telegramChatId)
    );
    if (!hasAnyChannel) {
      setMsg({ type: 'error', text: '请至少填写一个通知通道。' });
      return;
    }

    try {
      setPendingAction('test');
      setMsg({ type: 'info', text: '正在测试所有已配置通知通道...' });
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/notify/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '盘感配置中心测试',
          content: '这是一条来自配置中心的测试消息，用于验证通知通道是否真正打通。',
          config: {
            feishu_webhook: settings.notifications.feishuWebhook,
            wecom_webhook: settings.notifications.wecomWebhook,
            telegram_bot_token: settings.notifications.telegramBotToken,
            telegram_chat_id: settings.notifications.telegramChatId,
            telegram_api_base: settings.notifications.telegramApiBase,
            telegram_proxy_url: settings.notifications.telegramProxyUrl,
          },
        }),
      });
      const json = await res.json();
      if (json.status === 'success' || json.status === 'partial') {
        setMsg({ type: json.status === 'success' ? 'success' : 'info', text: `测试完成：成功 ${json.sent}/${json.total} 个通道。` });
      } else {
        setMsg({ type: 'error', text: summarizeNotifyResult(json, '测试失败') });
      }
    } catch {
      setMsg({ type: 'error', text: '测试请求异常，请检查后端是否可用。' });
    } finally {
      setPendingAction('');
    }
  };

  const handleDailyTest = async () => {
    const hasAnyChannel = Boolean(
      settings.notifications.feishuWebhook ||
        settings.notifications.wecomWebhook ||
        (settings.notifications.telegramBotToken && settings.notifications.telegramChatId)
    );
    if (!hasAnyChannel) {
      setMsg({ type: 'error', text: '请先填写至少一个通知通道。' });
      return;
    }

    try {
      setPendingAction('daily');
      setMsg({ type: 'info', text: '正在生成并发送今日早报...' });
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/notify/daily_report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            feishu_webhook: settings.notifications.feishuWebhook,
            wecom_webhook: settings.notifications.wecomWebhook,
            telegram_bot_token: settings.notifications.telegramBotToken,
            telegram_chat_id: settings.notifications.telegramChatId,
            telegram_api_base: settings.notifications.telegramApiBase,
            telegram_proxy_url: settings.notifications.telegramProxyUrl,
          },
        }),
      });
      const json = await res.json();
      if (json.status === 'success' || json.status === 'partial') {
        setMsg({ type: json.status === 'success' ? 'success' : 'info', text: `早报已触发：成功 ${json.sent}/${json.total} 个通道。` });
      } else {
        setMsg({ type: 'error', text: summarizeNotifyResult(json, '早报发送失败') });
      }
    } catch {
      setMsg({ type: 'error', text: '触发失败，请检查后端接口状态。' });
    } finally {
      setPendingAction('');
    }
  };

  return (
    <AppShell
      title="配置中心"
      subtitle="这里直接管理三件事：AI、通知、偏好。"
      badge="控制台"
      maxWidthClassName="max-w-6xl"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link href="/chat" className="btn btn-secondary px-4 py-2 text-sm">
            AI 助手
          </Link>
          <Link href="/commander" className="btn btn-secondary px-4 py-2 text-sm">
            作战室
          </Link>
        </div>
      )}
    >
      <section className="surface-panel animate-stage p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="AI" value={status.aiReady ? '已配置' : '未配置'} hint={`${settings.ai.provider} / ${settings.ai.model}`} />
          <Metric label="通知" value={status.pushReady ? '可发送' : '未配置'} hint="飞书 / 企微 / Telegram" />
          <Metric label="定时" value={settings.preferences.enablePush ? settings.preferences.pushTime : '关闭'} hint="后端常驻时生效" />
          <Metric label="存储" value="本地 + 后端" hint="AI 保留本地，通知同步后端" />
        </div>

        {msg.text ? (
          <div
            className={`mt-4 rounded-[18px] px-4 py-3 text-sm ${
              msg.type === 'success'
                ? 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]'
                : msg.type === 'info'
                  ? 'bg-[var(--accent-cyan-dim)] text-[var(--accent-cyan)]'
                  : 'bg-[var(--accent-red-dim)] text-[var(--accent-red)]'
            }`}
          >
            {msg.text}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="AI 配置">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="模型提供商">
              <select
                className={inputClassName}
                value={settings.ai.provider}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    ai: { ...prev.ai, provider: e.target.value },
                  }))
                }
              >
                <option value="zhipu">智谱</option>
                <option value="openai">OpenAI 兼容</option>
                <option value="gemini">Gemini</option>
                <option value="custom">自定义兼容接口</option>
              </select>
            </Field>

            <Field label="模型名称" hint="推荐 `glm-4.7-flash`">
              <input
                type="text"
                className={inputClassName}
                value={settings.ai.model}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    ai: { ...prev.ai, model: e.target.value },
                  }))
                }
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="API Key">
              <input
                type="password"
                className={inputClassName}
                placeholder="sk-..."
                value={settings.ai.apiKey}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    ai: { ...prev.ai, apiKey: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel title="通知通道">
          <div className="grid gap-4">
            <Field label="飞书 Webhook">
              <input
                type="text"
                className={inputClassName}
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxx"
                value={settings.notifications.feishuWebhook}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, feishuWebhook: e.target.value },
                  }))
                }
              />
            </Field>

            <Field label="企微 Webhook">
              <input
                type="text"
                className={inputClassName}
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxx"
                value={settings.notifications.wecomWebhook}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, wecomWebhook: e.target.value },
                  }))
                }
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telegram Bot Token">
                <input
                  type="password"
                  className={inputClassName}
                  placeholder="123456789:AAExampleMockToken"
                  value={settings.notifications.telegramBotToken}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, telegramBotToken: e.target.value },
                    }))
                  }
                />
              </Field>

              <Field label="Telegram Chat ID" hint="必须填数字 ID">
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="例如 123456789"
                  value={settings.notifications.telegramChatId}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, telegramChatId: e.target.value },
                    }))
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telegram API Base">
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="https://api.telegram.org"
                  value={settings.notifications.telegramApiBase}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, telegramApiBase: e.target.value },
                    }))
                  }
                />
              </Field>

              <Field label="Telegram Proxy URL" hint="例如 socks5h://127.0.0.1:7892">
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="socks5h://127.0.0.1:7892"
                  value={settings.notifications.telegramProxyUrl}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, telegramProxyUrl: e.target.value },
                    }))
                  }
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="本地偏好">
          <div className="grid gap-3">
            <ToggleRow
              label="启用 A 股视图"
              checked={settings.preferences.enableAStock}
              onChange={(checked) =>
                updateSettings((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, enableAStock: checked },
                }))
              }
            />
            <ToggleRow
              label="启用 BTC 视图"
              checked={settings.preferences.enableBtc}
              onChange={(checked) =>
                updateSettings((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, enableBtc: checked },
                }))
              }
            />
            <ToggleRow
              label="启用每日定时推送"
              checked={settings.preferences.enablePush}
              onChange={(checked) =>
                updateSettings((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, enablePush: checked },
                }))
              }
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="推送时间">
              <input
                type="time"
                className={inputClassName}
                value={settings.preferences.pushTime}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, pushTime: e.target.value },
                  }))
                }
              />
            </Field>

            <Field label="风险偏好">
              <select
                className={inputClassName}
                value={settings.preferences.riskPreference}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, riskPreference: e.target.value as UserSettings['preferences']['riskPreference'] },
                  }))
                }
              >
                <option value="conservative">保守</option>
                <option value="balanced">平衡</option>
                <option value="aggressive">激进</option>
              </select>
            </Field>
          </div>
        </Panel>

        <Panel title="操作">
          <div className="grid gap-3">
            <button onClick={() => void handleSave()} className="btn btn-primary px-5 py-4 text-base">
              {pendingAction === 'save' ? '正在保存...' : '保存并同步配置'}
            </button>
            <button onClick={() => void handleTest()} className="btn btn-secondary px-5 py-4 text-base">
              {pendingAction === 'test' ? '正在测试...' : '测试所有已配置通道'}
            </button>
            <button onClick={() => void handleDailyTest()} className="btn btn-secondary px-5 py-4 text-base">
              {pendingAction === 'daily' ? '正在发送早报...' : '手动触发今日早报'}
            </button>
          </div>

          <div className="mt-4 data-tile">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Telegram 提示</div>
            <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
              Chat ID 必须是纯数字，不是 `@example_bot` 这种用户名。可以先给机器人发 `/start`，再用 `@userinfobot` 或 `@RawDataBot` 查数字 ID。
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
