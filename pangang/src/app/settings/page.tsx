'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ModuleShell from '@/components/ModuleShell';
import { chatApi } from '@/lib/api';
import { FALLBACK_AI_PROVIDERS, getProviderById } from '@/lib/aiProviders';
import { defaultSettings, loadUserSettings, saveUserSettings, type UserSettings } from '@/lib/localSettings';
import type { ChatProviderCatalogResponse, ChatProviderOption } from '@/types/api';
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

function normalizeAiSettings(settings: UserSettings, providers: ChatProviderOption[]) {
  const selectedProvider = getProviderById(settings.ai.provider, providers);

  return {
    ...settings,
    ai: {
      ...settings.ai,
      provider: selectedProvider.id,
      model: settings.ai.model?.trim() || selectedProvider.default_model,
    },
  };
}

const inputClassName =
  'input w-full';

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
    <label className="grid gap-2">
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
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-left transition-all hover:border-[var(--border-strong)]"
    >
      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
      <span className="toggle-shell">
        <span className={`toggle-switch ${checked ? 'active' : ''}`} />
      </span>
    </button>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="module-node">
      <div className="module-node__label">{label}</div>
      <div className="module-node__title">{value}</div>
    </div>
  );
}

function StepCard({
  step,
  title,
  detail,
  status,
}: {
  step: string;
  title: string;
  detail: string;
  status: 'done' | 'todo';
}) {
  return (
    <div className={`rounded-[22px] border px-4 py-4 ${status === 'done' ? 'border-[rgba(105,231,176,0.26)] bg-[rgba(105,231,176,0.07)]' : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.02)]'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{step}</div>
          <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        </div>
        <span className={`module-badge ${status === 'done' ? 'bg-[rgba(105,231,176,0.12)] text-[var(--accent-green)]' : ''}`}>
          {status === 'done' ? '已完成' : '待完成'}
        </span>
      </div>
      <div className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{detail}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [providerOptions, setProviderOptions] = useState<ChatProviderOption[]>(FALLBACK_AI_PROVIDERS);
  const [runtimeCatalog, setRuntimeCatalog] = useState<ChatProviderCatalogResponse | null>(null);
  const [savedSignature, setSavedSignature] = useState(JSON.stringify(defaultSettings));
  const [msg, setMsg] = useState<MessageState>({ type: '', text: '' });
  const [pendingAction, setPendingAction] = useState<'' | 'save' | 'test' | 'daily' | 'ai-test'>('');

  useEffect(() => {
    const loaded = loadUserSettings();
    const normalized = normalizeAiSettings(loaded, FALLBACK_AI_PROVIDERS);
    setSettings(normalized);
    setSavedSignature(JSON.stringify(normalized));

    void chatApi.getProviders()
      .then((catalog) => {
        setRuntimeCatalog(catalog);
        if (!catalog.providers?.length) return;
        setProviderOptions(catalog.providers);
        setSettings((prev) => normalizeAiSettings(prev, catalog.providers));
        setSavedSignature((prevSignature) => {
          const parsed = JSON.parse(prevSignature) as UserSettings;
          return JSON.stringify(normalizeAiSettings(parsed, catalog.providers));
        });
      })
      .catch(() => {
        // 保持本地兜底清单即可，避免设置页空白
      });
  }, []);

  const sharedAi = runtimeCatalog?.shared_ai;
  const notifyConfigWriteEnabled = runtimeCatalog?.features?.notify_config_write_enabled ?? true;
  const notifyTestEnabled = runtimeCatalog?.features?.notify_test_enabled ?? true;
  const sharedProvider = sharedAi?.provider ? getProviderById(sharedAi.provider, providerOptions) : null;
  const hasLocalAiConfig = Boolean(
    settings.ai.apiKey.trim() &&
      (getProviderById(settings.ai.provider, providerOptions).requires_base_url ? settings.ai.baseUrl.trim() : true)
  );

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
    setSettings((prev) => updater(prev));
  };

  const status = useMemo(() => {
    const channelCount = [
      settings.notifications.feishuWebhook,
      settings.notifications.wecomWebhook,
      settings.notifications.telegramBotToken && settings.notifications.telegramChatId ? 'telegram' : '',
    ].filter(Boolean).length;
    const providerForStatus = getProviderById(settings.ai.provider, providerOptions);

    return {
      aiReady: hasLocalAiConfig || Boolean(sharedAi?.enabled),
      pushReady: channelCount > 0,
      channelCount,
      scheduleText: settings.preferences.enablePush ? settings.preferences.pushTime : '关闭',
      saveState: JSON.stringify(settings) === savedSignature ? '已同步' : '未保存',
    };
  }, [hasLocalAiConfig, savedSignature, settings, providerOptions, sharedAi?.enabled]);

  const selectedProvider = getProviderById(settings.ai.provider, providerOptions);
  const matchesKnownModel = selectedProvider.models.some((model) => model.id === settings.ai.model);
  const stepSummary = [
    {
      step: 'Step 1',
      title: '连接 AI',
      detail: status.aiReady ? `${selectedProvider.label} · ${settings.ai.model}` : '选择提供商、模型并填写对应 API Key',
      status: status.aiReady ? 'done' : 'todo',
    },
    {
      step: 'Step 2',
      title: '配置通知',
      detail: status.pushReady ? `已配置 ${status.channelCount} 个通道` : '至少配置一个通知通道，后续早报和提醒才会发送',
      status: status.pushReady ? 'done' : 'todo',
    },
    {
      step: 'Step 3',
      title: '保存并测试',
      detail: status.saveState === '已同步' ? '当前配置已经同步到本地与后端' : '最后一步是保存配置，并测试 AI / 通知是否真的可用',
      status: status.saveState === '已同步' ? 'done' : 'todo',
    },
  ] as const;

  const handleSave = async () => {
    setPendingAction('save');
    saveUserSettings(settings);
    setSavedSignature(JSON.stringify(settings));

    if (!notifyConfigWriteEnabled) {
      setMsg({ type: 'success', text: '本地偏好已保存。当前共享部署已关闭远程通知配置写入。' });
      setPendingAction('');
      return;
    }

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
        setMsg({ type: 'success', text: '配置已保存并同步。' });
      } else {
        setMsg({ type: 'error', text: `本地已保存，但后端同步失败：${JSON.stringify(json)}` });
      }
    } catch {
      setMsg({ type: 'error', text: '本地已保存，但同步到后端失败，请检查服务状态。' });
    } finally {
      setPendingAction('');
    }
  };

  const handleAiTest = async () => {
    if (!hasLocalAiConfig && !sharedAi?.enabled) {
      setMsg({ type: 'error', text: '当前既没有本地 AI Key，也没有可用的平台共享 AI。' });
      return;
    }

    try {
      setPendingAction('ai-test');
      setMsg({ type: 'info', text: '正在验证 AI 配置...' });
      const testProvider = hasLocalAiConfig
        ? settings.ai.provider
        : sharedAi?.provider || settings.ai.provider;
      const testModel = hasLocalAiConfig
        ? settings.ai.model
        : sharedAi?.model || settings.ai.model;
      const providerConfig = getProviderById(testProvider, providerOptions);
      const result = await chatApi.testConfig({
        provider: testProvider,
        api_key: hasLocalAiConfig ? settings.ai.apiKey : undefined,
        model: testModel,
        base_url: hasLocalAiConfig && providerConfig.requires_base_url ? settings.ai.baseUrl || undefined : undefined,
      });
      setMsg({
        type: 'success',
        text: `AI 已连通：${getProviderById(result.provider, providerOptions)?.label || result.provider} · ${result.model}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 配置验证失败';
      setMsg({ type: 'error', text: `AI 配置验证失败：${message}` });
    } finally {
      setPendingAction('');
    }
  };

  const handleTest = async () => {
    if (!notifyTestEnabled) {
      setMsg({ type: 'info', text: '当前共享部署已关闭远程通知测试。通知由站点拥有者在服务端统一配置。' });
      return;
    }
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
      setMsg({ type: 'info', text: '正在测试所有已配置通道...' });
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
    if (!notifyTestEnabled) {
      setMsg({ type: 'info', text: '当前共享部署已关闭远程日报触发测试。请由站点拥有者通过服务端密钥或 GitHub Actions 触发。' });
      return;
    }
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
      title="设置"
      subtitle="按模块配置即可。"
      badge="Settings"
      maxWidthClassName="max-w-6xl"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link href="/chat" className="btn btn-secondary px-4 py-2 text-sm">
            去对话
          </Link>
          <Link href="/commander" className="btn btn-secondary px-4 py-2 text-sm">
            去作战
          </Link>
        </div>
      )}
    >
      <ModuleShell
        code="01"
        eyebrow="Setup Flow"
        title="按 3 步完成配置"
        badge={status.saveState}
        variant="settings"
        motion="pulse"
      >
        <div className="module-kpi-grid">
          <StatusCard label="AI" value={status.aiReady ? '已配置' : '未配置'} />
          <StatusCard label="通知" value={status.pushReady ? `${status.channelCount} 个通道` : '未配置'} />
          <StatusCard label="定时" value={status.scheduleText} />
          <StatusCard label="状态" value={status.saveState} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {stepSummary.map((step) => (
            <StepCard
              key={step.step}
              step={step.step}
              title={step.title}
              detail={step.detail}
              status={step.status}
            />
          ))}
        </div>

        {msg.text ? (
          <div
            className={`rounded-[18px] px-4 py-3 text-sm ${
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
      </ModuleShell>

      <div className="grid gap-6">
        <ModuleShell
          code="02"
          eyebrow="Step 1"
          title="先连接 AI"
          badge={status.aiReady ? '已配置' : '未配置'}
          variant="settings"
          motion="drift"
        >
          <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            只需要做三件事：选择提供商、选择模型、填写 API Key。只有自定义兼容接口时，才需要额外填写 Base URL。
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="模型提供商">
              <select
                className={inputClassName}
                value={settings.ai.provider}
                onChange={(e) =>
                  updateSettings((prev) => {
                    const nextProvider = getProviderById(e.target.value, providerOptions);
                    return {
                      ...prev,
                      ai: {
                        ...prev.ai,
                        provider: nextProvider.id,
                        model: nextProvider.default_model,
                        baseUrl: nextProvider.requires_base_url ? prev.ai.baseUrl : '',
                      },
                    };
                  })
                }
              >
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="模型名称">
              <div className="grid gap-3">
                <select
                  className={inputClassName}
                  value={matchesKnownModel ? settings.ai.model : '__custom__'}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      ai: {
                        ...prev.ai,
                        model: e.target.value === '__custom__' ? prev.ai.model : e.target.value,
                      },
                    }))
                  }
                >
                  {selectedProvider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                  <option value="__custom__">自定义模型名</option>
                </select>

                {!matchesKnownModel ? (
                  <input
                    type="text"
                    className={inputClassName}
                    placeholder="例如 glm-4.6v"
                    value={settings.ai.model}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        ai: { ...prev.ai, model: e.target.value },
                      }))
                    }
                  />
                ) : null}
              </div>
            </Field>
          </div>

          <Field
            label={selectedProvider.api_key_label}
            hint={selectedProvider.description}
          >
            <input
              type="password"
              className={inputClassName}
              placeholder={selectedProvider.api_key_placeholder}
              value={settings.ai.apiKey}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  ai: { ...prev.ai, apiKey: e.target.value },
                }))
              }
            />
          </Field>

          {selectedProvider.requires_base_url ? (
            <Field label="Base URL" hint="只在自定义兼容接口时需要填写。">
              <input
                type="text"
                className={inputClassName}
                placeholder={selectedProvider.base_url_placeholder || 'https://your-endpoint.example/v1'}
                value={settings.ai.baseUrl}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    ai: { ...prev.ai, baseUrl: e.target.value },
                  }))
                }
              />
            </Field>
          ) : null}

          {sharedAi?.enabled ? (
            <div className="rounded-[18px] border border-[rgba(105,231,176,0.22)] bg-[rgba(105,231,176,0.08)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
              当前站点已启用平台共享 AI：
              {' '}
              {sharedProvider?.label || sharedAi.provider_label || sharedAi.provider}
              {' '}
              ·
              {' '}
              {sharedAi.model || '默认模型'}
              。你和朋友们不填写个人 API Key 也能直接使用聊天和趋势分析；只有你想覆盖成自己的模型配置时，才需要填写个人 Key。
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
            <div className="text-sm text-[var(--text-secondary)]">
              当前选择：
              {' '}
              {hasLocalAiConfig
                ? `${selectedProvider.label} · ${settings.ai.model || selectedProvider.default_model}`
                : sharedAi?.enabled
                  ? `${sharedProvider?.label || sharedAi.provider_label || sharedAi.provider} · ${sharedAi.model || '默认模型'}`
                  : `${selectedProvider.label} · ${settings.ai.model || selectedProvider.default_model}`}
            </div>
            <button onClick={() => void handleAiTest()} className="btn btn-secondary px-4 py-2 text-sm">
              {pendingAction === 'ai-test' ? '验证中...' : sharedAi?.enabled && !hasLocalAiConfig ? '测试平台 AI' : '测试 AI 配置'}
            </button>
          </div>
        </ModuleShell>

        <ModuleShell
          code="03"
          eyebrow="Step 2"
          title="再配置通知"
          badge={status.pushReady ? `${status.channelCount} 个通道` : '未配置'}
          variant="settings"
          motion="scan"
        >
          <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            {notifyConfigWriteEnabled
              ? '飞书、企微、Telegram 三选一即可。Telegram 需要 `Bot Token + 数字 Chat ID`，不是机器人用户名。'
              : '当前共享部署已关闭远程通知配置写入。建议由站点拥有者在服务端环境变量里统一配置通知，朋友端只保留 AI 与浏览能力。'}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="飞书 Webhook">
                <input
                  type="text"
                  className={inputClassName}
                  disabled={!notifyConfigWriteEnabled}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx"
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
                  disabled={!notifyConfigWriteEnabled}
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx"
                  value={settings.notifications.wecomWebhook}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, wecomWebhook: e.target.value },
                    }))
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telegram Bot Token">
                <input
                  type="password"
                  className={inputClassName}
                  disabled={!notifyConfigWriteEnabled}
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

              <Field label="Telegram Chat ID" hint="填数字，不是机器人用户名。">
                <input
                  type="text"
                  className={inputClassName}
                  disabled={!notifyConfigWriteEnabled}
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
                  disabled={!notifyConfigWriteEnabled}
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

              <Field label="Telegram Proxy URL">
                <input
                  type="text"
                  className={inputClassName}
                  disabled={!notifyConfigWriteEnabled}
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

            <div className="module-node">
              <div className="module-node__label">Telegram 提示</div>
              <div className="module-node__copy">
                先给机器人发 `/start`，再找 `@userinfobot` 或 `@RawDataBot` 获取数字 Chat ID。
              </div>
            </div>
          </div>
        </ModuleShell>

        <ModuleShell
          code="04"
          eyebrow="Step 3"
          title="最后保存并测试"
          badge={pendingAction ? '处理中' : status.saveState}
          variant="settings"
          motion="track"
        >
          <div className="grid gap-6 xl:grid-cols-[1fr_0.86fr]">
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

              <div className="grid gap-4 md:grid-cols-2">
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
                    value={settings.preferences.riskProfile}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          riskProfile: e.target.value as UserSettings['preferences']['riskProfile'],
                        },
                      }))
                    }
                  >
                    <option value="conservative">保守</option>
                    <option value="balanced">平衡</option>
                    <option value="aggressive">激进</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="grid gap-3">
              <button onClick={() => void handleSave()} className="btn btn-primary px-5 py-4 text-base">
                {pendingAction === 'save' ? '正在保存...' : notifyConfigWriteEnabled ? '保存并同步配置' : '保存本地偏好'}
              </button>
              <button
                onClick={() => void handleTest()}
                className="btn btn-secondary px-5 py-4 text-base"
                disabled={!notifyTestEnabled}
              >
                {pendingAction === 'test' ? '正在测试...' : '测试所有通道'}
              </button>
              <button
                onClick={() => void handleDailyTest()}
                className="btn btn-secondary px-5 py-4 text-base"
                disabled={!notifyTestEnabled}
              >
                {pendingAction === 'daily' ? '正在发送...' : '手动触发今日早报'}
              </button>

              <div className="rounded-[18px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
                {notifyConfigWriteEnabled
                  ? '保存后会同时写入本地与后端通知配置。测试按钮会直接验证当前通道，早报按钮会立即生成一条完整日报。'
                  : '当前部署建议把通知能力视为“站点拥有者专用”。朋友端只需要共享 AI 选股、趋势判断和看盘结果即可。'}
              </div>
            </div>
          </div>
        </ModuleShell>
      </div>
    </AppShell>
  );
}
