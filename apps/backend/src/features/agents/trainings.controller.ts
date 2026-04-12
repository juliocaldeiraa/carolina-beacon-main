import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { IsString, IsOptional, IsIn } from 'class-validator'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { TrainingsService } from './trainings.service'

class CreateTrainingDto {
  @IsIn(['text', 'url', 'document'])
  type!: string

  @IsOptional() @IsString()
  title?: string

  @IsString()
  content!: string
}

@Controller('agents/:agentId/trainings')
@UseGuards(JwtGuard)
export class TrainingsController {
  constructor(private readonly trainings: TrainingsService) {}

  @Get()
  findAll(@Param('agentId') agentId: string) {
    return this.trainings.findByAgent(agentId)
  }

  @Post()
  create(@Param('agentId') agentId: string, @Body() dto: CreateTrainingDto) {
    return this.trainings.create(agentId, dto)
  }

  @Delete(':trainingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('agentId') agentId: string, @Param('trainingId') trainingId: string) {
    return this.trainings.remove(agentId, trainingId)
  }
}
