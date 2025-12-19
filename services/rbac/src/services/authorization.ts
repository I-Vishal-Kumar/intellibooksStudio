/**
 * Authorization Service
 */

import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { Permission, PermissionAction } from '../models/role';
import type { AuthorizationCheck, AuthorizationResult } from '../models/user';

export class AuthorizationService {
  private db: Pool;
  private redis: Redis;
  private cachePrefix = 'rbac:permissions:';
  private cacheTtl = 300; // 5 minutes

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Check if a user is authorized to perform an action on a resource
   */
  async authorize(check: AuthorizationCheck): Promise<AuthorizationResult> {
    // Get user permissions (with caching)
    const permissions = await this.getUserPermissions(check.userId);

    if (permissions.length === 0) {
      return {
        allowed: false,
        reason: 'User has no permissions',
      };
    }

    // Check for wildcard permission
    const hasWildcard = permissions.some(
      (p) => p.resource === '*' && (p.action === '*' || p.action === 'manage')
    );

    if (hasWildcard) {
      return {
        allowed: true,
        reason: 'User has wildcard permission',
        matchedPermissions: ['*:*'],
      };
    }

    // Check for matching permissions
    const matchingPermissions = permissions.filter((p) => {
      const resourceMatch = p.resource === check.resource || p.resource === '*';
      const actionMatch =
        p.action === check.action || p.action === '*' || p.action === 'manage';

      if (!resourceMatch || !actionMatch) {
        return false;
      }

      // Check conditions if any
      if (p.conditions && p.conditions.length > 0) {
        return this.evaluateConditions(p.conditions, check.context || {});
      }

      return true;
    });

    if (matchingPermissions.length > 0) {
      return {
        allowed: true,
        reason: 'Permission granted',
        matchedPermissions: matchingPermissions.map((p) => `${p.resource}:${p.action}`),
      };
    }

    return {
      allowed: false,
      reason: `Missing permission: ${check.resource}:${check.action}`,
    };
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Check cache first
    const cacheKey = `${this.cachePrefix}${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const result = await this.db.query(
      `
      SELECT DISTINCT p.*
      FROM auth.permissions p
      INNER JOIN auth.role_permissions rp ON rp.permission_id = p.id
      INNER JOIN auth.user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = $1
      `,
      [userId]
    );

    const permissions = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      resource: row.resource,
      action: row.action as PermissionAction,
      description: row.description,
      conditions: row.conditions,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    // Cache the result
    await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(permissions));

    return permissions;
  }

  /**
   * Invalidate permissions cache for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const cacheKey = `${this.cachePrefix}${userId}`;
    await this.redis.del(cacheKey);
  }

  /**
   * Invalidate permissions cache for all users with a specific role
   */
  async invalidateRoleCache(roleId: string): Promise<void> {
    // Get all users with this role
    const result = await this.db.query(
      'SELECT user_id FROM auth.user_roles WHERE role_id = $1',
      [roleId]
    );

    // Invalidate cache for each user
    const pipeline = this.redis.pipeline();
    for (const row of result.rows) {
      pipeline.del(`${this.cachePrefix}${row.user_id}`);
    }
    await pipeline.exec();
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions: Array<{ field: string; operator: string; value: unknown }>,
    context: Record<string, unknown>
  ): boolean {
    for (const condition of conditions) {
      const contextValue = context[condition.field];

      switch (condition.operator) {
        case 'eq':
          if (contextValue !== condition.value) return false;
          break;
        case 'ne':
          if (contextValue === condition.value) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(contextValue))
            return false;
          break;
        case 'nin':
          if (Array.isArray(condition.value) && condition.value.includes(contextValue))
            return false;
          break;
        case 'gt':
          if (typeof contextValue !== 'number' || contextValue <= (condition.value as number))
            return false;
          break;
        case 'lt':
          if (typeof contextValue !== 'number' || contextValue >= (condition.value as number))
            return false;
          break;
        case 'gte':
          if (typeof contextValue !== 'number' || contextValue < (condition.value as number))
            return false;
          break;
        case 'lte':
          if (typeof contextValue !== 'number' || contextValue > (condition.value as number))
            return false;
          break;
      }
    }

    return true;
  }
}
