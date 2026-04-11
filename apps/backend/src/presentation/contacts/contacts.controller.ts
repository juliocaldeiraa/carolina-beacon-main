import {
  Controller, Get, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common'
import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator'
import { ContactsService, ContactFilters } from '@/features/contacts/contacts.service'
import { JwtGuard }   from '@/shared/guards/jwt.guard'
import { RolesGuard } from '@/shared/guards/roles.guard'
import { Roles }      from '@/shared/decorators/roles.decorator'

class UpdateContactDto {
  @IsOptional() @IsString()  name?:  string
  @IsOptional() @IsEmail()   email?: string
  @IsOptional() @IsString()  notes?: string
  @IsOptional() @IsArray()   tags?:  string[]
}

@Controller('contacts')
@UseGuards(JwtGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  @Get()
  findAll(@Query() query: {
    search?:    string
    channelId?: string
    tag?:       string
    page?:      string
    limit?:     string
  }) {
    const filters: ContactFilters = {
      search:    query.search,
      channelId: query.channelId,
      tag:       query.tag,
      page:      query.page  ? parseInt(query.page)  : undefined,
      limit:     query.limit ? parseInt(query.limit) : undefined,
    }
    return this.svc.findAll(filters)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  @Patch(':id')
  @Roles('ADMIN', 'EQUIPE')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.svc.update(id, dto)
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
