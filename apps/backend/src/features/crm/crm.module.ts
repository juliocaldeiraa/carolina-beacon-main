import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module'
import { CrmService } from './crm.service'
import { WhatsAppCrmService } from './whatsapp-crm.service'
import { CrmController } from '../../presentation/crm/crm.controller'

@Module({
  imports: [PrismaModule],
  controllers: [CrmController],
  providers: [CrmService, WhatsAppCrmService],
  exports: [CrmService, WhatsAppCrmService],
})
export class CrmModule {}
