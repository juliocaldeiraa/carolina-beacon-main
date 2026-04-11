import { Module }           from '@nestjs/common'
import { PrismaModule }     from '@/infrastructure/database/prisma/prisma.module'
import { ProfileService }   from './profile.service'
import { AiProvidersService } from './ai-providers.service'
import { WebhooksService }  from './webhooks.service'
import { CentralAiService } from './central-ai.service'
import { DatabaseService }  from './database.service'
import { SettingsController } from '@/presentation/settings/settings.controller'

@Module({
  imports:     [PrismaModule],
  providers:   [ProfileService, AiProvidersService, WebhooksService, CentralAiService, DatabaseService],
  controllers: [SettingsController],
  exports:     [ProfileService, CentralAiService],
})
export class SettingsModule {}
