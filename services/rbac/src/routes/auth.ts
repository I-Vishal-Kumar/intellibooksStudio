/**
 * Authentication Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@intellibooks/auth';
import type { UserService } from '../services/user';
import type { AuthorizationService } from '../services/authorization';

export function createAuthRoutes(
  userService: UserService,
  authService: AuthorizationService
): Router {
  const router = Router();

  /**
   * Verify token and return user info
   * POST /api/auth/verify
   */
  router.post('/verify', authenticate(), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Upsert user in our database
      const user = await userService.upsertFromClerk({
        clerkId: req.user.clerkId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        imageUrl: req.user.imageUrl,
      });

      // Update last login
      await userService.updateLastLogin(user.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
          roles: user.roles.map((r) => r.name),
          organizationId: user.organizationId,
        },
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify token',
      });
    }
  });

  /**
   * Check authorization
   * POST /api/auth/authorize
   */
  router.post('/authorize', authenticate(), async (req: Request, res: Response) => {
    try {
      const { resource, action, resourceId, context } = req.body;

      if (!resource || !action) {
        return res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Resource and action are required',
        });
      }

      // Get internal user ID
      const user = await userService.getUserByClerkId(req.user!.clerkId);

      if (!user) {
        return res.status(404).json({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      const result = await authService.authorize({
        userId: user.id,
        resource,
        action,
        resourceId,
        context,
      });

      res.json(result);
    } catch (error) {
      console.error('Authorization check error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to check authorization',
      });
    }
  });

  /**
   * Get user permissions
   * GET /api/auth/permissions/:userId
   */
  router.get(
    '/permissions/:userId',
    authenticate(),
    authorize({ resource: 'user', action: 'read' }),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;

        const permissions = await authService.getUserPermissions(userId);

        res.json({
          userId,
          permissions: permissions.map((p) => ({
            name: p.name,
            resource: p.resource,
            action: p.action,
          })),
        });
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
   * Get current user's permissions
   * GET /api/auth/me/permissions
   */
  router.get('/me/permissions', authenticate(), async (req: Request, res: Response) => {
    try {
      const user = await userService.getUserByClerkId(req.user!.clerkId);

      if (!user) {
        return res.status(404).json({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      const permissions = await authService.getUserPermissions(user.id);

      res.json({
        permissions: permissions.map((p) => ({
          name: p.name,
          resource: p.resource,
          action: p.action,
        })),
      });
    } catch (error) {
      console.error('Get my permissions error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get permissions',
      });
    }
  });

  return router;
}
