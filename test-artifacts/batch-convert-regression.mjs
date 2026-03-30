import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');
const samplePath = path.join(__dirname, 'red.png');

async function waitForServer(baseUrl, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become ready in time');
}

test('batch conversion accepts frontend field name and returns frontend-friendly payload', async () => {
  const port = 3101;
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: appDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  server.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  server.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  try {
    await waitForServer(baseUrl);

    const imageBuffer = await fs.readFile(samplePath);
    const form = new FormData();
    form.append('files', new Blob([imageBuffer], { type: 'image/png' }), 'red.png');
    form.append('targetFormat', 'jpg');

    const response = await fetch(`${baseUrl}/api/convert/batch`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form
    });

    assert.equal(response.status, 200, logs.join(''));

    const json = await response.json();
    assert.ok(Array.isArray(json.convertedUrls), 'convertedUrls should be an array');
    assert.equal(json.convertedUrls.length, 1);
    assert.ok(Array.isArray(json.files), 'files should be an array');
    assert.equal(json.files.length, 1);
    assert.equal(json.files[0].originalName, 'red.png');
    assert.match(json.files[0].convertedName, /^red-.*\.jpg$/);
    assert.equal(json.files[0].downloadUrl, json.convertedUrls[0]);
  } finally {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
});
