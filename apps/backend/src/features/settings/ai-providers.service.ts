import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface CreateAiProviderDto {
  name: string
  type: string
  apiKey: string
  baseUrl?: string
}

export interface UpdateAiProviderDto {
  name?: string
  apiKey?: string
  baseUrl?: string
  isActive?: boolean
}

function maskKey(key: string): string {
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

@Injectable()
export class AiProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const providers = await this.prisma.aiProvider.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return providers.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) }))
  }

  async create(dto: CreateAiProviderDto) {
    const provider = await this.prisma.aiProvider.create({
      data: {
        name: dto.name,
        type: dto.type,
        apiKey: dto.apiKey,
        baseUrl: dto.baseUrl,
      },
    })
    return { ...provider, apiKey: maskKey(provider.apiKey) }
  }

  async update(id: string, dto: UpdateAiProviderDto) {
    const existing = await this.prisma.aiProvider.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Provedor não encontrado')

    const provider = await this.prisma.aiProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.apiKey !== undefined && { apiKey: dto.apiKey }),
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
    return { ...provider, apiKey: maskKey(provider.apiKey) }
  }

  async remove(id: string) {
    const existing = await this.prisma.aiProvider.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Provedor não encontrado')
    await this.prisma.aiProvider.delete({ where: { id } })
    return { message: 'Provedor removido' }
  }
}
