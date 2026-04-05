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
        ...parsed.notifications
      },
      ai: {
        ...defaultSettings.ai,
        ...parsed.ai
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

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
