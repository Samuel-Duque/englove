import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { ReviewQueryDto } from './dto/reviews.dto';
import { Role, ReviewListResponse } from '@englove/shared';

@Controller('reviews')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('queue')
  @HttpCode(HttpStatus.OK)
  async getQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewQueryDto,
  ): Promise<ReviewListResponse> {
    return this.reviewsService.getQueue(user.organizationId, query);
  }

  @Get('graded')
  @HttpCode(HttpStatus.OK)
  async getGraded(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewQueryDto,
  ): Promise<ReviewListResponse> {
    return this.reviewsService.getGraded(user.organizationId, query);
  }
}
