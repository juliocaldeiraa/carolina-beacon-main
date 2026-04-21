import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciais inválidas')
    }

    const payload = { sub: user.id, role: user.role, tenantId: user.tenantId }

    const accessToken = this.jwt.sign(payload)
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id:       user.id,
        email:    user.email,
        role:     user.role,
        tenantId: user.tenantId,
      },
    }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; role: string; tenantId: string }>(
        refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      )
      const newPayload = { sub: payload.sub, role: payload.role, tenantId: payload.tenantId }
      return { accessToken: this.jwt.sign(newPayload) }
    } catch {
      throw new UnauthorizedException('Refresh token inválido')
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
  }

  async listTenants(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    // Admin vê todos os tenants não deletados, outros veem só o deles
    if (user.role === 'ADMIN') {
      return this.prisma.tenant.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })
    }
    return this.prisma.tenant.findMany({ where: { id: user.tenantId, deletedAt: null } })
  }

  async switchTenant(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    // Admin pode trocar pra qualquer tenant
    if (user.role !== 'ADMIN') {
      if (user.tenantId !== tenantId) throw new UnauthorizedException('Sem permissão para este workspace')
    }
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } })
    if (!tenant) throw new NotFoundException('Workspace não encontrado')
    const payload = { sub: user.id, role: user.role, tenantId: tenant.id }
    return {
      accessToken: this.jwt.sign(payload),
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, niche: tenant.niche },
    }
  }

  async createTenant(name: string, slug: string, niche?: string) {
    const allowed = ['healthcare', 'launch', 'services', 'generic']
    const safeNiche = niche && allowed.includes(niche) ? niche : 'generic'
    return this.prisma.tenant.create({ data: { name, slug, niche: safeNiche } })
  }

  async deleteTenant(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.role !== 'ADMIN') throw new ForbiddenException('Apenas ADMIN pode excluir workspace')

    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } })
    if (!tenant) throw new NotFoundException('Workspace não encontrado')

    const active = await this.prisma.tenant.count({ where: { deletedAt: null } })
    if (active <= 1) throw new BadRequestException('Não é possível excluir o último workspace')

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { deletedAt: new Date() },
    })

    // Se o admin excluiu o próprio workspace ativo, retorna switch automático pro primeiro disponível
    let nextToken: string | null = null
    let nextTenant: { id: string; name: string; slug: string; niche: string } | null = null
    if (user.tenantId === tenantId) {
      const fallback = await this.prisma.tenant.findFirst({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      })
      if (fallback) {
        nextTenant = { id: fallback.id, name: fallback.name, slug: fallback.slug, niche: fallback.niche }
        const payload = { sub: user.id, role: user.role, tenantId: fallback.id }
        nextToken = this.jwt.sign(payload)
      }
    }

    return { deleted: true, accessToken: nextToken, tenant: nextTenant }
  }
}
