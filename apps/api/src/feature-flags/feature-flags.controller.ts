import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { FeatureFlagsService, OrganizationConfiguration } from './feature-flags.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { Role } from '@englove/shared';
import { UpdateExtraContentDto } from './dto/update-extra-content.dto';

@Controller('feature-flags')
@Roles(Role.teacher, Role.student)
@UseInterceptors(NoCacheInterceptor)
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getFeatureFlags(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationConfiguration> {
    return this.featureFlagsService.getConfiguration(user.organizationId);
  }

  @Patch('extra_content')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async updateExtraContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateExtraContentDto,
  ): Promise<OrganizationConfiguration> {
    return this.featureFlagsService.updateExtraContentFlag(
      user.organizationId,
      dto.enabled,
    );
  }
}
