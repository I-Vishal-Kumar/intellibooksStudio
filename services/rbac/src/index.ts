/**
 * RBAC Service Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { getConfig } from './config';
import { AuthorizationService, RoleService, UserService } from './services';
import { createAuthRoutes, createRoleRoutes, createUserRoutes } from './routes';

async function main() {
  const config = getConfig();

  // Initialize database connection
  const db = new Pool({
    connectionString: config.database.url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Initialize Redis connection
  const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  // Initialize services
  const authService = new AuthorizationService(db, redis);
  const roleService = new RoleService(db, redis, authService);
  const userService = new UserService(db, redis, authService);

  // Create Express app
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'rbac-service',
      version: '1.0.0',
    });
  });

  // Routes
  app.use('/api/auth', createAuthRoutes(userService, authService));
  app.use('/api/roles', createRoleRoutes(roleService));
  app.use('/api/users', createUserRoutes(userService));

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  // Start server
  app.listen(config.port, config.host, () => {
    console.log(`RBAC Service running at http://${config.host}:${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await db.end();
    await redis.quit();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start RBAC Service:', error);
  process.exit(1);
});
