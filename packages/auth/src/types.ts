/**
 * Authentication and Authorization Types
 */

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  roles: Role[];
  permissions: Permission[];
  organizationId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault: boolean;
  organizationId?: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: PermissionAction;
  conditions?: PermissionCondition[];
}

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'manage'
  | '*';

export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'gte' | 'lte';
  value: unknown;
}

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionId?: string;
  organizationId?: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
  exp: number;
  iat: number;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  errorCode?: AuthErrorCode;
}

export type AuthErrorCode =
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'USER_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'ORGANIZATION_MISMATCH'
  | 'UNKNOWN_ERROR';

export interface AuthorizationRequest {
  userId: string;
  resource: string;
  action: PermissionAction;
  resourceId?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  matchedPermissions?: Permission[];
}

// Clerk-specific types
export interface ClerkUser {
  id: string;
  primaryEmailAddress?: {
    emailAddress: string;
  };
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ClerkSession {
  id: string;
  userId: string;
  status: string;
  lastActiveAt: number;
  expireAt: number;
}

export interface ClerkOrganization {
  id: string;
  name: string;
  slug: string;
  membersCount: number;
}
