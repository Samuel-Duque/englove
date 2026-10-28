import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import {
  StatsOverviewQueryDto,
  StatsGroupQueryDto,
  StatsLeaderboardQueryDto,
  StatsStudentQueryDto,
} from './dto/stats-query.dto';
import {
  Role,
  StatsOverviewResponse,
  GroupStatsResponse,
  LeaderboardResponse,
  StudentStatsResponse,
} from '@englove/shared';

@Controller('stats')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsOverviewQueryDto,
  ): Promise<StatsOverviewResponse> {
    return this.statsService.getOverview(user.organizationId, query);
  }

  @Get('groups/:id')
  @HttpCode(HttpStatus.OK)
  async getGroupStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: StatsGroupQueryDto,
  ): Promise<GroupStatsResponse> {
    return this.statsService.getGroupStats(user.organizationId, id, query);
  }

  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  async getLeaderboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsLeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    return this.statsService.getLeaderboard(user.organizationId, query);
  }

  @Get('students/:id')
  @HttpCode(HttpStatus.OK)
  async getStudentStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: StatsStudentQueryDto,
  ): Promise<StudentStatsResponse> {
    return this.statsService.getStudentStats(user.organizationId, id, query);
  }
}
