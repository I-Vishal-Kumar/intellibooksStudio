/**
 * Zod Schemas for Audio Insight Platform
 * Used for runtime validation across services
 */

import { z } from 'zod';
import { SUPPORTED_AUDIO_FORMATS, INTENT_CATEGORIES, TRUST_LEVELS, AGENT_TYPES } from '../constants';

// ============================================
// Base Schemas
// ============================================

export const UUIDSchema = z.string().uuid();

export const DateTimeSchema = z.string().datetime();

export const SemVerSchema = z.string().regex(
  /^\d+\.\d+\.\d+$/,
  'Invalid semantic version format (expected: x.y.z)'
);

// ============================================
// Audio Schemas
// ============================================

export const AudioFormatSchema = z.enum(SUPPORTED_AUDIO_FORMATS as unknown as [string, ...string[]]);

export const ProcessingStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const AudioFileSchema = z.object({
  id: z.string(),
  filename: z.string().min(1),
  filePath: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  durationSeconds: z.number().positive().optional(),
  sampleRate: z.number().positive().optional(),
  channels: z.number().positive().optional(),
  format: AudioFormatSchema,
  status: ProcessingStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

export const WordTimestampSchema = z.object({
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});

export const TranscriptSchema = z.object({
  id: z.string(),
  audioFileId: z.string(),
  text: z.string(),
  language: z.string().length(2),
  confidence: z.number().min(0).max(1).optional(),
  wordTimestamps: z.array(WordTimestampSchema).optional(),
  modelUsed: z.string(),
  createdAt: DateTimeSchema,
});

// ============================================
// Analysis Schemas
// ============================================

export const SummaryTypeSchema = z.enum([
  'general',
  'key_points',
  'action_items',
  'quick',
]);

export const SummarySchema = z.object({
  id: z.string(),
  transcriptId: z.string(),
  summaryType: SummaryTypeSchema,
  summaryText: z.string(),
  keyPoints: z.array(z.string()),
  mainTopics: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  modelUsed: z.string(),
  createdAt: DateTimeSchema,
});

export const IntentCategorySchema = z.enum(INTENT_CATEGORIES as unknown as [string, ...string[]]);

export const SentimentSchema = z.enum([
  'positive',
  'negative',
  'neutral',
  'mixed',
]);

export const UrgencySchema = z.enum(['low', 'medium', 'high']);

export const IntentSchema = z.object({
  id: z.string(),
  transcriptId: z.string(),
  primaryIntent: IntentCategorySchema,
  confidence: z.number().min(0).max(1),
  secondaryIntents: z.array(IntentCategorySchema).optional(),
  reasoning: z.string(),
  sentiment: SentimentSchema,
  urgency: UrgencySchema,
  modelUsed: z.string(),
  createdAt: DateTimeSchema,
});

export const KeywordTypeSchema = z.enum(['keyword', 'keyphrase', 'entity']);

export const KeywordSchema = z.object({
  id: z.string(),
  transcriptId: z.string(),
  keyword: z.string(),
  keywordType: KeywordTypeSchema,
  relevanceScore: z.number().min(0).max(1),
  frequency: z.number().positive(),
  context: z.string().optional(),
  createdAt: DateTimeSchema,
});

// ============================================
// Processing Request Schemas
// ============================================

export const ProcessingTaskSchema = z.enum([
  'transcribe',
  'translate',
  'summarize',
  'detect_intent',
  'extract_keywords',
  'full_pipeline',
]);

export const FileUploadSchema = z.object({
  type: z.literal('file'),
  fileId: z.string(),
  filename: z.string(),
});

export const UrlSourceSchema = z.object({
  type: z.literal('url'),
  url: z.string().url(),
});

export const AudioSourceSchema = z.discriminatedUnion('type', [
  FileUploadSchema,
  UrlSourceSchema,
]);

export const ProcessingOptionsSchema = z.object({
  sourceLanguage: z.string().length(2).optional(),
  targetLanguages: z.array(z.string().length(2)).optional(),
  summaryType: SummaryTypeSchema.optional(),
  maxKeywords: z.number().positive().max(50).optional(),
  includeTimestamps: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
});

export const ProcessingRequestSchema = z.object({
  audioSource: AudioSourceSchema,
  tasks: z.array(ProcessingTaskSchema).min(1),
  options: ProcessingOptionsSchema.optional(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
});

// ============================================
// Agent Schemas
// ============================================

export const TrustLevelSchema = z.enum(TRUST_LEVELS as unknown as [string, ...string[]]);

export const AgentTypeSchema = z.enum(AGENT_TYPES as unknown as [string, ...string[]]);

export const SkillSchema = z.object({
  name: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  inputTypes: z.array(z.string()),
  outputTypes: z.array(z.string()),
  description: z.string().optional(),
});

export const CapabilitiesManifestSchema = z.object({
  skills: z.array(SkillSchema),
  supportedLanguages: z.array(z.string()).optional().default([]),
  maxInputSize: z.number().positive().optional(),
  supportedFormats: z.array(z.string()).optional().default([]),
});

export const AgentIdentityCardSchema = z.object({
  agentId: z.string(),
  agentType: AgentTypeSchema,
  domain: z.string().default('audio-processing'),
  version: SemVerSchema,
  capabilities: CapabilitiesManifestSchema,
  supportedActions: z.array(z.string()),
  trustLevel: TrustLevelSchema.default('basic'),
  digitalSignature: z.string().optional(),
  createdAt: DateTimeSchema,
  lastHeartbeat: DateTimeSchema.optional(),
  owner: z.string().optional(),
});

// ============================================
// API Schemas
// ============================================

export const PaginationRequestSchema = z.object({
  page: z.number().positive().default(1),
  pageSize: z.number().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    meta: z.object({
      requestId: z.string(),
      timestamp: DateTimeSchema,
      pagination: z.object({
        page: z.number(),
        pageSize: z.number(),
        totalItems: z.number(),
        totalPages: z.number(),
      }).optional(),
    }).optional(),
  });

// ============================================
// Event Schemas
// ============================================

export const BaseEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  timestamp: DateTimeSchema,
  source: z.string(),
  correlationId: z.string().optional(),
});

export const ProcessingStartedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('processing.started'),
  payload: z.object({
    jobId: z.string(),
    audioFileId: z.string(),
    tasks: z.array(ProcessingTaskSchema),
    userId: z.string().optional(),
  }),
});

export const ProcessingCompletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('processing.completed'),
  payload: z.object({
    jobId: z.string(),
    audioFileId: z.string(),
    durationMs: z.number(),
  }),
});

// ============================================
// Export types from schemas
// ============================================

export type AudioFileInput = z.input<typeof AudioFileSchema>;
export type AudioFile = z.output<typeof AudioFileSchema>;

export type ProcessingRequestInput = z.input<typeof ProcessingRequestSchema>;
export type ProcessingRequest = z.output<typeof ProcessingRequestSchema>;

export type AgentIdentityCardInput = z.input<typeof AgentIdentityCardSchema>;
export type AgentIdentityCard = z.output<typeof AgentIdentityCardSchema>;
