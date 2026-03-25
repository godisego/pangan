export interface UserSettings {
  notifications: {
    feishuWebhook: string;
    wecomWebhook: string;
    telegramBotToken: string;
    telegramChatId: string;
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
    riskProfile: 'conservative' | 'balanced' | 'aggressive';
  };
}

const STORAGE_KEY = 'pangang_user_settings_v1';

export const defaultSettings: UserSettings = {
  notifications: {
    feishuWebhook: '',
    wecomWebhook: '',
    telegramBotToken: '',
    telegramChatId: ''
  },
  ai: {
    provider: 'zhipu',
    apiKey: '',
    model: 'glm-4-flash'
  },
  preferences: {
    enableAStock: true,
    enableBtc: true,
    enablePush: false,
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
