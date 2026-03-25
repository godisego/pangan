'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_CONFIG } from '@/utils/constants';
import { loadUserSettings, saveUserSettings, type UserSettings } from '@/lib/localSettings';

export default function SettingsPage() {
    const router = useRouter();
    const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
    const [msg, setMsg] = useState({ type: '', text: '' });

    const updateSettings = (updater: (prev: UserSettings) => UserSettings) => {
        setSettings((prev) => {
            const next = updater(prev);
            saveUserSettings(next);
            return next;
        });
    };

    const handleSave = async () => {
        saveUserSettings(settings);
        setMsg({ type: 'success', text: '设置已保存在当前浏览器' });
    };

    const handleTest = async () => {
        if (!settings.notifications.feishuWebhook) {
            setMsg({ type: 'error', text: '请先填写飞书 Webhook' });
            return;
        }
        try {
            setMsg({ type: 'info', text: '发送中...' });
            const res = await fetch(`${API_CONFIG.BASE_URL}/api/notify/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '🔔 测试推送',
                    content: '🎉 恭喜！当前浏览器中的推送配置可用。\n\n后续开盘作战与日报推送都可以基于这个 webhook 触发。',
                    webhook_url: settings.notifications.feishuWebhook
                })
            });
            const json = await res.json();
            if (json.code === 0 || json.StatusCode === 0 || json.status_code === 0) {
                setMsg({ type: 'success', text: '测试发送成功！请检查飞书' });
            } else {
                setMsg({ type: 'error', text: `发送失败: ${JSON.stringify(json)}` });
            }
        } catch {
            setMsg({ type: 'error', text: '请求异常' });
        }
    };

    const handleDailyTest = async () => {
        if (!settings.notifications.feishuWebhook) {
            setMsg({ type: 'error', text: '请先填写飞书 Webhook' });
            return;
        }
        try {
            setMsg({ type: 'info', text: '触发日报中...' });
            await fetch(`${API_CONFIG.BASE_URL}/api/notify/daily_report?webhook_url=${encodeURIComponent(settings.notifications.feishuWebhook)}`, {
                method: 'POST'
            });
            setMsg({ type: 'success', text: '日报已触发，请检查飞书' });
        } catch {
            setMsg({ type: 'error', text: '触发失败' });
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
            <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => router.back()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        ← 返回
                    </button>
                    <span className="text-lg font-semibold">系统设置</span>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
                <section className="card space-y-4">
                    <h2 className="text-lg font-medium">🔔 消息推送配置</h2>

                    <div className={`p-4 rounded-lg flex items-center justify-between ${settings.notifications.feishuWebhook ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                        <div className="flex items-center gap-2">
                            <span>{settings.notifications.feishuWebhook ? '✅' : '⚠️'}</span>
                            <div>
                                <div className="font-medium">{settings.notifications.feishuWebhook ? '已配置本地 Webhook' : '未配置'}</div>
                                <div className="text-xs text-[var(--text-secondary)]">当前设置仅保存在本地浏览器，不会自动同步到其他设备。</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--text-secondary)]">飞书 Webhook URL</label>
                        <input
                            type="text"
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-2 text-sm focus:outline-none focus:border-[var(--accent-green)]"
                            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                            value={settings.notifications.feishuWebhook}
                            onChange={(e) => updateSettings((prev) => ({
                                ...prev,
                                notifications: {
                                    ...prev.notifications,
                                    feishuWebhook: e.target.value
                                }
                            }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--text-secondary)]">企微 Webhook</label>
                        <input
                            type="text"
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-2 text-sm focus:outline-none focus:border-[var(--accent-green)]"
                            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                            value={settings.notifications.wecomWebhook}
                            onChange={(e) => updateSettings((prev) => ({
                                ...prev,
                                notifications: {
                                    ...prev.notifications,
                                    wecomWebhook: e.target.value
                                }
                            }))}
                        />
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">🤖 AI 设置</h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                                type="text"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-2 text-sm focus:outline-none focus:border-[var(--accent-green)]"
                                placeholder="模型提供商"
                                value={settings.ai.provider}
                                onChange={(e) => updateSettings((prev) => ({
                                    ...prev,
                                    ai: { ...prev.ai, provider: e.target.value }
                                }))}
                            />
                            <input
                                type="text"
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-2 text-sm focus:outline-none focus:border-[var(--accent-green)]"
                                placeholder="模型名"
                                value={settings.ai.model}
                                onChange={(e) => updateSettings((prev) => ({
                                    ...prev,
                                    ai: { ...prev.ai, model: e.target.value }
                                }))}
                            />
                        </div>
                        <input
                            type="password"
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-2 text-sm focus:outline-none focus:border-[var(--accent-green)]"
                            placeholder="用户自己的 AI API Key（仅保存在本地浏览器）"
                            value={settings.ai.apiKey}
                            onChange={(e) => updateSettings((prev) => ({
                                ...prev,
                                ai: { ...prev.ai, apiKey: e.target.value }
                            }))}
                        />
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">🎛️ 偏好设置</h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="flex items-center justify-between rounded border border-[var(--border-color)] p-3 text-sm">
                                <span>启用 A股</span>
                                <input
                                    type="checkbox"
                                    checked={settings.preferences.enableAStock}
                                    onChange={(e) => updateSettings((prev) => ({
                                        ...prev,
                                        preferences: { ...prev.preferences, enableAStock: e.target.checked }
                                    }))}
                                />
                            </label>
                            <label className="flex items-center justify-between rounded border border-[var(--border-color)] p-3 text-sm">
                                <span>启用 BTC</span>
                                <input
                                    type="checkbox"
                                    checked={settings.preferences.enableBtc}
                                    onChange={(e) => updateSettings((prev) => ({
                                        ...prev,
                                        preferences: { ...prev.preferences, enableBtc: e.target.checked }
                                    }))}
                                />
                            </label>
                            <label className="flex items-center justify-between rounded border border-[var(--border-color)] p-3 text-sm">
                                <span>启用推送</span>
                                <input
                                    type="checkbox"
                                    checked={settings.preferences.enablePush}
                                    onChange={(e) => updateSettings((prev) => ({
                                        ...prev,
                                        preferences: { ...prev.preferences, enablePush: e.target.checked }
                                    }))}
                                />
                            </label>
                            <select
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-3 text-sm focus:outline-none focus:border-[var(--accent-green)]"
                                value={settings.preferences.riskProfile}
                                onChange={(e) => updateSettings((prev) => ({
                                    ...prev,
                                    preferences: {
                                        ...prev.preferences,
                                        riskProfile: e.target.value as UserSettings['preferences']['riskProfile']
                                    }
                                }))}
                            >
                                <option value="conservative">保守</option>
                                <option value="balanced">平衡</option>
                                <option value="aggressive">激进</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full btn btn-primary py-2"
                    >
                        保存本地设置
                    </button>

                    {msg.text && (
                        <div className={`p-2 rounded text-sm text-center ${msg.type === 'success' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {msg.text}
                        </div>
                    )}
                </section>

                <section className="card space-y-4">
                    <h2 className="text-lg font-medium">🧪 调试工具</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleTest} className="btn btn-secondary py-2">
                            测试飞书推送
                        </button>
                        <button onClick={handleDailyTest} className="btn btn-secondary py-2">
                            触发今日早报
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
