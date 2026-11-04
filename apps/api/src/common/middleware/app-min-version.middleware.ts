import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that appends X-App-Min-Version header when APP_MIN_VERSION is configured (SPEC-09 RF-7).
 */
@Injectable()
export class AppMinVersionMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(_req: Request, res: Response, next: NextFunction): void {
    const minVersion = this.configService.get<string>('APP_MIN_VERSION');
    if (minVersion && minVersion.trim() !== '') {
      res.setHeader('X-App-Min-Version', minVersion.trim());
    }
    next();
  }
}
