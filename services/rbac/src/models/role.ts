/**
 * Role and Permission Models
 */

import { z } from 'zod';

// Permission action types
export const PermissionActionSchema = z.enum([
  'create',
  'read',
  'update',
  'delete',
  'execute',
  'manage',
  '*',
]);

export type PermissionAction = z.infer<typeof PermissionActionSchema>;

// Permission schema
export const PermissionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  resource: z.string().min(1),
  action: PermissionActionSchema,
  description: z.string().optional(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['eq', 'ne', 'in', 'nin', 'gt', 'lt', 'gte', 'lte']),
        value: z.unknown(),
      })
    )
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Permission = z.infer<typeof PermissionSchema>;

// Role schema
export const RoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(PermissionSchema),
  isDefault: z.boolean().default(false),
  isSystem: z.boolean().default(false),
  organizationId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Role = z.infer<typeof RoleSchema>;

// Create/Update DTOs
export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()),
  isDefault: z.boolean().optional(),
  organizationId: z.string().uuid().optional(),
});

export type CreateRole = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = CreateRoleSchema.partial();

export type UpdateRole = z.infer<typeof UpdateRoleSchema>;

export const CreatePermissionSchema = z.object({
  name: z.string().min(1).max(100),
  resource: z.string().min(1).max(100),
  action: PermissionActionSchema,
  description: z.string().max(500).optional(),
});

export type CreatePermission = z.infer<typeof CreatePermissionSchema>;

// Default roles
export const DEFAULT_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'admin',
    description: 'Full system access',
    permissions: [],
    isDefault: false,
    isSystem: true,
  },
  {
    name: 'user',
    description: 'Standard user access',
    permissions: [],
    isDefault: true,
    isSystem: true,
  },
  {
    name: 'viewer',
    description: 'Read-only access',
    permissions: [],
    isDefault: false,
    isSystem: true,
  },
];

// Default permissions
export const DEFAULT_PERMISSIONS: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Audio permissions
  { name: 'audio:create', resource: 'audio', action: 'create', description: 'Upload audio files' },
  { name: 'audio:read', resource: 'audio', action: 'read', description: 'View audio files' },
  { name: 'audio:delete', resource: 'audio', action: 'delete', description: 'Delete audio files' },

  // Transcript permissions
  {
    name: 'transcript:read',
    resource: 'transcript',
    action: 'read',
    description: 'View transcripts',
  },
  {
    name: 'transcript:update',
    resource: 'transcript',
    action: 'update',
    description: 'Edit transcripts',
  },

  // Agent permissions
  {
    name: 'agent:execute',
    resource: 'agent',
    action: 'execute',
    description: 'Run processing agents',
  },
  { name: 'agent:read', resource: 'agent', action: 'read', description: 'View agent registry' },

  // RAG permissions
  { name: 'rag:query', resource: 'rag', action: 'read', description: 'Query knowledge base' },
  { name: 'rag:index', resource: 'rag', action: 'create', description: 'Index documents' },

  // Admin permissions
  { name: 'admin:*', resource: 'admin', action: '*', description: 'Full admin access' },
  { name: 'user:manage', resource: 'user', action: 'manage', description: 'Manage users' },
  { name: 'role:manage', resource: 'role', action: 'manage', description: 'Manage roles' },
];
