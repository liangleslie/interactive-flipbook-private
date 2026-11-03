#!/usr/bin/env node
// Single root test runner entrypoint.
// Run all tests:  uv run node test.mjs
// Run single test: uv run node test.mjs <name>
import { readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = resolve(__dirname, 'test');

if (!existsSync(TEST_DIR)) {
  console.error('❌ Test directory not found:', TEST_DIR);
  process.exit(1);
}

const testFiles = readdirSync(TEST_DIR)
  .filter(f => f.startsWith('test-') && f.endsWith('.mjs'))
  .sort();

const args = process.argv.slice(2);
const filter = args.find(a => !a.startsWith('-'))?.toLowerCase();

if (args.includes('--list') || args.includes('-l')) {
  console.log('Available tests in test/:');
  testFiles.forEach(f => console.log(`  - ${f}`));
  process.exit(0);
}

const targets = filter
  ? testFiles.filter(f => f.toLowerCase().includes(filter))
  : testFiles;

if (targets.length === 0) {
  console.error(`❌ No test matching "${filter}". Available tests:`);
  testFiles.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(`🧪 Running ${targets.length} test(s)...`);

let failed = 0;
for (const file of targets) {
  const filePath = join(TEST_DIR, file);
  console.log(`\n▶ [${file}] Starting...`);
  const code = await new Promise((res) => {
    const child = spawn(process.execPath, [filePath], {
      stdio: 'inherit',
      cwd: __dirname,
    });
    child.on('close', res);
  });

  if (code === 0) {
    console.log(`✓ [${file}] Passed`);
  } else {
    console.error(`❌ [${file}] Failed (exit code ${code})`);
    failed++;
  }
}

console.log('\n==============================');
if (failed > 0) {
  console.error(`❌ Test Suite: ${failed} of ${targets.length} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`✅ Test Suite: All ${targets.length} test(s) passed.`);
  process.exit(0);
}

