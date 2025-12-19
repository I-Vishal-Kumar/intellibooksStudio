/**
 * User Service for RBAC
 */

import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import type {
  User,
  CreateUserFromClerk,
  UpdateUser,
  AssignRoles,
} from '../models/user';
import type { Role, PermissionAction } from '../models/role';
import { AuthorizationService } from './authorization';

export class UserService {
  private db: Pool;
  private redis: Redis;
  private authService: AuthorizationService;

  constructor(db: Pool, redis: Redis, authService: AuthorizationService) {
    this.db = db;
    this.redis = redis;
    this.authService = authService;
  }

  /**
   * Create or update user from Clerk webhook
   */
  async upsertFromClerk(data: CreateUserFromClerk): Promise<User> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if user exists
      const existing = await client.query(
        'SELECT id FROM auth.users WHERE clerk_id = $1',
        [data.clerkId]
      );

      let userId: string;
      const now = new Date();

      if (existing.rows.length > 0) {
        // Update existing user
        userId = existing.rows[0].id;

        await client.query(
          `
          UPDATE auth.users
          SET email = $1, first_name = $2, last_name = $3, image_url = $4, updated_at = $5
          WHERE id = $6
          `,
          [data.email, data.firstName, data.lastName, data.imageUrl, now, userId]
        );
      } else {
        // Create new user
        userId = uuid();

        await client.query(
          `
          INSERT INTO auth.users (id, clerk_id, email, first_name, last_name, image_url, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [userId, data.clerkId, data.email, data.firstName, data.lastName, data.imageUrl, now, now]
        );

        // Assign default role
        const defaultRole = await client.query(
          'SELECT id FROM auth.roles WHERE is_default = true LIMIT 1'
        );

        if (defaultRole.rows.length > 0) {
          await client.query(
            'INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2)',
            [userId, defaultRole.rows[0].id]
          );
        }
      }

      await client.query('COMMIT');

      return this.getUserById(userId) as Promise<User>;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const result = await this.db.query(
      `
      SELECT u.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', r.id,
                   'name', r.name,
                   'description', r.description,
                   'isDefault', r.is_default,
                   'isSystem', r.is_system
                 )
               ) FILTER (WHERE r.id IS NOT NULL),
               '[]'
             ) as roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
      LEFT JOIN auth.roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUser(result.rows[0]);
  }

  /**
   * Get user by Clerk ID
   */
  async getUserByClerkId(clerkId: string): Promise<User | null> {
    const result = await this.db.query(
      `
      SELECT u.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', r.id,
                   'name', r.name,
                   'description', r.description,
                   'isDefault', r.is_default,
                   'isSystem', r.is_system
                 )
               ) FILTER (WHERE r.id IS NOT NULL),
               '[]'
             ) as roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
      LEFT JOIN auth.roles r ON r.id = ur.role_id
      WHERE u.clerk_id = $1
      GROUP BY u.id
      `,
      [clerkId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUser(result.rows[0]);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      `
      SELECT u.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', r.id,
                   'name', r.name,
                   'description', r.description,
                   'isDefault', r.is_default,
                   'isSystem', r.is_system
                 )
               ) FILTER (WHERE r.id IS NOT NULL),
               '[]'
             ) as roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
      LEFT JOIN auth.roles r ON r.id = ur.role_id
      WHERE u.email = $1
      GROUP BY u.id
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUser(result.rows[0]);
  }

  /**
   * Get all users
   */
  async getAllUsers(options?: {
    organizationId?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    let whereClause = '';
    const params: unknown[] = [];

    if (options?.organizationId) {
      whereClause = 'WHERE u.organization_id = $1';
      params.push(options.organizationId);
    }

    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM auth.users u ${whereClause}`,
      params
    );

    const result = await this.db.query(
      `
      SELECT u.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', r.id,
                   'name', r.name,
                   'description', r.description,
                   'isDefault', r.is_default,
                   'isSystem', r.is_system
                 )
               ) FILTER (WHERE r.id IS NOT NULL),
               '[]'
             ) as roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
      LEFT JOIN auth.roles r ON r.id = ur.role_id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );

    return {
      users: result.rows.map((row) => this.mapUser(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Update a user
   */
  async updateUser(id: string, data: UpdateUser): Promise<User | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }

    if (data.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }

    if (data.imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(data.imageUrl);
    }

    if (data.organizationId !== undefined) {
      updates.push(`organization_id = $${paramIndex++}`);
      values.push(data.organizationId);
    }

    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    values.push(id);

    await this.db.query(
      `UPDATE auth.users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Update roles if provided
    if (data.roleIds !== undefined) {
      await this.assignRoles({ userId: id, roleIds: data.roleIds, replace: true });
    }

    return this.getUserById(id);
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<boolean> {
    // Invalidate cache
    await this.authService.invalidateUserCache(id);

    const result = await this.db.query('DELETE FROM auth.users WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Assign roles to a user
   */
  async assignRoles(data: AssignRoles): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      if (data.replace) {
        // Remove existing roles
        await client.query('DELETE FROM auth.user_roles WHERE user_id = $1', [data.userId]);
      }

      // Add new roles
      if (data.roleIds.length > 0) {
        const values = data.roleIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(', ');

        await client.query(
          `INSERT INTO auth.user_roles (user_id, role_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          [data.userId, ...data.roleIds]
        );
      }

      await client.query('COMMIT');

      // Invalidate cache
      await this.authService.invalidateUserCache(data.userId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove roles from a user
   */
  async removeRoles(userId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;

    const placeholders = roleIds.map((_, i) => `$${i + 2}`).join(', ');

    await this.db.query(
      `DELETE FROM auth.user_roles WHERE user_id = $1 AND role_id IN (${placeholders})`,
      [userId, ...roleIds]
    );

    // Invalidate cache
    await this.authService.invalidateUserCache(userId);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE auth.users SET last_login_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Map database row to User
   */
  private mapUser(row: any): User {
    return {
      id: row.id,
      clerkId: row.clerk_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      imageUrl: row.image_url,
      roles: row.roles || [],
      organizationId: row.organization_id,
      metadata: row.metadata || {},
      isActive: row.is_active,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
