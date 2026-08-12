import { execSync } from 'child_process';
import path from 'path';

/**
 * Execute Graphify as a Tool Adapter
 * @param {string} rawQuery 
 * @returns {Promise<import('../contracts.js').ToolResult>}
 */
export async function executeGraphifyAdapter(rawQuery) {
  try {
    const rootDir = path.resolve(process.cwd());
    const graphifyResult = execSync(`graphify query "${rawQuery.replace(/"/g, '\\"')}"`, { 
        cwd: rootDir, 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] 
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
