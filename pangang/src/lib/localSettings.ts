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
    model: 'glm-4.7-flash'
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
    return {
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
