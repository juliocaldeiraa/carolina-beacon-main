import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'

// Hierarquia: ADMIN > EQUIPE > SUPORTE/COMERCIAL (mesmo nível)
const ROLE_LEVEL: Record<string, number> = {
  ADMIN:     4,
  EQUIPE:    3,
  SUPORTE:   2,
  COMERCIAL: 2,
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Sem decorator @Roles → público para qualquer JWT válido
    if (!required || required.length === 0) return true

    const { user } = context.switchToHttp().getRequest()
    if (!user?.role) throw new ForbiddenException('Acesso negado')

    // ADMIN tem acesso a tudo
    if (user.role === 'ADMIN') return true

    const hasAccess = required.some((r) => user.role === r)
    if (!hasAccess) throw new ForbiddenException('Permissão insuficiente')
    return true
  }
}
