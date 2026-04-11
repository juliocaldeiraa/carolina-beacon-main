import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service'

export interface CreateUserDto {
  email: string
  password: string
  role: 'ADMIN' | 'EQUIPE' | 'SUPORTE' | 'COMERCIAL'
}

export interface UpdateUserRoleDto {
  role: 'ADMIN' | 'EQUIPE' | 'SUPORTE' | 'COMERCIAL'
}

@Injectable()
export class UsersService {
  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { createdAt: 'asc' },
    })
    return users.map((u) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt }))
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email já cadastrado')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = await this.prisma.user.create({
      data: {
        tenantId:     this.tenantId,
        email:        dto.email,
        passwordHash,
        role:         dto.role,
      },
    })
    return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt }
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId: this.tenantId } })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    const updated = await this.prisma.user.update({
      where: { id },
      data:  { role: dto.role },
    })
    return { id: updated.id, email: updated.email, role: updated.role }
  }

  async remove(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId: this.tenantId } })
    if (!user) throw new NotFoundException('Usuário não encontrado')
    await this.prisma.user.delete({ where: { id } })
  }
}
