import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BackupsController, BackupsSyncController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BackupsSyncController, BackupsController],
  providers: [BackupsService],
})
export class BackupsModule {}
