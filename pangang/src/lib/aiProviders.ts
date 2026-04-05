import type { ChatProviderOption } from '@/types/api';

export const FALLBACK_AI_PROVIDERS: ChatProviderOption[] = [
  {
    id: 'zhipu',
    label: '智谱',
    description: '自动使用智谱开放平台通用接口，无需额外填写 Base URL。',
    default_model: 'glm-4.7-flash',
    api_key_label: '智谱 API Key',
    api_key_placeholder: '请输入智谱开放平台 API Key',
    requires_base_url: false,
    base_url_placeholder: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4.7-flash', label: 'GLM-4.7-Flash' },
      { id: 'glm-4.7', label: 'GLM-4.7' },
      { id: 'glm-4.6', label: 'GLM-4.6' },
      { id: 'glm-4.6v', label: 'GLM-4.6V' },
      { id: 'glm-4.6v-flash', label: 'GLM-4.6V-Flash' },
      { id: 'glm-4.5-air', label: 'GLM-4.5-Air' },
      { id: 'glm-4.5-airx', label: 'GLM-4.5-AirX' },
      { id: 'glm-4.5-flash', label: 'GLM-4.5-Flash' },
      { id: 'glm-4.5-x', label: 'GLM-4.5-X' },
      { id: 'glm-4.1v-thinking-flash', label: 'GLM-4.1V-Thinking-Flash' },
      { id: 'glm-4.1v-thinking-flashx', label: 'GLM-4.1V-Thinking-FlashX' },
    ],
  },
  {
    id: 'dashscope',
    label: '阿里云百炼',
    description: '自动使用百炼 OpenAI 兼容接口，无需额外填写 Base URL。',
    default_model: 'qwen-plus',
    api_key_label: '百炼 API Key',
    api_key_placeholder: '请输入阿里云百炼 API Key',
    requires_base_url: false,
    base_url_placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-max', label: 'Qwen Max' },
      { id: 'qwen-flash', label: 'Qwen Flash' },
      { id: 'qwen-turbo', label: 'Qwen Turbo' },
      { id: 'qwen3-max', label: 'Qwen3 Max' },
      { id: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus' },
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    description: '自动使用 MiniMax OpenAI 兼容接口，支持通用 Key 与 Coding Plan Key。',
    default_model: 'MiniMax-M2.5',
    api_key_label: 'MiniMax API Key',
    api_key_placeholder: '请输入 MiniMax API Key 或 Coding Plan Key',
    requires_base_url: false,
    base_url_placeholder: 'https://api.minimax.io/v1',
    models: [
      { id: 'MiniMax-M2.5', label: 'MiniMax M2.5' },
      { id: 'MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 Highspeed' },
      { id: 'MiniMax-M2.1', label: 'MiniMax M2.1' },
      { id: 'MiniMax-M2.1-highspeed', label: 'MiniMax M2.1 Highspeed' },
      { id: 'MiniMax-M2', label: 'MiniMax M2' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: '自动使用 OpenAI 官方接口。',
    default_model: 'gpt-4o-mini',
    api_key_label: 'OpenAI API Key',
    api_key_placeholder: '请输入 OpenAI API Key',
    requires_base_url: false,
    base_url_placeholder: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Claude',
    description: '自动使用 Anthropic Claude 官方接口。',
    default_model: 'claude-3-5-sonnet-latest',
    api_key_label: 'Anthropic API Key',
    api_key_placeholder: '请输入 Claude API Key',
    requires_base_url: false,
    base_url_placeholder: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: '自动使用 Google Gemini 官方接口。',
    default_model: 'gemini-2.5-flash',
    api_key_label: 'Gemini API Key',
    api_key_placeholder: '请输入 Gemini API Key',
    requires_base_url: false,
    base_url_placeholder: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: 'custom',
    label: '自定义兼容接口',
    description: '适用于 OpenAI 兼容网关或自建中转，需要填写 Base URL。',
    default_model: 'gpt-4o-mini',
    api_key_label: '兼容接口 API Key',
    api_key_placeholder: '请输入兼容接口 API Key',
    requires_base_url: true,
    base_url_placeholder: 'https://your-endpoint.example/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
      { id: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
      { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
      { id: 'qwen-plus', label: 'qwen-plus' },
    ],
  },
];

export function getProviderLabel(providerId: string) {
  return FALLBACK_AI_PROVIDERS.find((provider) => provider.id === providerId)?.label || providerId || '未设置';
}

export function getProviderById(providerId: string, providers: ChatProviderOption[] = FALLBACK_AI_PROVIDERS) {
  return providers.find((provider) => provider.id === providerId) || providers[0];
}
