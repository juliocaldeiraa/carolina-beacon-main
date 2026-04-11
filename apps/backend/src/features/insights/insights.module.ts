import { Module }            from '@nestjs/common'
import { InsightsController } from '@/presentation/insights/insights.controller'
import { InsightsService }    from './insights.service'

@Module({
  controllers: [InsightsController],
  providers:   [InsightsService],
})
export class InsightsModule {}
