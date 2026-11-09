import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

@Injectable()
export class AppLogger implements LoggerService {
  private formatMessage(level: string, message: unknown, context?: string): string {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` [${context}]` : '';
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    return `[${timestamp}] [${level.toUpperCase()}]${ctx} ${msg}`;
  }

  log(message: unknown, context?: string): void {
    console.log(this.formatMessage('info', message, context));
  }

  error(message: unknown, trace?: string, context?: string): void {
    console.error(this.formatMessage('error', message, context), trace ? `\nStack: ${trace}` : '');
  }

  warn(message: unknown, context?: string): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug?(message: unknown, context?: string): void {
    console.debug(this.formatMessage('debug', message, context));
  }
}
