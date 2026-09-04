import { execFile } from 'node:child_process';
import path from 'path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function buildGraphifyCommand(rawQuery) {
  if (typeof rawQuery !== 'string' || !rawQuery.trim()) {
    throw new Error('Graphify query must be a non-empty string.');
  }
  return { command: 'graphify', args: ['query', rawQuery] };
}

async function runGraphify(command, args, options) {
  const { stdout } = await execFileAsync(command, args, options);
  return stdout;
}

/**
 * Execute Graphify as a Tool Adapter
 * @param {string} rawQuery 
 * @returns {Promise<import('../contracts.js').ToolResult>}
 */
export async function executeGraphifyAdapter(rawQuery, dependencies = {}) {
  try {
    const rootDir = path.resolve(process.cwd());
    const { command, args } = buildGraphifyCommand(rawQuery);
    const execute = dependencies.execute ?? runGraphify;
    const graphifyResult = await execute(command, args, {
      cwd: rootDir,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: dependencies.maxOutputBytes ?? 120_000,
    });
    
    const graphifyDump = `# Graphify Results\n\n> Query: \`${rawQuery}\`\n\n\`\`\`text\n${graphifyResult}\n\`\`\`\n`;
    return {
        status: 'ok',
        content: graphifyDump,
        sources: ['graphify'],
        trace: [{ correlationId: 'none', node: 'graphify-query', status: 'ok' }]
    };
  } catch (err) {
    return {
      status: 'failed',
      content: `Graphify failed: ${err.message}`,
      sources: [],
      trace: [{ correlationId: 'none', node: 'graphify-query', status: 'failed', code: 'GRAPHIFY_ERROR' }]
    };
  }
}
