import fs from 'fs';
import path from 'path';

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

/**
 * Reads a file as UTF-8 and safely strips the BOM if present.
 * @param {string} filePath 
 * @returns {string} The file content without BOM
 */
export function readSafe(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length >= 3 && buffer[0] === BOM[0] && buffer[1] === BOM[1] && buffer[2] === BOM[2]) {
        return buffer.toString('utf8', 3);
    }
    return buffer.toString('utf8');
}

/**
 * Writes a string to a file as UTF-8. 
 * If isMarkdown is true, a BOM is prepended to the file.
 * Creates parent directories if they do not exist.
 * @param {string} filePath 
 * @param {string} content 
 * @param {boolean} isMarkdown 
 */
export function writeSafe(filePath, content, isMarkdown = false) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    
    // Explicitly add BOM if it is a markdown file
    if (isMarkdown || filePath.endsWith('.md')) {
        const contentBuffer = Buffer.from(content, 'utf8');
        const fileBuffer = Buffer.concat([BOM, contentBuffer]);
        fs.writeFileSync(filePath, fileBuffer);
    } else {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

/**
 * Copies a text file by reading it with readSafe and writing it with writeSafe.
 * This guarantees the output file has the correct BOM status.
 * @param {string} srcPath 
 * @param {string} destPath 
 * @param {boolean} isMarkdown 
 */
export function copyTextSafe(srcPath, destPath, isMarkdown = false) {
    const content = readSafe(srcPath);
    writeSafe(destPath, content, isMarkdown);
}
