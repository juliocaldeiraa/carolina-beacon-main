import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module'
import { ConversationsService } from './conversations.service'
import { ConversationsController } from '../../presentation/conversations/conversations.controller'

@Module({
  imports: [PrismaModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
