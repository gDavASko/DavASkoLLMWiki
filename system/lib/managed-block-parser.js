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
    const beginMarker = `<!-- BEGIN ${blockName} (managed by sync-ai-rules - do not edit inside this block) -->`;
    const endMarker = `<!-- END ${blockName} -->`;
    const escapedBlockName = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const beginPattern = new RegExp(`^\\s*<!--\\s*BEGIN\\s+${escapedBlockName}(?:\\s*\\([^>]*\\))?\\s*-->\\s*$`);
    const endPattern = new RegExp(`^\\s*<!--\\s*END\\s+${escapedBlockName}(?:\\s*\\([^>]*\\))?\\s*-->\\s*$`);

    let inCodeBlock = false;
    let codeBlockFence = null;
    let currentBlockStart = -1;
    const blockRanges = [];

    const lines = markdownContent.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
        if (fenceMatch) {
            const fence = fenceMatch[2];
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockFence = fence;
            } else if (line.trim().startsWith(codeBlockFence)) {
                inCodeBlock = false;
                codeBlockFence = null;
            }
        }

        if (!inCodeBlock) {
            if (beginPattern.test(line) && currentBlockStart === -1) {
                currentBlockStart = i;
            } else if (endPattern.test(line) && currentBlockStart !== -1) {
                blockRanges.push({ start: currentBlockStart, end: i });
                currentBlockStart = -1;
            }
        }

        i++;
    }

    const blockText = `${beginMarker}\n${newBlockContent}\n${endMarker}`;

    if (blockRanges.length > 0) {
        const resultLines = [];
        let rangeIndex = 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const range = blockRanges[rangeIndex];
            if (range && lineIndex === range.start) {
                if (rangeIndex === 0) {
                    resultLines.push(...blockText.split('\n'));
                }

                lineIndex = range.end;
                rangeIndex++;
                continue;
            }

            resultLines.push(lines[lineIndex]);
        }

        return resultLines.join('\n');
    }

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
