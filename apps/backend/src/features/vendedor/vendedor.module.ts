import { Module }         from '@nestjs/common'
import { PrismaModule }   from '@/infrastructure/database/prisma/prisma.module'
import { LeadsService }   from './leads.service'
import { LeadsController } from '@/presentation/vendedor/leads.controller'

@Module({
  imports:     [PrismaModule],
  controllers: [LeadsController],
  providers:   [LeadsService],
  exports:     [LeadsService],
})
export class VendedorModule {}
