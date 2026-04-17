import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { Roles } from '../../shared/decorators/roles.decorator'
import { UsersService, CreateUserDto, UpdateUserRoleDto } from '../../features/users/users.service'

@Controller('users')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user?.tenantId)
  }

  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.tenantId)
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @Req() req: any) {
    return this.svc.updateRole(id, dto, req.user?.tenantId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.svc.remove(id, req.user?.tenantId)
  }
}
