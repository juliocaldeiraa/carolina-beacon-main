import { Injectable, NotFoundException } from '@nestjs/common'
import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateCentralAiDto {
  @IsString()
  name: string

  @IsString()
  @IsIn(['ANTHROPIC', 'OPENAI', 'GOOGLE'])
  provider: string

  @IsString()
  model: string

  @IsString()
  apiKey: string
}

export class UpdateCentralAiDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  @IsIn(['ANTHROPIC', 'OPENAI', 'GOOGLE'])
  provider?: string

  @IsString()
  @IsOptional()
  model?: string

  @IsString()
  @IsOptional()
  apiKey?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CentralAiService {
  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.centralAiConfig.findMany({
      where:   { tenantId: this.tenantId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(dto: CreateCentralAiDto) {
    return this.prisma.centralAiConfig.create({
      data: {
        tenantId: this.tenantId,
        name:     dto.name,
        provider: dto.provider,
        model:    dto.model,
        apiKey:   dto.apiKey,
        isActive: false,
      },
    })
  }

  async update(id: string, dto: UpdateCentralAiDto) {
    const existing = await this.prisma.centralAiConfig.findFirst({
      where: { id, tenantId: this.tenantId },
    })
    if (!existing) throw new NotFoundException('Configuração não encontrada')

    return this.prisma.centralAiConfig.update({
      where: { id },
      data:  {
        ...(dto.name     !== undefined && { name:     dto.name }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.model    !== undefined && { model:    dto.model }),
        // Só atualiza apiKey se não for placeholder
        ...(dto.apiKey !== undefined && dto.apiKey !== '***' && { apiKey: dto.apiKey }),
      },
    })
  }

  async remove(id: string) {
    const existing = await this.prisma.centralAiConfig.findFirst({
      where: { id, tenantId: this.tenantId },
    })
    if (!existing) throw new NotFoundException('Configuração não encontrada')
    return this.prisma.centralAiConfig.delete({ where: { id } })
  }

  /** Define qual config é a ativa — desativa todas as outras */
  async setActive(id: string) {
    const existing = await this.prisma.centralAiConfig.findFirst({
      where: { id, tenantId: this.tenantId },
    })
    if (!existing) throw new NotFoundException('Configuração não encontrada')

    await this.prisma.$transaction([
      this.prisma.centralAiConfig.updateMany({
        where: { tenantId: this.tenantId },
        data:  { isActive: false },
      }),
      this.prisma.centralAiConfig.update({
        where: { id },
        data:  { isActive: true },
      }),
    ])
    return this.prisma.centralAiConfig.findMany({
      where:   { tenantId: this.tenantId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
