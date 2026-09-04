import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const execFileAsync = promisify(execFile);

function maxOutputBytes(value) {
  return Number.isInteger(value) && value > 0 ? value : 120_000;
}

export function resolveSearchLocations(locations = []) {
  return locations.map((location) => {
    if (typeof location !== 'string' || !location.trim()) {
      throw new Error('Search location must be a non-empty string.');
    }
    const absolute = path.resolve(ROOT_DIR, location);
    const relative = path.relative(ROOT_DIR, absolute);
    if (relative === '' || relative === '.') return '.';
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(absolute)) {
      throw new Error(`Search location is outside the knowledge-base root or does not exist: ${location}`);
    }
    return relative;
  });
}

export function buildGrepCommand(query, locations = []) {
  const paths = locations.length > 0 ? resolveSearchLocations(locations) : ['.'];
  return { command: 'git', args: ['grep', '-i', '-I', '-C', '2', '-e', query, '--', ...paths] };
}

async function runGrep(command, args, options) {
  const { stdout } = await execFileAsync(command, args, options);
  return stdout;
}

/**
 * Execute Grep search as a Tool Adapter
 * @param {string} rawQuery 
 * @param {import('../contracts.js').WorkflowLimits} limits 
 * @param {string} [correlationId='none']
 * @param {string[]} [locations=[]]
 * @returns {Promise<import('../contracts.js').ToolResult>}
 */
export async function executeGrepAdapter(rawQuery, limits = {}, correlationId = 'none', locations = [], dependencies = {}) {
  try {
    const safeQuery = rawQuery.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!safeQuery) {
      return {
        status: 'ok',
        content: 'No valid text to grep.',
        sources: [],
        trace: [{ correlationId, node: 'grep-search', status: 'ok', code: 'EMPTY_QUERY' }]
      };
    }

    let output = '';
    const outputLimit = maxOutputBytes(limits.maxToolOutputBytes);
    try {
        const { command, args } = buildGrepCommand(safeQuery, locations);
        const execute = dependencies.execute ?? runGrep;
        output = await execute(command, args, {
          cwd: ROOT_DIR,
          encoding: 'utf8',
          windowsHide: true,
          maxBuffer: outputLimit,
        });
    } catch (e) {
        if (e?.stdout) output = String(e.stdout);
        else throw e;
    }

    if (!output || output.trim().length === 0) {
      return {
        status: 'ok',
        content: `# GREP Context Dump\n\n> Query: \`${rawQuery}\`\n\n**Совпадений не найдено.**\n`,
        sources: [],
        trace: [{ correlationId, node: 'grep-search', status: 'ok', code: 'EMPTY_RESULT' }]
      };
    }

    if (Buffer.byteLength(output, 'utf8') > outputLimit) {
        output = Buffer.from(output, 'utf8').subarray(0, outputLimit).toString('utf8') + '\n\n...[TRUNCATED]';
    }

    const dump = `# GREP Context Dump\n\n> Query: \`${rawQuery}\`\n\n\`\`\`text\n${output}\n\`\`\`\n`;

    return {
      status: 'ok',
      content: dump,
      sources: ['grep_search'],
      trace: [{ correlationId, node: 'grep-search', status: 'ok', code: 'FOUND' }]
    };
  } catch (err) {
    return {
      status: 'failed',
      content: `GREP Execution Failed: ${err.message}`,
      sources: [],
      trace: [{ correlationId, node: 'grep-search', status: 'failed', code: err.message }]
    };
  }
}
