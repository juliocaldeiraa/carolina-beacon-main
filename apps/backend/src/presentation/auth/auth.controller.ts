import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { AuthService } from '../../features/auth/auth.service'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { CurrentUserId } from '../../shared/decorators/tenant.decorator'

class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string
}

class RefreshDto {
  @IsString()
  refreshToken!: string
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  logout() {
    // Stateless JWT — invalidação via refresh token blacklist (Sprint 2+)
    return { message: 'Logout realizado com sucesso' }
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUserId() userId: string) {
    return this.authService.me(userId)
  }
}
