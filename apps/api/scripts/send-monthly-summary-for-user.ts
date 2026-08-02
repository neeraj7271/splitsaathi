import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { loadEnvFile } from '../src/config/load-env-file';
import { MonthlySummaryMailService } from '../src/modules/jobs/monthly-summary-mail.service';

async function main() {
  loadEnvFile(resolve(__dirname, '../.env'));
  const email = process.argv[2]?.trim().toLowerCase() || 'neerajsuman766@gmail.com';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log']
  });

  try {
    const service = app.get(MonthlySummaryMailService);
    const result = await service.sendForUserEmail(email);
    console.log(JSON.stringify(result, null, 2));
    if (result.emailsSent === 0) {
      console.warn(`No emails sent for ${email}. Check group membership and balances.`);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
