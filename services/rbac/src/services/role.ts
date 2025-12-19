/**
 * Role Service
 */

import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import type {
  Role,
  Permission,
  CreateRole,
  UpdateRole,
  CreatePermission,
  PermissionAction,
} from '../models/role';
import { AuthorizationService } from './authorization';

export class RoleService {
  private db: Pool;
  private redis: Redis;
  private authService: AuthorizationService;

  constructor(db: Pool, redis: Redis, authService: AuthorizationService) {
    this.db = db;
    this.redis = redis;
    this.authService = authService;
  }

  // ===================
  // Role Operations
  // ===================

  /**
   * Create a new role
   */
  async createRole(data: CreateRole): Promise<Role> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const id = uuid();
      const now = new Date();

      // Insert role
      await client.query(
        `
        INSERT INTO auth.roles (id, name, description, is_default, organization_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [id, data.name, data.description, data.isDefault || false, data.organizationId, now, now]
      );

      // Assign permissions
      if (data.permissionIds.length > 0) {
        const values = data.permissionIds
          .map((permId, i) => `($1, $${i + 2})`)
          .join(', ');
        await client.query(
          `INSERT INTO auth.role_permissions (role_id, permission_id) VALUES ${values}`,
          [id, ...data.permissionIds]
        );
      }

      await client.query('COMMIT');

      return this.getRoleById(id) as Promise<Role>;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    const result = await this.db.query(
      `
      SELECT r.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'resource', p.resource,
                   'action', p.action,
                   'description', p.description,
                   'conditions', p.conditions,
                   'createdAt', p.created_at,
                   'updatedAt', p.updated_at
                 )
               ) FILTER (WHERE p.id IS NOT NULL),
               '[]'
             ) as permissions
      FROM auth.roles r
      LEFT JOIN auth.role_permissions rp ON rp.role_id = r.id
      LEFT JOIN auth.permissions p ON p.id = rp.permission_id
      WHERE r.id = $1
      GROUP BY r.id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRole(result.rows[0]);
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string, organizationId?: string): Promise<Role | null> {
    const result = await this.db.query(
      `
      SELECT r.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'resource', p.resource,
                   'action', p.action,
                   'description', p.description,
                   'conditions', p.conditions,
                   'createdAt', p.created_at,
                   'updatedAt', p.updated_at
                 )
               ) FILTER (WHERE p.id IS NOT NULL),
               '[]'
             ) as permissions
      FROM auth.roles r
      LEFT JOIN auth.role_permissions rp ON rp.role_id = r.id
      LEFT JOIN auth.permissions p ON p.id = rp.permission_id
      WHERE r.name = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)
      GROUP BY r.id
      `,
      [name, organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRole(result.rows[0]);
  }

  /**
   * Get all roles
   */
  async getAllRoles(organizationId?: string): Promise<Role[]> {
    const result = await this.db.query(
      `
      SELECT r.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'resource', p.resource,
                   'action', p.action,
                   'description', p.description,
                   'conditions', p.conditions,
                   'createdAt', p.created_at,
                   'updatedAt', p.updated_at
                 )
               ) FILTER (WHERE p.id IS NOT NULL),
               '[]'
             ) as permissions
      FROM auth.roles r
      LEFT JOIN auth.role_permissions rp ON rp.role_id = r.id
      LEFT JOIN auth.permissions p ON p.id = rp.permission_id
      WHERE r.organization_id = $1 OR r.organization_id IS NULL
      GROUP BY r.id
      ORDER BY r.is_system DESC, r.name ASC
      `,
      [organizationId]
    );

    return result.rows.map((row) => this.mapRole(row));
  }

  /**
   * Update a role
   */
  async updateRole(id: string, data: UpdateRole): Promise<Role | null> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if role exists and is not a system role
      const existing = await client.query(
        'SELECT is_system FROM auth.roles WHERE id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return null;
      }

      if (existing.rows[0].is_system && data.name) {
        throw new Error('Cannot rename system roles');
      }

      // Build update query
      const updates: string[] = ['updated_at = NOW()'];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }

      if (data.isDefault !== undefined) {
        updates.push(`is_default = $${paramIndex++}`);
        values.push(data.isDefault);
      }

      values.push(id);

      await client.query(
        `UPDATE auth.roles SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      // Update permissions if provided
      if (data.permissionIds !== undefined) {
        await client.query('DELETE FROM auth.role_permissions WHERE role_id = $1', [id]);

        if (data.permissionIds.length > 0) {
          const permValues = data.permissionIds
            .map((_, i) => `($1, $${i + 2})`)
            .join(', ');
          await client.query(
            `INSERT INTO auth.role_permissions (role_id, permission_id) VALUES ${permValues}`,
            [id, ...data.permissionIds]
          );
        }
      }

      await client.query('COMMIT');

      // Invalidate cache for all users with this role
      await this.authService.invalidateRoleCache(id);

      return this.getRoleById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<boolean> {
    // Check if system role
    const existing = await this.db.query(
      'SELECT is_system FROM auth.roles WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return false;
    }

    if (existing.rows[0].is_system) {
      throw new Error('Cannot delete system roles');
    }

    // Invalidate cache before deleting
    await this.authService.invalidateRoleCache(id);

    await this.db.query('DELETE FROM auth.roles WHERE id = $1', [id]);
    return true;
  }

  // ===================
  // Permission Operations
  // ===================

  /**
   * Create a new permission
   */
  async createPermission(data: CreatePermission): Promise<Permission> {
    const id = uuid();
    const now = new Date();

    await this.db.query(
      `
      INSERT INTO auth.permissions (id, name, resource, action, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [id, data.name, data.resource, data.action, data.description, now, now]
    );

    return {
      id,
      name: data.name,
      resource: data.resource,
      action: data.action,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    const result = await this.db.query(
      'SELECT * FROM auth.permissions ORDER BY resource, action'
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      resource: row.resource,
      action: row.action as PermissionAction,
      description: row.description,
      conditions: row.conditions,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Map database row to Role
   */
  private mapRole(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: row.permissions || [],
      isDefault: row.is_default,
      isSystem: row.is_system,
      organizationId: row.organization_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
