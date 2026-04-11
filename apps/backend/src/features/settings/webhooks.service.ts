import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import * as https from 'https'
import * as http from 'http'

export interface CreateWebhookDto {
  name: string
  url: string
  events: string[]
  secret?: string
}

export interface UpdateWebhookDto {
  name?: string
  url?: string
  events?: string[]
  secret?: string
  isActive?: boolean
}

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'asc' } })
  }

  async create(dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
      },
    })
  }

  async update(id: string, dto: UpdateWebhookDto) {
    const existing = await this.prisma.webhook.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Webhook não encontrado')

    return this.prisma.webhook.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.secret !== undefined && { secret: dto.secret }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }

  async remove(id: string) {
    const existing = await this.prisma.webhook.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Webhook não encontrado')
    await this.prisma.webhook.delete({ where: { id } })
    return { message: 'Webhook removido' }
  }

  async test(id: string): Promise<{ status: number; ok: boolean; message: string }> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } })
    if (!webhook) throw new NotFoundException('Webhook não encontrado')

    const payload = JSON.stringify({
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Beacon webhook test ping' },
    })

    return new Promise((resolve) => {
      const url = new URL(webhook.url)
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Beacon-Event': 'webhook.test',
        },
        timeout: 8000,
      }

      const lib = url.protocol === 'https:' ? https : http
      const req = lib.request(options, (res) => {
        resolve({ status: res.statusCode ?? 0, ok: (res.statusCode ?? 0) < 400, message: `HTTP ${res.statusCode}` })
      })

      req.on('error', (err) => resolve({ status: 0, ok: false, message: err.message }))
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, message: 'Timeout' }) })
      req.write(payload)
      req.end()
    })
  }
}
