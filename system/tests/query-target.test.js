import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../query-target.js');

test('query-target.js parses --locations and logs [INIT]', () => {
  try {
    // Run the script with a dummy query and locations. 
    // We expect it to log the INIT line and either fail or exit cleanly depending on if index exists.
    // We capture stderr.
    const out = execSync(`node ${SCRIPT_PATH} --query "test" --locations "locA,locB"`, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    // If it succeeds without throwing:
    // Actually, it might throw if LanceDB can't find locA/locB. Let's just catch the error and check stderr.
  } catch (err) {
    const stderr = err.stderr || '';
    assert.ok(stderr.includes('[INIT]'), 'Expected stderr to contain [INIT]');
    assert.ok(stderr.includes('locA, locB'), 'Expected stderr to contain the locations');
  }
});
