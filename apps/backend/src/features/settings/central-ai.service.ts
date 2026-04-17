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
  private get defaultTenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId?: string) {
    return this.prisma.centralAiConfig.findMany({
      where:   { tenantId: tenantId ?? this.defaultTenantId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(dto: CreateCentralAiDto, tenantId?: string) {
    return this.prisma.centralAiConfig.create({
      data: {
        tenantId: tenantId ?? this.defaultTenantId,
        name:     dto.name,
        provider: dto.provider,
        model:    dto.model,
        apiKey:   dto.apiKey,
        isActive: false,
      },
    })
  }

  async update(id: string, dto: UpdateCentralAiDto, tenantId?: string) {
    const tid = tenantId ?? this.defaultTenantId
    const existing = await this.prisma.centralAiConfig.findFirst({
      where: { id, tenantId: tid },
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

  async remove(id: string, tenantId?: string) {
    const existing = await this.prisma.centralAiConfig.findFirst({
      where: { id, tenantId: tenantId ?? this.defaultTenantId },
    })
    if (!existing) throw new NotFoundException('Configuração não encontrada')
    return this.prisma.centralAiConfig.delete({ where: { id } })
  }

  /** Define qual config é a ativa — desativa todas as outras */
  async setActive(id: string, tenantId?: string) {
    const tid = tenantId ?? this.defaultTenantId
    const existing = await this.prisma.centralAiConfig.findFirst({
      where: { id, tenantId: tid },
    })
    if (!existing) throw new NotFoundException('Configuração não encontrada')

    await this.prisma.$transaction([
      this.prisma.centralAiConfig.updateMany({
        where: { tenantId: tid },
        data:  { isActive: false },
      }),
      this.prisma.centralAiConfig.update({
        where: { id },
        data:  { isActive: true },
      }),
    ])
    return this.prisma.centralAiConfig.findMany({
      where:   { tenantId: tid },
      orderBy: { createdAt: 'asc' },
    })
  }
}
