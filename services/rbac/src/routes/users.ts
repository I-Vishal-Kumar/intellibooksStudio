/**
 * User Management Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@intellibooks/auth';
import type { UserService } from '../services/user';
import { UpdateUserSchema, AssignRolesSchema } from '../models/user';

export function createUserRoutes(userService: UserService): Router {
    const router = Router();

    /**
     * Get current user
     * GET /api/users/me
     */
    router.get('/me', authenticate(), async (req: Request, res: Response) => {
        try {
            const user = await userService.getUserByClerkId(req.user!.clerkId);

            if (!user) {
                return res.status(404).json({
                    code: 'NOT_FOUND',
                    message: 'User not found',
                });
            }

            res.json({ user });
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                code: 'INTERNAL_ERROR',
                message: 'Failed to get user',
            });
        }
    });

    /**
     * Get all users
     * GET /api/users
     */
    router.get(
        '/',
        authenticate(),
        authorize({ resource: 'user', action: 'read' }),
        async (req: Request, res: Response) => {
            try {
                const organizationId = req.query.organizationId as string | undefined;
                const offset = parseInt(req.query.offset as string) || 0;
                const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

                const result = await userService.getAllUsers({ organizationId, offset, limit });

                res.json({
                    users: result.users,
                    total: result.total,
                    offset,
                    limit,
                });
            } catch (error) {
                console.error('Get users error:', error);
                res.status(500).json({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get users',
                });
            }
        }
    );

    /**
     * Get user by ID
     * GET /api/users/:id
     */
    router.get(
        '/:id',
        authenticate(),
        authorize({ resource: 'user', action: 'read' }),
        async (req: Request, res: Response) => {
            try {
                const user = await userService.getUserById(req.params.id);

                if (!user) {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: 'User not found',
                    });
                }

                res.json({ user });
            } catch (error) {
                console.error('Get user error:', error);
                res.status(500).json({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get user',
                });
            }
        }
    );

    /**
     * Update a user
     * PUT /api/users/:id
     */
    router.put(
        '/:id',
        authenticate(),
        authorize({ resource: 'user', action: 'update' }),
        async (req: Request, res: Response) => {
            try {
                const parseResult = UpdateUserSchema.safeParse(req.body);

                if (!parseResult.success) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body',
                        details: parseResult.error.errors,
                    });
                }

                const user = await userService.updateUser(req.params.id, parseResult.data);

                if (!user) {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: 'User not found',
                    });
                }

                res.json({ user });
            } catch (error) {
                console.error('Update user error:', error);
                res.status(500).json({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update user',
                });
            }
        }
    );

    /**
     * Delete a user
     * DELETE /api/users/:id
     */
    router.delete(
        '/:id',
        authenticate(),
        authorize({ resource: 'user', action: 'delete' }),
        async (req: Request, res: Response) => {
            try {
                const deleted = await userService.deleteUser(req.params.id);

                if (!deleted) {
                    return res.status(404).json({
                        code: 'NOT_FOUND',
                        message: 'User not found',
                    });
                }

                res.status(204).send();
            } catch (error) {
                console.error('Delete user error:', error);
                res.status(500).json({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to delete user',
                });
            }
        }
    );

    /**
     * Assign roles to a user
     * POST /api/users/:id/roles
     */
    router.post(
        '/:id/roles',
        authenticate(),
        authorize({ resource: 'user', action: 'manage' }),
        async (req: Request, res: Response) => {
            try {
                const parseResult = AssignRolesSchema.safeParse({
                    userId: req.params.id,
                    ...req.body,
                });

                if (!parseResult.success) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body',
                        details: parseResult.error.errors,
                    });
                }

                await userService.assignRoles(parseResult.data);

                const user = await userService.getUserById(req.params.id);

                res.json({ user });
            } catch (error) {
                console.error('Assign roles error:', error);
                res.status(500).json({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to assign roles',
                });
            }
        }
    );

    /**
     * Remove roles from a user
     * DELETE /api/users/:id/roles
     */
    router.delete(
        '/:id/roles',
        authenticate(),
        authorize({ resource: 'user', action: 'manage' }),
        async (req: Request, res: Response) => {
            try {
                const { roleIds } = req.body;

                if (!Array.isArray(roleIds)) {
                    return res.status(400).json({
                        code: 'VALIDATION_ERROR',
                        message: 'roleIds must be an array',
                    });
                }

                await userService.removeRoles(req.params.id, roleIds);

                const user = await userService.getUserById(req.params.id);

                res.json({ user });
            } catch (error) {
                console.error('Remove roles error:', error);
                res.status(500).json({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to remove roles',
                });
            }
        }
    );

    return router;
}
