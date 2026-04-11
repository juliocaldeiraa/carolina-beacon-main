import { Module } from '@nestjs/common'
import { MetricsController } from '../../presentation/metrics/metrics.controller'
import { MetricsService } from './metrics.service'
import { MetricRepository } from '../../infrastructure/database/repositories/metric.repository'
import { METRIC_REPOSITORY } from '../../core/repositories/IMetricRepository'
import { TelemetryService } from '../../infrastructure/telemetry/telemetry.service'

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    TelemetryService,
    { provide: METRIC_REPOSITORY, useClass: MetricRepository },
  ],
  exports: [MetricsService, TelemetryService],
})
export class MetricsModule {}
