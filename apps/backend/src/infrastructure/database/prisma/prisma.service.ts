import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Conexão lazy — Prisma conecta na primeira query automaticamente
    // Não bloquear startup em caso de DB temporariamente indisponível
    try {
      await this.$connect()
    } catch (err) {
      console.error('[PrismaService] Aviso: $connect() falhou na inicialização:', err instanceof Error ? err.message : err)
      // Continua: Prisma vai tentar reconectar nas próximas queries
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
