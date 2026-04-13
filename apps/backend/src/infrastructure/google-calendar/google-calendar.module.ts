import { Module } from '@nestjs/common'
import { PrismaModule } from '@/infrastructure/database/prisma/prisma.module'
import { GoogleCalendarService } from './google-calendar.service'

@Module({
  imports:   [PrismaModule],
  providers: [GoogleCalendarService],
  exports:   [GoogleCalendarService],
})
export class GoogleCalendarModule {}
