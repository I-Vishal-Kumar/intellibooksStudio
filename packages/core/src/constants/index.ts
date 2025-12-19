/**
 * Constants for Audio Insight Platform
 */

// ============================================
// Supported Languages
// ============================================

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
  tr: 'Turkish',
  pl: 'Polish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  el: 'Greek',
  he: 'Hebrew',
  hu: 'Hungarian',
  ro: 'Romanian',
  uk: 'Ukrainian',
  nl: 'Dutch',
  bn: 'Bengali',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// ============================================
// Audio Formats
// ============================================

export const SUPPORTED_AUDIO_FORMATS = [
  'mp3',
  'wav',
  'flac',
  'm4a',
  'ogg',
  'aac',
  'wma',
  'webm',
] as const;

export const AUDIO_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/m4a',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
  webm: 'audio/webm',
};

// ============================================
// Processing Defaults
// ============================================

export const DEFAULT_MAX_AUDIO_SIZE_MB = 100;
export const DEFAULT_MAX_AUDIO_SIZE_BYTES = DEFAULT_MAX_AUDIO_SIZE_MB * 1024 * 1024;

export const DEFAULT_WHISPER_MODEL = 'base';
export const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large'] as const;
export type WhisperModel = (typeof WHISPER_MODELS)[number];

export const DEFAULT_SUMMARY_TYPE = 'general';
export const DEFAULT_MAX_KEYWORDS = 10;

// ============================================
// LLM Provider Configuration
// ============================================

export const LLM_PROVIDERS = ['openai', 'anthropic', 'openrouter'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export const DEFAULT_LLM_PROVIDER = 'openrouter';

export const LLM_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  openrouter: 'anthropic/claude-sonnet-4',
};

export const TASK_TEMPERATURES: Record<string, number> = {
  transcription: 0.0,
  translation: 0.3,
  summarization: 0.5,
  intent_detection: 0.0,
  keyword_extraction: 0.0,
  general: 0.7,
};

// ============================================
// Agent Configuration
// ============================================

export const AGENT_TYPES = [
  'transcription',
  'translation',
  'summarization',
  'intent',
  'keyword',
  'orchestrator',
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const TRUST_LEVELS = [
  'untrusted',
  'basic',
  'verified',
  'trusted',
  'privileged',
] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const TRUST_LEVEL_HIERARCHY: Record<TrustLevel, number> = {
  untrusted: 0,
  basic: 1,
  verified: 2,
  trusted: 3,
  privileged: 4,
};

// ============================================
// Intent Categories
// ============================================

export const INTENT_CATEGORIES = [
  'inquiry',
  'complaint',
  'feedback',
  'request',
  'information',
  'support',
  'sales',
  'other',
] as const;

// ============================================
// API Configuration
// ============================================

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================
// Event Types
// ============================================

export const EVENT_TYPES = {
  PROCESSING_STARTED: 'processing.started',
  PROCESSING_PROGRESS: 'processing.progress',
  PROCESSING_COMPLETED: 'processing.completed',
  PROCESSING_FAILED: 'processing.failed',
  AGENT_REGISTERED: 'agent.registered',
  AGENT_UNREGISTERED: 'agent.unregistered',
  AGENT_HEARTBEAT: 'agent.heartbeat',
} as const;

// ============================================
// MCP Configuration
// ============================================

export const MCP_SERVERS = {
  DATABASE: 'database-mcp',
  TEAMS: 'teams-mcp',
  SLACK: 'slack-mcp',
  GITHUB: 'github-mcp',
} as const;

export const MCP_DEFAULT_PORT = 8765;

// ============================================
// Redis Channels
// ============================================

export const REDIS_CHANNELS = {
  PROCESSING_EVENTS: 'events:processing',
  AGENT_EVENTS: 'events:agent',
  NOTIFICATIONS: 'events:notifications',
} as const;

// ============================================
// HTTP Status Codes
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Re-export ports configuration
export * from './ports';
