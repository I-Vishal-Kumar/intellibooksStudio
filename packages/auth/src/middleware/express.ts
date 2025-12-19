/**
 * Express Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { createAuthClient, type ClerkAuthClient } from '../clerk';
import type { User, AuthContext, PermissionAction } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      user?: User;
    }
  }
}

export interface AuthMiddlewareOptions {
  client?: ClerkAuthClient;
  optional?: boolean;
  onError?: (error: Error, req: Request, res: Response) => void;
}

/**
 * Authentication middleware - verifies JWT token from Authorization header
 */
export function authenticate(options: AuthMiddlewareOptions = {}) {
  const client = options.client || createAuthClient();

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (options.optional) {
        req.auth = { user: null, isAuthenticated: false, isLoading: false };
        return next();
      }

      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const result = await client.verifyToken(token);

      if (!result.success || !result.user) {
        if (options.optional) {
          req.auth = { user: null, isAuthenticated: false, isLoading: false };
          return next();
        }

        return res.status(401).json({
          code: result.errorCode || 'UNAUTHORIZED',
          message: result.error || 'Authentication failed',
        });
      }

      req.auth = {
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
      };
      req.user = result.user;

      next();
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error, req, res);
        return;
      }

      if (options.optional) {
        req.auth = { user: null, isAuthenticated: false, isLoading: false };
        return next();
      }

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Authentication error',
      });
    }
  };
}

export interface AuthorizeOptions {
  resource: string;
  action: PermissionAction;
  getResourceId?: (req: Request) => string | undefined;
}

/**
 * Authorization middleware - checks if user has required permissions
 */
export function authorize(options: AuthorizeOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.isAuthenticated || !req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const user = req.user;
    const resourceId = options.getResourceId?.(req);

    // Check if user has wildcard permission
    const hasWildcard = user.permissions.some(
      (p) => p.resource === '*' && (p.action === '*' || p.action === 'manage')
    );

    if (hasWildcard) {
      return next();
    }

    // Check for specific permission
    const hasPermission = user.permissions.some(
      (p) =>
        (p.resource === options.resource || p.resource === '*') &&
        (p.action === options.action || p.action === '*' || p.action === 'manage')
    );

    if (!hasPermission) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: `Missing permission: ${options.resource}:${options.action}`,
      });
    }

    next();
  };
}

/**
 * Require specific roles middleware
 */
export function requireRoles(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.isAuthenticated || !req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const userRoles = req.user.roles.map((r) => r.name);
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: `Required roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Require organization membership middleware
 */
export function requireOrganization(orgIdParam: string = 'organizationId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.isAuthenticated || !req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const requestedOrgId =
      req.params[orgIdParam] || req.query[orgIdParam] || req.body?.[orgIdParam];

    if (!requestedOrgId) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Organization ID required',
      });
    }

    if (req.user.organizationId !== requestedOrgId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Not a member of this organization',
      });
    }

    next();
  };
}
