/**
 * Clerk Client - Backend SDK wrapper for Clerk authentication
 */

import { createClerkClient, type ClerkClient } from '@clerk/backend';
import type { ClerkUser, ClerkSession, User, AuthResult, AuthErrorCode } from '../types';

export interface ClerkClientConfig {
  secretKey: string;
  publishableKey?: string;
}

export class ClerkAuthClient {
  private client: ClerkClient;

  constructor(config: ClerkClientConfig) {
    this.client = createClerkClient({
      secretKey: config.secretKey,
      publishableKey: config.publishableKey,
    });
  }

  /**
   * Verify a session token and return the user
   */
  async verifyToken(token: string): Promise<AuthResult> {
    try {
      const { sub: userId } = await this.client.verifyToken(token);

      if (!userId) {
        return {
          success: false,
          error: 'Invalid token: no user ID',
          errorCode: 'INVALID_TOKEN',
        };
      }

      const clerkUser = await this.client.users.getUser(userId);
      const user = this.mapClerkUser(clerkUser as unknown as ClerkUser);

      return {
        success: true,
        user,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('expired')) {
        return {
          success: false,
          error: 'Token has expired',
          errorCode: 'EXPIRED_TOKEN',
        };
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: 'INVALID_TOKEN',
      };
    }
  }

  /**
   * Get user by Clerk ID
   */
  async getUser(clerkId: string): Promise<User | null> {
    try {
      const clerkUser = await this.client.users.getUser(clerkId);
      return this.mapClerkUser(clerkUser as unknown as ClerkUser);
    } catch {
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.client.users.getUserList({
        emailAddress: [email],
      });

      if (users.data.length === 0) {
        return null;
      }

      return this.mapClerkUser(users.data[0] as unknown as ClerkUser);
    } catch {
      return null;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<ClerkSession[]> {
    try {
      const sessions = await this.client.sessions.getSessionList({
        userId,
        status: 'active',
      });

      return sessions.data.map((session) => ({
        id: session.id,
        userId: session.userId,
        status: session.status,
        lastActiveAt: session.lastActiveAt,
        expireAt: session.expireAt,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Revoke a session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      await this.client.sessions.revokeSession(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update user metadata
   */
  async updateUserMetadata(
    userId: string,
    publicMetadata?: Record<string, unknown>,
    privateMetadata?: Record<string, unknown>
  ): Promise<User | null> {
    try {
      const updated = await this.client.users.updateUserMetadata(userId, {
        publicMetadata,
        privateMetadata,
      });

      return this.mapClerkUser(updated as unknown as ClerkUser);
    } catch {
      return null;
    }
  }

  /**
   * Map Clerk user to our User type
   */
  private mapClerkUser(clerkUser: ClerkUser): User {
    const metadata = clerkUser.publicMetadata || {};
    const roles = (metadata.roles as string[]) || ['user'];
    const permissions = (metadata.permissions as string[]) || [];

    return {
      id: clerkUser.id,
      clerkId: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      firstName: clerkUser.firstName || undefined,
      lastName: clerkUser.lastName || undefined,
      imageUrl: clerkUser.imageUrl || undefined,
      roles: roles.map((name) => ({
        id: name,
        name,
        permissions: [],
        isDefault: name === 'user',
      })),
      permissions: permissions.map((perm) => {
        const [resource, action] = perm.split(':');
        return {
          id: perm,
          name: perm,
          resource: resource || '*',
          action: (action as any) || 'read',
        };
      }),
      organizationId: (metadata.organizationId as string) || undefined,
      metadata: clerkUser.privateMetadata || {},
      createdAt: new Date(clerkUser.createdAt),
      updatedAt: new Date(clerkUser.updatedAt),
    };
  }
}

/**
 * Create a Clerk client instance
 */
export function createAuthClient(config?: Partial<ClerkClientConfig>): ClerkAuthClient {
  const secretKey = config?.secretKey || process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required');
  }

  return new ClerkAuthClient({
    secretKey,
    publishableKey: config?.publishableKey || process.env.CLERK_PUBLISHABLE_KEY,
  });
}
