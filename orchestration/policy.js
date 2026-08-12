/**
 * @file orchestration/policy.js
 * Security capabilities matrix and Prompt Injection defense module.
 * Enforces read-only tool boundaries and mandatory XML document encapsulation (<document>...</document>).
 */

export const CAPABILITY_MATRIX = {
  query: {
    allowedTools: ['rag-search', 'graphify-query', 'wiki-index'],
    readOnly: true,
    mutatingAllowed: false
  },
  research: {
    allowedTools: ['rag-search', 'layer-reader', 'wiki-index', 'validation'],
    readOnly: true,
    mutatingAllowed: false
  },
  diagnostics: {
    allowedTools: ['wiki-index', 'validation'],
    readOnly: true,
    mutatingAllowed: false
  },
  admin: {
    allowedTools: ['wiki-index', 'validation'],
    readOnly: false,
    mutatingAllowed: true
  }
};

/**
 * Validates if an operation or tool is allowed under the read-only policy matrix.
 * @param {string} role 
 * @param {string} toolName 
 * @returns {boolean}
 */
export function checkCapability(role, toolName) {
  const policy = CAPABILITY_MATRIX[role] || CAPABILITY_MATRIX.query;
  if (policy.readOnly && policy.allowedTools.length > 0 && !policy.allowedTools.includes(toolName)) {
    throw new Error(`Policy Violation: Tool '${toolName}' is not allowed for role '${role}'`);
  }
  return true;
}

/**
 * Strictly wraps extracted Wiki document content in <document> XML tags to guard against Prompt Injection.
 * @param {string} docId 
 * @param {string} content 
 * @param {Object} [metadata={}]
 * @returns {string}
 */
export function wrapDocumentXml(docId, content, metadata = {}) {
  const metaAttrs = Object.entries(metadata)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ');

  const attrString = metaAttrs ? ` id="${docId}" ${metaAttrs}` : ` id="${docId}"`;
  const safeContent = (content || '').replace(/<\/document>/gi, '&lt;/document&gt;');

  return `<document${attrString}>\n${safeContent}\n</document>`;
}

/**
 * Enforces Prompt Injection defense by escaping closing document tags in raw text.
 * @param {string} text 
 * @returns {string}
 */
export function sanitizeDocumentContent(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/<\/document>/gi, '&lt;/document&gt;');
}