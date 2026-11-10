import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

/**
 * Enterprise Correlation ID Middleware.
 * Prevents log injection (CWE-117) by strictly validating client-supplied correlation headers.
 * Generates an RFC-4122 v4 UUID if missing or invalid, and echoes it back in response headers.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private static readonly SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]{8,64}$/;

  use(req: CorrelatedRequest, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    const candidateId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    let correlationId: string;
    if (candidateId && CorrelationIdMiddleware.SAFE_ID_REGEX.test(candidateId)) {
      correlationId = candidateId;
    } else {
      correlationId = randomUUID();
    }

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
