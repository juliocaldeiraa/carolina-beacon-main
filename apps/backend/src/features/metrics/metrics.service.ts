import { Injectable, Inject } from '@nestjs/common'
import { IMetricRepository, MetricFilters, METRIC_REPOSITORY } from '../../core/repositories/IMetricRepository'
import { Metric } from '../../core/entities/Metric'

@Injectable()
export class MetricsService {
  constructor(
    @Inject(METRIC_REPOSITORY) private readonly repo: IMetricRepository,
  ) {}

  /** Registra uma métrica de conversa (chamado pelo pipeline OTEL) */
  record(data: Omit<Metric, 'id' | 'recordedAt'>): Promise<Metric> {
    return this.repo.create(data)
  }

  /** Resumo agregado por tenant/agente/período */
  getSummary(filters: MetricFilters) {
    return this.repo.getSummary(filters)
  }

  /** Métricas por agente (lista raw) */
  findByAgent(agentId: string, tenantId: string) {
    return this.repo.findByAgent(agentId, tenantId)
  }

  /** Série temporal para gráficos */
  getTimeseries(filters: MetricFilters, granularity: 'hour' | 'day' | 'week') {
    return this.repo.getTimeseries(filters, granularity)
  }
}
