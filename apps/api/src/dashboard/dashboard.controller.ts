import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { PendingSummaryService } from './pending-summary.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { Role, RemindersResponse } from '@englove/shared';

@Controller('dashboard')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class DashboardController {
  constructor(private readonly pendingSummaryService: PendingSummaryService) {}

  @Get('reminders')
  @HttpCode(HttpStatus.OK)
  async getReminders(@CurrentUser() user: AuthenticatedUser): Promise<RemindersResponse> {
    return this.pendingSummaryService.getReminders(user.organizationId);
  }
}
