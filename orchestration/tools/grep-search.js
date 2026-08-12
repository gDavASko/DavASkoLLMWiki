import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

/**
 * Execute Grep search as a Tool Adapter
 * @param {string} rawQuery 
 * @param {import('../contracts.js').WorkflowLimits} limits 
 * @param {string} [correlationId='none']
 * @param {string[]} [locations=[]]
 * @returns {Promise<import('../contracts.js').ToolResult>}
 */
export async function executeGrepAdapter(rawQuery, limits = {}, correlationId = 'none', locations = []) {
  try {
    const safeQuery = rawQuery.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s_-]/g, ' ').trim();
    if (!safeQuery) {
      return {
        status: 'ok',
        content: 'No valid text to grep.',
        sources: [],
        trace: [{ correlationId, node: 'grep-search', status: 'ok', code: 'EMPTY_QUERY' }]
      };
    }

    let searchPaths = ROOT_DIR;
    if (locations && locations.length > 0) {
       searchPaths = locations.map(loc => {
           return path.isAbsolute(loc) ? loc : path.join(ROOT_DIR, loc);
       }).join(' ');
    }

    let output = '';
    try {
        const cmd = `git grep -i -I -C 2 "${safeQuery}" -- ${locations.length > 0 ? locations.join(' ') : '.'}`;
        output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
        if (e.stdout) output = e.stdout;
    }

    if (!output || output.trim().length === 0) {
      return {
        status: 'ok',
        content: `# GREP Context Dump\n\n> Query: \`${rawQuery}\`\n\n**Совпадений не найдено.**\n`,
        sources: [],
        trace: [{ correlationId, node: 'grep-search', status: 'ok', code: 'EMPTY_RESULT' }]
      };
    }

    const MAX_LEN = limits.maxToolOutputBytes || 120000;
    if (output.length > MAX_LEN) {
        output = output.substring(0, MAX_LEN) + '\n\n...[TRUNCATED]';
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
