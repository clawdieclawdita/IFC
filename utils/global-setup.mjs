import fs from 'fs/promises';
import path from 'path';
import { request } from '@playwright/test';
import { generateTestAssets } from './generate-test-assets.mjs';

export default async function globalSetup() {
  await generateTestAssets();
  await fs.mkdir(path.resolve(process.cwd(), 'artifacts', 'screenshots'), { recursive: true });
  await fs.mkdir(path.resolve(process.cwd(), 'artifacts', 'downloads'), { recursive: true });

  const context = await request.newContext();
  const response = await context.get('http://192.168.1.200:4444/health');
  if (!response.ok()) {
    throw new Error(`App health check failed with status ${response.status()}`);
  }
  await context.dispose();
}
