import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  increment(name: string, labels: Record<string, string | number | boolean | undefined> = {}, value = 1): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  renderPrometheus(): string {
    return [...this.counters.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key} ${value}`)
      .join('\n');
  }
}

function metricKey(name: string, labels: Record<string, string | number | boolean | undefined>): string {
  const cleanName = name.replace(/[^a-zA-Z0-9_:]/g, '_');
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return cleanName;
  }
  const rendered = entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key.replace(/[^a-zA-Z0-9_]/g, '_')}="${String(value).replace(/"/g, '\\"')}"`)
    .join(',');
  return `${cleanName}{${rendered}}`;
}
