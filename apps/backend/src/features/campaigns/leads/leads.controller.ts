import {
  Controller, Get, Patch, Post, Delete,
  Body, Param, Query, Res, UseGuards, HttpCode, HttpStatus, Req,
  UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsOptional, IsString, IsNumberString } from 'class-validator'
import { Response } from 'express'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { LeadsService } from './leads.service'

class UpdateLeadDto {
  @IsOptional() @IsString() status?:       string
  @IsOptional() @IsString() kanbanColumn?: string
  @IsOptional() @IsString() notes?:        string
  @IsOptional() @IsString() nextActionAt?: string
  @IsOptional() @IsString() var1?: string
  @IsOptional() @IsString() var2?: string
  @IsOptional() @IsString() var3?: string
  @IsOptional() @IsString() var4?: string
  @IsOptional() @IsString() var5?: string
}

class CreateLeadDto {
  @IsString() phone!: string
  @IsOptional() @IsString() var1?: string
  @IsOptional() @IsString() var2?: string
  @IsOptional() @IsString() var3?: string
  @IsOptional() @IsString() var4?: string
  @IsOptional() @IsString() var5?: string
}

class ListLeadsQuery {
  @IsOptional() @IsString()       status?:       string
  @IsOptional() @IsString()       kanbanColumn?: string
  @IsOptional() @IsString()       search?:       string
  @IsOptional() @IsNumberString() page?:         string
  @IsOptional() @IsNumberString() limit?:        string
}

function tenantId(req: any): string {
  return req.user?.tenantId
}

@Controller('campaigns/:campaignId/leads')
@UseGuards(JwtGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get('template')
  downloadTemplate(@Res() res: Response) {
    const csv = 'telefone,var1,var2,var3,var4,var5\n5511999999999,Nome do contato,Empresa,,,'
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-contatos.csv"')
    res.send(csv)
  }

  @Post()
  createOne(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateLeadDto,
    @Req() req: any,
  ) {
    return this.leads.createOne(campaignId, tenantId(req), dto)
  }

  @Get()
  findAll(
    @Param('campaignId') campaignId: string,
    @Query() query: ListLeadsQuery,
    @Req() req: any,
  ) {
    return this.leads.findByCampaign(campaignId, tenantId(req), {
      status:       query.status,
      kanbanColumn: query.kanbanColumn,
      search:       query.search,
      page:         query.page  ? parseInt(query.page)  : undefined,
      limit:        query.limit ? parseInt(query.limit) : undefined,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.leads.findById(id, tenantId(req))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: any) {
    return this.leads.update(id, tenantId(req), dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancelLead(@Param('id') id: string, @Req() req: any) {
    return this.leads.cancelLead(id, tenantId(req))
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Req() req: any) {
    return this.leads.getMessages(id, tenantId(req))
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importLeads(
    @Param('campaignId') campaignId: string,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(csv|xls|xlsx|spreadsheet|excel|text\/plain)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.leads.importFile(campaignId, tenantId(req), file.buffer, file.mimetype, file.originalname)
  }
}
