import { Controller, Get, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { FeatureFlagsService, OrganizationConfiguration } from './feature-flags.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { Role } from '@englove/shared';

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
}
