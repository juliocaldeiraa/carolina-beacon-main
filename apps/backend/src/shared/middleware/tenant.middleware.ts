/**
 * TenantMiddleware — Injeção de tenantId em todas as requisições
 *
 * Extrai o tenantId do JWT e disponibiliza em request.tenantId
 * Garante o isolamento multi-tenant (Pool Isolation — PRD)
 */

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { JwtService } from '@nestjs/jwt'

export interface RequestWithTenant extends Request {
  tenantId: string
  userId: string
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: RequestWithTenant, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido')
    }

    const token = authHeader.slice(7)

    try {
      const payload = this.jwtService.verify<{ sub: string; tenantId: string }>(token, {
        secret: process.env.JWT_SECRET,
      })
      req.tenantId = payload.tenantId
      req.userId = payload.sub
      next()
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado')
    }
  }
}
