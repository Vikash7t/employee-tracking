/**
 * Enterprise Production Environment Security Validator.
 * Enforces fail-fast startup behavior if critical secrets are missing, insecure, or using default dev keys.
 */
export function validateEnvironment(env = process.env): void {
  const isProduction = env.NODE_ENV === 'production';

  // 1. Database URL Validation
  if (!env.DATABASE_URL) {
    throw new Error('[Security Error] DATABASE_URL environment variable is required.');
  }

  if (!env.DATABASE_URL.startsWith('postgres://') && !env.DATABASE_URL.startsWith('postgresql://')) {
    throw new Error('[Security Error] DATABASE_URL must start with postgresql:// or postgres://');
  }

  // 2. Port Validation
  if (env.PORT) {
    const port = parseInt(env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`[Configuration Error] PORT must be an integer between 1 and 65535. Got: ${env.PORT}`);
    }
  }

  // 3. Strict Production Secrets & Entropy Verification
  if (isProduction) {
    if (!env.JWT_SECRET) {
      throw new Error('[Security Error] JWT_SECRET is strictly required in production.');
    }

    if (env.JWT_SECRET.length < 32) {
      throw new Error('[Security Error] JWT_SECRET must be at least 32 characters for adequate entropy.');
    }

    if (env.JWT_SECRET.toLowerCase().includes('dev_') || env.JWT_SECRET.includes('change_in_production')) {
      throw new Error('[Security Error] Default development JWT_SECRET is forbidden in production environments.');
    }

    if (env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1')) {
      throw new Error('[Security Error] Production DATABASE_URL cannot point to localhost or loopback address.');
    }
  }
}
