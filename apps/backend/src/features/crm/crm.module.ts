import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module'
import { CrmService } from './crm.service'
import { CrmController } from '../../presentation/crm/crm.controller'

@Module({
  imports: [PrismaModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
