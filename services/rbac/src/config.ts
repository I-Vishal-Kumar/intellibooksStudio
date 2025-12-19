/**
 * RBAC Service Configuration
 */

export interface Config {
  port: number;
  host: string;
  nodeEnv: string;

  database: {
    url: string;
  };

  redis: {
    url: string;
  };

  clerk: {
    secretKey: string;
    publishableKey?: string;
  };

  cors: {
    origins: string[];
  };
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): Config {
  return {
    port: parseInt(getEnvOrDefault('PORT', '8003'), 10),
    host: getEnvOrDefault('HOST', '0.0.0.0'),
    nodeEnv: getEnvOrDefault('NODE_ENV', 'development'),

    database: {
      url: getEnvOrThrow('DATABASE_URL'),
    },

    redis: {
      url: getEnvOrDefault('REDIS_URL', 'redis://localhost:6379'),
    },

    clerk: {
      secretKey: getEnvOrThrow('CLERK_SECRET_KEY'),
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    },

    cors: {
      origins: getEnvOrDefault('CORS_ORIGINS', '*').split(','),
    },
  };
}

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}
