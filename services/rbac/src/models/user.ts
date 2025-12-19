/**
 * User Models for RBAC
 */

import { z } from 'zod';
import { RoleSchema } from './role';

// User schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  clerkId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
  roles: z.array(RoleSchema),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// User creation from Clerk webhook
export const CreateUserFromClerkSchema = z.object({
  clerkId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type CreateUserFromClerk = z.infer<typeof CreateUserFromClerkSchema>;

// Update user
export const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

// User role assignment
export const AssignRolesSchema = z.object({
  userId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()),
  replace: z.boolean().default(false),
});

export type AssignRoles = z.infer<typeof AssignRolesSchema>;

// Authorization check request
export const AuthorizationCheckSchema = z.object({
  userId: z.string().uuid(),
  resource: z.string(),
  action: z.string(),
  resourceId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export type AuthorizationCheck = z.infer<typeof AuthorizationCheckSchema>;

// Authorization result
export const AuthorizationResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  matchedPermissions: z.array(z.string()).optional(),
});

export type AuthorizationResult = z.infer<typeof AuthorizationResultSchema>;
