import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [PrismaModule, MailModule, ConfigModule, MediaModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
