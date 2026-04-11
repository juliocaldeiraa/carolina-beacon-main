import { Injectable, UnauthorizedException } from '@nestjs/common'
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

    const payload = { sub: user.id, role: user.role }

    const accessToken = this.jwt.sign(payload)
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id:    user.id,
        email: user.email,
        role:  user.role,
      },
    }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; role: string }>(
        refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      )
      const newPayload = { sub: payload.sub, role: payload.role }
      return { accessToken: this.jwt.sign(newPayload) }
    } catch {
      throw new UnauthorizedException('Refresh token inválido')
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return { id: user.id, email: user.email, role: user.role }
  }
}
