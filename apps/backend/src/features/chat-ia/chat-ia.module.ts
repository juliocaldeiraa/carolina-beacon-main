import { Module } from '@nestjs/common'
import { PrismaModule } from '@/infrastructure/database/prisma/prisma.module'
import { ChatIaService } from './chat-ia.service'
import { ChatIaController } from '@/presentation/chat-ia/chat-ia.controller'

@Module({
  imports:     [PrismaModule],
  controllers: [ChatIaController],
  providers:   [ChatIaService],
  exports:     [ChatIaService],
})
export class ChatIaModule {}
