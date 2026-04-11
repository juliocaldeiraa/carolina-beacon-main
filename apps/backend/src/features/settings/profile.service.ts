import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import * as bcrypt from 'bcryptjs'

export interface UpdateProfileDto {
  name?: string
}

export interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')
    return user
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash)
    if (!valid) throw new BadRequestException('Senha atual incorreta')

    if (dto.newPassword.length < 6) {
      throw new BadRequestException('A nova senha deve ter pelo menos 6 caracteres')
    }

    const hash = await bcrypt.hash(dto.newPassword, 10)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    })
    return { message: 'Senha alterada com sucesso' }
  }
}
