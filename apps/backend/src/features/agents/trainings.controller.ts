import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsString, IsOptional, IsIn, IsBoolean, IsNumber } from 'class-validator'
import { Transform } from 'class-transformer'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { TrainingsService } from './trainings.service'
import { TrainingProcessorService } from './training-processor.service'

class CreateTrainingDto {
  @IsIn(['text', 'url', 'document'])
  type!: string

  @IsOptional() @IsString()
  title?: string

  @IsString()
  content!: string

  @IsOptional() @IsIn(['faq', 'services', 'pricing', 'policies', 'scripts', 'general'])
  category?: string
}

class ProcessTextDto {
  @IsString()
  content!: string

  @IsOptional() @IsString()
  title?: string
}

class ProcessUrlDto {
  @IsString()
  url!: string

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  crawl?: boolean

  @IsOptional() @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  maxPages?: number
}

class UpdateTrainingDto {
  @IsOptional() @IsString()
  title?: string

  @IsOptional() @IsString()
  content?: string

  @IsOptional() @IsIn(['faq', 'services', 'pricing', 'policies', 'scripts', 'general', 'feedback'])
  category?: string
}

@Controller('agents/:agentId/trainings')
@UseGuards(JwtGuard)
export class TrainingsController {
  constructor(
    private readonly trainings: TrainingsService,
    private readonly processor: TrainingProcessorService,
  ) {}

  @Get()
  findAll(@Param('agentId') agentId: string) {
    return this.trainings.findByAgent(agentId)
  }

  @Post()
  create(@Param('agentId') agentId: string, @Body() dto: CreateTrainingDto) {
    return this.trainings.create(agentId, dto)
  }

  @Patch(':trainingId')
  update(
    @Param('agentId') agentId: string,
    @Param('trainingId') trainingId: string,
    @Body() dto: UpdateTrainingDto,
  ) {
    return this.trainings.update(agentId, trainingId, dto)
  }

  @Delete(':trainingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('agentId') agentId: string, @Param('trainingId') trainingId: string) {
    return this.trainings.remove(agentId, trainingId)
  }

  // ── Processamento com IA ──

  @Post('process-text')
  async processText(@Param('agentId') agentId: string, @Body() dto: ProcessTextDto) {
    await this.processor.processText(agentId, dto.content, dto.title)
    return { message: 'Processamento iniciado' }
  }

  @Post('process-url')
  async processUrl(@Param('agentId') agentId: string, @Body() dto: ProcessUrlDto) {
    await this.processor.processUrl(agentId, dto.url, dto.crawl ?? false, dto.maxPages ?? 5)
    return { message: 'Importação iniciada' }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('agentId') agentId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(pdf|markdown|md|docx|vnd\.openxmlformats)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.processor.processDocument(agentId, file.buffer, file.originalname, file.mimetype)
    return { message: 'Documento em processamento' }
  }
}
