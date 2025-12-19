/**
 * Custom Error Types for Audio Insight Platform
 */

export class AudioInsightError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AudioInsightError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

// ============================================
// Validation Errors (400)
// ============================================

export class ValidationError extends AudioInsightError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class InvalidAudioFormatError extends AudioInsightError {
  constructor(format: string, supportedFormats: string[]) {
    super(
      `Invalid audio format: ${format}. Supported formats: ${supportedFormats.join(', ')}`,
      'INVALID_AUDIO_FORMAT',
      400,
      { format, supportedFormats }
    );
    this.name = 'InvalidAudioFormatError';
  }
}

export class FileTooLargeError extends AudioInsightError {
  constructor(sizeBytes: number, maxSizeBytes: number) {
    super(
      `File size ${Math.round(sizeBytes / 1024 / 1024)}MB exceeds maximum ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
      'FILE_TOO_LARGE',
      400,
      { sizeBytes, maxSizeBytes }
    );
    this.name = 'FileTooLargeError';
  }
}

// ============================================
// Authentication Errors (401)
// ============================================

export class AuthenticationError extends AudioInsightError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class InvalidTokenError extends AudioInsightError {
  constructor(reason?: string) {
    super(
      reason ? `Invalid token: ${reason}` : 'Invalid or expired token',
      'INVALID_TOKEN',
      401,
      { reason }
    );
    this.name = 'InvalidTokenError';
  }
}

// ============================================
// Authorization Errors (403)
// ============================================

export class AuthorizationError extends AudioInsightError {
  constructor(
    message: string = 'Access denied',
    requiredPermission?: string
  ) {
    super(message, 'AUTHORIZATION_ERROR', 403, { requiredPermission });
    this.name = 'AuthorizationError';
  }
}

export class InsufficientPermissionsError extends AudioInsightError {
  constructor(requiredPermissions: string[], userPermissions: string[]) {
    const missing = requiredPermissions.filter(p => !userPermissions.includes(p));
    super(
      `Insufficient permissions. Missing: ${missing.join(', ')}`,
      'INSUFFICIENT_PERMISSIONS',
      403,
      { requiredPermissions, userPermissions, missing }
    );
    this.name = 'InsufficientPermissionsError';
  }
}

export class QuotaExceededError extends AudioInsightError {
  constructor(quotaType: string, limit: number, current: number) {
    super(
      `${quotaType} quota exceeded. Limit: ${limit}, Current: ${current}`,
      'QUOTA_EXCEEDED',
      403,
      { quotaType, limit, current }
    );
    this.name = 'QuotaExceededError';
  }
}

// ============================================
// Not Found Errors (404)
// ============================================

export class NotFoundError extends AudioInsightError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} not found: ${identifier}`,
      'NOT_FOUND',
      404,
      { resource, identifier }
    );
    this.name = 'NotFoundError';
  }
}

export class AudioFileNotFoundError extends NotFoundError {
  constructor(fileId: string) {
    super('Audio file', fileId);
    this.name = 'AudioFileNotFoundError';
  }
}

export class TranscriptNotFoundError extends NotFoundError {
  constructor(transcriptId: string) {
    super('Transcript', transcriptId);
    this.name = 'TranscriptNotFoundError';
  }
}

export class AgentNotFoundError extends NotFoundError {
  constructor(agentId: string) {
    super('Agent', agentId);
    this.name = 'AgentNotFoundError';
  }
}

// ============================================
// Conflict Errors (409)
// ============================================

export class ConflictError extends AudioInsightError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, context);
    this.name = 'ConflictError';
  }
}

export class DuplicateResourceError extends AudioInsightError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} already exists: ${identifier}`,
      'DUPLICATE_RESOURCE',
      409,
      { resource, identifier }
    );
    this.name = 'DuplicateResourceError';
  }
}

// ============================================
// Processing Errors (422)
// ============================================

export class ProcessingError extends AudioInsightError {
  constructor(
    message: string,
    task: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'PROCESSING_ERROR', 422, { task, ...context });
    this.name = 'ProcessingError';
  }
}

export class TranscriptionError extends ProcessingError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'transcription', context);
    this.name = 'TranscriptionError';
  }
}

export class TranslationError extends ProcessingError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'translation', context);
    this.name = 'TranslationError';
  }
}

export class LLMError extends AudioInsightError {
  constructor(
    message: string,
    provider: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'LLM_ERROR', 422, { provider, ...context });
    this.name = 'LLMError';
  }
}

// ============================================
// Rate Limiting Errors (429)
// ============================================

export class RateLimitError extends AudioInsightError {
  constructor(
    retryAfterSeconds: number,
    limit?: number,
    windowSeconds?: number
  ) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfterSeconds, limit, windowSeconds }
    );
    this.name = 'RateLimitError';
  }
}

// ============================================
// Internal Errors (500)
// ============================================

export class InternalError extends AudioInsightError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', 500, context, false);
    this.name = 'InternalError';
  }
}

export class DatabaseError extends AudioInsightError {
  constructor(message: string, operation: string) {
    super(message, 'DATABASE_ERROR', 500, { operation }, false);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AudioInsightError {
  constructor(service: string, message: string) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { service }
    );
    this.name = 'ExternalServiceError';
  }
}

// ============================================
// MCP Errors
// ============================================

export class MCPError extends AudioInsightError {
  constructor(message: string, serverName: string, toolName?: string) {
    super(message, 'MCP_ERROR', 500, { serverName, toolName });
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(serverName: string) {
    super(`Failed to connect to MCP server: ${serverName}`, serverName);
    this.name = 'MCPConnectionError';
  }
}

export class MCPToolNotFoundError extends MCPError {
  constructor(serverName: string, toolName: string) {
    super(`Tool not found: ${toolName}`, serverName, toolName);
    this.name = 'MCPToolNotFoundError';
  }
}

// ============================================
// Agent Errors
// ============================================

export class AgentError extends AudioInsightError {
  constructor(
    message: string,
    agentId: string,
    agentType: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'AGENT_ERROR', 500, { agentId, agentType, ...context });
    this.name = 'AgentError';
  }
}

export class AgentNotAvailableError extends AgentError {
  constructor(agentType: string) {
    super(`No available agent of type: ${agentType}`, 'unknown', agentType);
    this.name = 'AgentNotAvailableError';
  }
}

export class AgentTrustError extends AgentError {
  constructor(
    agentId: string,
    agentType: string,
    requiredTrustLevel: string,
    actualTrustLevel: string
  ) {
    super(
      `Agent trust level insufficient. Required: ${requiredTrustLevel}, Actual: ${actualTrustLevel}`,
      agentId,
      agentType,
      { requiredTrustLevel, actualTrustLevel }
    );
    this.name = 'AgentTrustError';
  }
}

// ============================================
// Error Type Guards
// ============================================

export function isAudioInsightError(error: unknown): error is AudioInsightError {
  return error instanceof AudioInsightError;
}

export function isOperationalError(error: unknown): boolean {
  return isAudioInsightError(error) && error.isOperational;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}
