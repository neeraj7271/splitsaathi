/**
 * PM2 process file for SplitSaathi API.
 * Run from the monorepo root:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'splitsaathi-api',
      cwd: repoRoot,
      script: 'apps/api/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      // Loads apps/api/.env via dotenv in main.ts; also merge process env here.
      env: {
        NODE_ENV: 'production'
      },
      error_file: path.join(repoRoot, 'deploy', 'logs', 'api-error.log'),
      out_file: path.join(repoRoot, 'deploy', 'logs', 'api-out.log'),
      time: true
    }
  ]
};
