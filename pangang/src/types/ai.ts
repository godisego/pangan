// ============================================
// AI Provider Configuration Types
// ============================================

/**
 * 支持的AI提供商列表
 */
export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'moonshot'
  | 'siliconflow'
  | 'custom';

/**
 * AI提供商配置接口
 */
export interface AIProviderConfig {
  /** 提供商ID */
  id: AIProvider;
  /** 显示名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** API密钥 */
  apiKey: string;
  /** API基础URL（可选，用于自定义代理） */
  baseUrl?: string;
  /** 默认模型 */
  defaultModel: string;
  /** 可用模型列表 */
  availableModels: AIModel[];
  /** 组织ID（OpenAI等需要） */
  organizationId?: string;
  /** 额外请求头 */
  customHeaders?: Record<string, string>;
}

/**
 * AI模型信息
 */
export interface AIModel {
  /** 模型ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 上下文窗口大小 */
  contextWindow: number;
  /** 是否支持函数调用 */
  supportsFunctions: boolean;
  /** 是否支持视觉 */
  supportsVision: boolean;
  /** 最大输出token数 */
  maxOutputTokens?: number;
  /** 是否为主流模型 */
  isPopular?: boolean;
}

/**
 * AI请求配置
 */
export interface AIRequestConfig {
  /** 使用的模型 */
  model: string;
  /** 温度参数 (0-2) */
  temperature?: number;
  /** 最大token数 */
  maxTokens?: number;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 流式输出 */
  stream?: boolean;
  /** 工具/函数 */
  tools?: AITool[];
}

/**
 * AI工具/函数定义
 */
export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * AI消息
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
}

/**
 * AI工具调用
 */
export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * AI响应
 */
export interface AIResponse {
  /** 响应内容 */
  content: string;
  /** 使用的模型 */
  model: string;
  /** 完成token数 */
  tokensUsed?: number;
  /** 工具调用 */
  toolCalls?: AIToolCall[];
  /** 是否出错 */
  error?: string;
  /** 响应时间ms */
  responseTime?: number;
}

/**
 * AI流式响应
 */
export interface AIStreamResponse {
  content: string;
  isComplete: boolean;
  error?: string;
}

/**
 * 全局AI配置
 */
export interface AIGlobalConfig {
  /** 默认使用的提供商 */
  defaultProvider: AIProvider;
  /** 所有提供商配置 */
  providers: Record<AIProvider, AIProviderConfig>;
  /** 是否启用AI分析 */
  enabled: boolean;
  /** 分析场景配置 */
  useCases: AIUseCaseConfig;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * AI使用场景配置
 */
export interface AIUseCaseConfig {
  /** 宏观经济分析 */
  macroAnalysis: AIUseCase;
  /** BTC市场分析 */
  btcAnalysis: AIUseCase;
  /** 股票市场分析 */
  stockAnalysis: AIUseCase;
  /** 个股分析 */
  stockDetail: AIUseCase;
}

/**
 * 单一场景配置
 */
export interface AIUseCase {
  /** 使用的提供商 */
  provider: AIProvider;
  /** 使用的模型 */
  model: string;
  /** 温度参数 */
  temperature: number;
  /** 是否启用 */
  enabled: boolean;
  /** 自定义提示词前缀 */
  customPrompt?: string;
}

/**
 * 验证配置是否完整
 */
export function validateProviderConfig(config: AIProviderConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiKey && config.id !== 'custom') {
    errors.push('缺少API密钥');
  }

  if (config.id === 'custom' && !config.baseUrl) {
    errors.push('自定义提供商需要设置基础URL');
  }

  if (!config.defaultModel) {
    errors.push('未选择默认模型');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查配置是否可用
 */
export function isProviderReady(config: AIProviderConfig): boolean {
  return config.enabled &&
         !!config.apiKey &&
         !!config.defaultModel;
}

/**
 * 获取可用的第一个提供商
 */
export function getFirstAvailableProvider(
  config: AIGlobalConfig
): AIProvider | null {
  for (const [provider, providerConfig] of Object.entries(config.providers)) {
    if (isProviderReady(providerConfig as AIProviderConfig)) {
      return provider as AIProvider;
    }
  }
  return null;
}
