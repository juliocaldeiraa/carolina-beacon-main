import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

interface JwtPayload {
  sub: string
  role: string
  tenantId: string
  campaignId?: string // presente apenas em tokens de acesso compartilhado (role SHARED)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
      campaignId: payload.campaignId,
    }
  }
}
