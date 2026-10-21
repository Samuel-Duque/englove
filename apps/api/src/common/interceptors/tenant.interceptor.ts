import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../tenant/tenant.context';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (user?.organizationId) {
      return new Observable((subscriber) => {
        TenantContext.run(
          {
            organizationId: user.organizationId,
            userId: user.id,
            role: user.role,
            studentId: user.studentId,
            ageSegment: user.ageSegment,
            sessionId: user.sessionId,
          },
          () => {
            next.handle().subscribe(subscriber);
          },
        );
      });
    }

    return next.handle();
  }
}
