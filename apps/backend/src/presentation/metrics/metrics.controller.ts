import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common'
import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator'
import { MetricsService } from '../../features/metrics/metrics.service'
import { TelemetryService, LLMCallEvent } from '../../infrastructure/telemetry/telemetry.service'
import { JwtGuard } from '../../shared/guards/jwt.guard'

class TimeRangeQuery {
  @IsOptional()
  @IsString()
  agentId?: string

  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string

  @IsOptional()
  @IsEnum(['hour', 'day', 'week'])
  granularity?: 'hour' | 'day' | 'week'
}

class RecordMetricDto implements LLMCallEvent {
  @IsString() agentId!: string
  @IsOptional() @IsString() conversationId?: string
  @IsNumber() latencyMs!: number
  @IsOptional() @IsNumber() ttftMs?: number
  success!: boolean
  fallback!: boolean
  @IsNumber() inputTokens!: number
  @IsNumber() outputTokens!: number
  @IsString() model!: string
  @IsOptional() @IsNumber() sentimentScore?: number
  @IsOptional() @IsNumber() hallucinationScore?: number
  @IsOptional() @IsNumber() userRating?: number
  @IsOptional() @IsNumber() relevanceScore?: number
  @IsOptional() @IsNumber() turnsCount?: number
}

@Controller('metrics')
@UseGuards(JwtGuard)
export class MetricsController {
  constructor(
    private readonly svc: MetricsService,
    private readonly telemetry: TelemetryService,
  ) {}

  @Get('summary')
  summary(@Query() q: TimeRangeQuery) {
    return this.svc.getSummary({
      agentId: q.agentId,
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    })
  }

  @Get('agent')
  byAgent(@Query('agentId') agentId: string) {
    return this.svc.findByAgent(agentId)
  }

  @Get('timeseries')
  timeseries(@Query() q: TimeRangeQuery) {
    return this.svc.getTimeseries(
      {
        agentId: q.agentId,
        from: q.from ? new Date(q.from) : undefined,
        to:   q.to   ? new Date(q.to)   : undefined,
      },
      q.granularity ?? 'day',
    )
  }

  @Post()
  record(@Body() dto: RecordMetricDto) {
    return this.telemetry.recordLLMCall(dto)
  }
}
