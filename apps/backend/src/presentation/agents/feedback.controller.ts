import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { IsString, IsNumber } from 'class-validator'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { FeedbackService } from '@/features/agents/feedback.service'

class CreateFeedbackDto {
  @IsString()
  conversationId!: string

  @IsNumber()
  messageIndex!: number

  @IsString()
  feedbackText!: string
}

@Controller('agents/:agentId/feedbacks')
@UseGuards(JwtGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  findByAgent(@Param('agentId') agentId: string) {
    return this.feedbackService.findByAgent(agentId)
  }

  @Get('conversation/:conversationId')
  findByConversation(@Param('conversationId') conversationId: string) {
    return this.feedbackService.findByConversation(conversationId)
  }

  @Post()
  create(@Param('agentId') agentId: string, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create({ ...dto, agentId })
  }

  @Patch(':feedbackId/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(@Param('feedbackId') feedbackId: string) {
    return this.feedbackService.dismiss(feedbackId)
  }
}
