import { Controller, Get, Header, Optional } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
  constructor(
    private readonly metrics: MetricsService,
    @Optional() private readonly dataSource?: DataSource
  ) {}

  @Public()
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  async ready() {
    if (!this.dataSource) {
      return { status: 'degraded', database: 'not_configured' };
    }
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'ok' };
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metricsText() {
    return this.metrics.renderPrometheus();
  }
}
