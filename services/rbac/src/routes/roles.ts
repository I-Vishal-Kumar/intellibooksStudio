/**
 * Role Management Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@intellibooks/auth';
import type { RoleService } from '../services/role';
import { CreateRoleSchema, UpdateRoleSchema, CreatePermissionSchema } from '../models/role';

export function createRoleRoutes(roleService: RoleService): Router {
  const router = Router();

  /**
   * Get all roles
   * GET /api/roles
   */
  router.get(
    '/',
    authenticate(),
    authorize({ resource: 'role', action: 'read' }),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.query.organizationId as string | undefined;
        const roles = await roleService.getAllRoles(organizationId);

        res.json({ roles });
      } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to get roles',
        });
      }
    }
  );

  /**
   * Get role by ID
   * GET /api/roles/:id
   */
  router.get(
    '/:id',
    authenticate(),
    authorize({ resource: 'role', action: 'read' }),
    async (req: Request, res: Response) => {
      try {
        const role = await roleService.getRoleById(req.params.id);

        if (!role) {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: 'Role not found',
          });
        }

        res.json({ role });
      } catch (error) {
        console.error('Get role error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to get role',
        });
      }
    }
  );

  /**
   * Create a new role
   * POST /api/roles
   */
  router.post(
    '/',
    authenticate(),
    authorize({ resource: 'role', action: 'create' }),
    async (req: Request, res: Response) => {
      try {
        const parseResult = CreateRoleSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.errors,
          });
        }

        const role = await roleService.createRole(parseResult.data);

        res.status(201).json({ role });
      } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to create role',
        });
      }
    }
  );

  /**
   * Update a role
   * PUT /api/roles/:id
   */
  router.put(
    '/:id',
    authenticate(),
    authorize({ resource: 'role', action: 'update' }),
    async (req: Request, res: Response) => {
      try {
        const parseResult = UpdateRoleSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.errors,
          });
        }

        const role = await roleService.updateRole(req.params.id, parseResult.data);

        if (!role) {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: 'Role not found',
          });
        }

        res.json({ role });
      } catch (error: any) {
        if (error.message?.includes('system roles')) {
          return res.status(400).json({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        console.error('Update role error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to update role',
        });
      }
    }
  );

  /**
   * Delete a role
   * DELETE /api/roles/:id
   */
  router.delete(
    '/:id',
    authenticate(),
    authorize({ resource: 'role', action: 'delete' }),
    async (req: Request, res: Response) => {
      try {
        const deleted = await roleService.deleteRole(req.params.id);

        if (!deleted) {
          return res.status(404).json({
            code: 'NOT_FOUND',
            message: 'Role not found',
          });
        }

        res.status(204).send();
      } catch (error: any) {
        if (error.message?.includes('system roles')) {
          return res.status(400).json({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        console.error('Delete role error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete role',
        });
      }
    }
  );

  /**
   * Get all permissions
   * GET /api/permissions
   */
  router.get(
    '/permissions',
    authenticate(),
    authorize({ resource: 'role', action: 'read' }),
    async (req: Request, res: Response) => {
      try {
        const permissions = await roleService.getAllPermissions();

        res.json({ permissions });
      } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to get permissions',
        });
      }
    }
  );

  /**
   * Create a new permission
   * POST /api/permissions
   */
  router.post(
    '/permissions',
    authenticate(),
    authorize({ resource: 'role', action: 'manage' }),
    async (req: Request, res: Response) => {
      try {
        const parseResult = CreatePermissionSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.errors,
          });
        }

        const permission = await roleService.createPermission(parseResult.data);

        res.status(201).json({ permission });
      } catch (error) {
        console.error('Create permission error:', error);
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to create permission',
        });
      }
    }
  );

  return router;
}
