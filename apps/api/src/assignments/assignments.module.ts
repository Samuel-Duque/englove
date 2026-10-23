import { Module, forwardRef } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AttemptsModule } from '../attempts/attempts.module';

@Module({
  imports: [forwardRef(() => AttemptsModule)],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
