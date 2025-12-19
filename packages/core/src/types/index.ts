/**
 * Core Types for Audio Insight Platform
 * Shared across all services and packages
 */

// ============================================
// Audio & Transcription Types
// ============================================

export interface AudioFile {
  id: string;
  filename: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  format: AudioFormat;
  status: ProcessingStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type AudioFormat =
  | 'mp3'
  | 'wav'
  | 'flac'
  | 'm4a'
  | 'ogg'
  | 'aac'
  | 'wma'
  | 'webm';

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface Transcript {
  id: string;
  audioFileId: string;
  text: string;
  language: string;
  confidence?: number;
  wordTimestamps?: WordTimestamp[];
  modelUsed: string;
  createdAt: string;
}

// ============================================
// Analysis Types
// ============================================

export interface Translation {
  id: string;
  transcriptId: string;
  targetLanguage: string;
  translatedText: string;
  modelUsed: string;
  createdAt: string;
}

export type SummaryType =
  | 'general'
  | 'key_points'
  | 'action_items'
  | 'quick';

export interface Summary {
  id: string;
  transcriptId: string;
  summaryType: SummaryType;
  summaryText: string;
  keyPoints: string[];
  mainTopics?: string[];
  actionItems?: string[];
  modelUsed: string;
  createdAt: string;
}

export type IntentCategory =
  | 'inquiry'
  | 'complaint'
  | 'feedback'
  | 'request'
  | 'information'
  | 'support'
  | 'sales'
  | 'other';

export type Sentiment =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'mixed';

export type Urgency =
  | 'low'
  | 'medium'
  | 'high';

export interface Intent {
  id: string;
  transcriptId: string;
  primaryIntent: IntentCategory;
  confidence: number;
  secondaryIntents?: IntentCategory[];
  reasoning: string;
  sentiment: Sentiment;
  urgency: Urgency;
  modelUsed: string;
  createdAt: string;
}

export type KeywordType =
  | 'keyword'
  | 'keyphrase'
  | 'entity';

export interface Keyword {
  id: string;
  transcriptId: string;
  keyword: string;
  keywordType: KeywordType;
  relevanceScore: number;
  frequency: number;
  context?: string;
  createdAt: string;
}

// ============================================
// Processing Types
// ============================================

export type ProcessingTask =
  | 'transcribe'
  | 'translate'
  | 'summarize'
  | 'detect_intent'
  | 'extract_keywords'
  | 'full_pipeline';

export interface ProcessingRequest {
  audioSource: FileUpload | UrlSource;
  tasks: ProcessingTask[];
  options?: ProcessingOptions;
  userId?: string;
  organizationId?: string;
}

export interface FileUpload {
  type: 'file';
  fileId: string;
  filename: string;
}

export interface UrlSource {
  type: 'url';
  url: string;
}

export interface ProcessingOptions {
  sourceLanguage?: string;
  targetLanguages?: string[];
  summaryType?: SummaryType;
  maxKeywords?: number;
  includeTimestamps?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

export interface ProcessingResult {
  jobId: string;
  status: ProcessingStatus;
  progress?: number;
  transcription?: Transcript;
  summary?: Summary;
  intent?: Intent;
  keywords?: Keyword[];
  translations?: Translation[];
  errors?: ProcessingError[];
  metadata: ProcessingMetadata;
}

export interface ProcessingError {
  task: ProcessingTask;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProcessingMetadata {
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  modelsUsed: Record<string, string>;
}

// ============================================
// User & Organization Types
// ============================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  organizationId?: string;
  role: UserRole;
  permissions: string[];
  createdAt: string;
}

export type UserRole =
  | 'admin'
  | 'member'
  | 'viewer'
  | 'guest';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  settings: OrganizationSettings;
  createdAt: string;
}

export type OrganizationPlan =
  | 'free'
  | 'pro'
  | 'enterprise';

export interface OrganizationSettings {
  defaultLanguage: string;
  defaultSummaryType: SummaryType;
  enabledIntegrations: string[];
  maxAudioSizeMb: number;
  maxMonthlyMinutes: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Event Types (for Redis Pub/Sub)
// ============================================

export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  correlationId?: string;
}

export interface ProcessingStartedEvent extends BaseEvent {
  eventType: 'processing.started';
  payload: {
    jobId: string;
    audioFileId: string;
    tasks: ProcessingTask[];
    userId?: string;
  };
}

export interface ProcessingCompletedEvent extends BaseEvent {
  eventType: 'processing.completed';
  payload: {
    jobId: string;
    audioFileId: string;
    results: ProcessingResult;
  };
}

export interface ProcessingFailedEvent extends BaseEvent {
  eventType: 'processing.failed';
  payload: {
    jobId: string;
    audioFileId: string;
    errors: ProcessingError[];
  };
}

export interface AgentRegisteredEvent extends BaseEvent {
  eventType: 'agent.registered';
  payload: {
    agentId: string;
    agentType: string;
    capabilities: string[];
  };
}

export type DomainEvent =
  | ProcessingStartedEvent
  | ProcessingCompletedEvent
  | ProcessingFailedEvent
  | AgentRegisteredEvent;
