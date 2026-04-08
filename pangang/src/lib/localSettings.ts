import { FALLBACK_AI_PROVIDERS, getProviderById } from '@/lib/aiProviders';

export interface UserSettings {
  notifications: {
    feishuWebhook: string;
    wecomWebhook: string;
    telegramBotToken: string;
    telegramChatId: string;
    telegramApiBase: string;
    telegramProxyUrl: string;
  };
  ai: {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  preferences: {
    enableAStock: boolean;
    enableBtc: boolean;
    enablePush: boolean;
    pushTime: string;
    riskProfile: 'conservative' | 'balanced' | 'aggressive';
  };
}

const STORAGE_KEY = 'pangang_user_settings_v1';

function toPersistedSettings(settings: UserSettings): UserSettings {
  return {
    notifications: {
      ...defaultSettings.notifications,
      telegramApiBase: settings.notifications.telegramApiBase,
    },
    ai: {
      provider: settings.ai.provider,
      apiKey: '',
      model: settings.ai.model,
      baseUrl: settings.ai.baseUrl,
    },
    preferences: {
      ...settings.preferences,
    },
  };
}

export function getPersistedSettingsSignature(settings: UserSettings): string {
  return JSON.stringify(toPersistedSettings(settings));
}

export const defaultSettings: UserSettings = {
  notifications: {
    feishuWebhook: '',
    wecomWebhook: '',
    telegramBotToken: '',
    telegramChatId: '',
    telegramApiBase: 'https://api.telegram.org',
    telegramProxyUrl: ''
  },
  ai: {
    provider: 'zhipu',
    apiKey: '',
    model: 'glm-4.7-flash',
    baseUrl: ''
  },
  preferences: {
    enableAStock: true,
    enableBtc: true,
    enablePush: false,
    pushTime: '08:00',
    riskProfile: 'balanced'
  }
};

export function loadUserSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    const merged = {
      notifications: {
        ...defaultSettings.notifications,
        telegramApiBase: parsed.notifications?.telegramApiBase || defaultSettings.notifications.telegramApiBase,
      },
      ai: {
        ...defaultSettings.ai,
        provider: parsed.ai?.provider || defaultSettings.ai.provider,
        model: parsed.ai?.model || defaultSettings.ai.model,
        baseUrl: parsed.ai?.baseUrl || defaultSettings.ai.baseUrl,
      },
      preferences: {
        ...defaultSettings.preferences,
        ...parsed.preferences
      }
    };

    const selectedProvider = getProviderById(merged.ai.provider, FALLBACK_AI_PROVIDERS);
    return {
      ...merged,
      ai: {
        ...merged.ai,
        provider: selectedProvider.id,
        model: merged.ai.model?.trim() || selectedProvider.default_model,
      },
    };
  } catch {
    return defaultSettings;
  }
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedSettings(settings)));
}
