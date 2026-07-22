/**
 * A lightweight state-machine parser to safely extract and replace 
 * HTML comment blocks in Markdown, ignoring anything inside code fences.
 */

/**
 * Safely replaces or appends a managed block inside a markdown file.
 * 
 * @param {string} markdownContent The original full content of the markdown file.
 * @param {string} blockName The name of the block, e.g., "DavASkoLLMWiki"
 * @param {string} newBlockContent The new content to inject inside the block.
 * @returns {string} The modified markdown content.
 */
export function mergeManagedBlock(markdownContent, blockName, newBlockContent) {
    const beginMarker = `<!-- BEGIN ${blockName} (managed by sync-ai-rules — do not edit inside this block) -->`;
    const endMarker = `<!-- END ${blockName} -->`;
    
    let inCodeBlock = false;
    let codeBlockFence = null;
    let blockStartIndex = -1;
    let blockEndIndex = -1;

    const lines = markdownContent.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        
        // Detect code fences
        const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
        if (fenceMatch) {
            const fence = fenceMatch[2];
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockFence = fence;
            } else if (inCodeBlock && line.trim().startsWith(codeBlockFence)) {
                inCodeBlock = false;
                codeBlockFence = null;
            }
        }

        if (!inCodeBlock) {
            if (line.includes(beginMarker) && blockStartIndex === -1) {
                blockStartIndex = i;
            } else if (line.includes(endMarker) && blockStartIndex !== -1) {
                blockEndIndex = i;
                break;
            }
        }
        i++;
    }

    const blockText = `${beginMarker}\n${newBlockContent}\n${endMarker}`;

    if (blockStartIndex !== -1 && blockEndIndex !== -1) {
        // Block exists, replace it
        const prefix = lines.slice(0, blockStartIndex).join('\n');
        const suffix = lines.slice(blockEndIndex + 1).join('\n');
        
        // Ensure we preserve leading/trailing newlines properly
        let result = prefix;
        if (prefix.length > 0 && !prefix.endsWith('\n')) result += '\n';
        result += blockText;
        if (suffix.length > 0 && !suffix.startsWith('\n')) result += '\n';
        result += suffix;
        return result;
    } else {
        // Block doesn't exist, append it at the end
        if (markdownContent.trim() === '') {
            return blockText;
        }
        let result = markdownContent;
        if (!result.endsWith('\n')) {
            result += '\n';
        }
        result += `\n${blockText}\n`;
        return result;
    }
}
