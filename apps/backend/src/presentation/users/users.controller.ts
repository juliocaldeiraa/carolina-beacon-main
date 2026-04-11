import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
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
  findAll() {
    return this.svc.findAll()
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.svc.create(dto)
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.svc.updateRole(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
