const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

// ============================================================================
// Парсер структуры Google Doc (ГДД) для генератора задач.
// Согласно dev-task-pattern.md, скрипт вытягивает заголовки (headingId)
// и собирает индекс для формирования точных deep-link ссылок.
// ============================================================================

const DOC_ID = process.argv[2];
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'credentials.json');
const OUTPUT_DIR = process.argv[3] || process.cwd();

if (!DOC_ID) {
    console.error('Usage: node fetch-gdd-structure.js <DOC_ID> [OUTPUT_DIR]');
    console.error('Ensure credentials.json is in the same directory or GOOGLE_APPLICATION_CREDENTIALS is set.');
    process.exit(1);
}

async function fetchAndParseGDD() {
    try {
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            throw new Error(`Credentials file not found at: ${CREDENTIALS_PATH}`);
        }

        // 1. Авторизация через Service Account
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/documents.readonly'],
        });

        const docs = google.docs({ version: 'v1', auth });

        console.log(`Fetching Google Doc structure for ID: ${DOC_ID}...`);
        
        // 2. Получение полного JSON дерева документа
        const res = await docs.documents.get({
            documentId: DOC_ID,
        });

        const document = res.data;
        const content = document.body.content;

        const anchorsIndex = {};
        const imagesManifest = [];
        let currentHeading = "Start of Document";

        console.log('Parsing document structure...');

        // 3. Обход массива элементов
        for (const element of content) {
            if (element.paragraph) {
                const style = element.paragraph.paragraphStyle;
                
                // Проверяем, является ли абзац заголовком
                if (style && style.namedStyleType && style.namedStyleType.startsWith('HEADING')) {
                    const headingId = style.headingId;
                    
                    // Извлекаем чистый текст заголовка
                    let text = '';
                    if (element.paragraph.elements) {
                        for (const el of element.paragraph.elements) {
                            if (el.textRun && el.textRun.content) {
                                text += el.textRun.content;
                            }
                        }
                    }
                    
                    text = text.trim();
                    if (text && headingId) {
                        anchorsIndex[text] = headingId;
                        currentHeading = text;
                    }
                }

                // Сбор манифеста картинок (если картинки встроены в текст)
                if (element.paragraph.elements) {
                    for (const el of element.paragraph.elements) {
                        if (el.inlineObjectElement) {
                            const objectId = el.inlineObjectElement.inlineObjectId;
                            imagesManifest.push({
                                image_id: objectId,
                                section_heading: currentHeading,
                                // В реальной логике здесь также можно вытягивать caption, 
                                // если он идет следующим абзацем.
                            });
                        }
                    }
                }
            }
        }

        // 4. Сохранение артефактов на диск
        const anchorsPath = path.join(OUTPUT_DIR, `${DOC_ID}_anchors.json`);
        const manifestPath = path.join(OUTPUT_DIR, `${DOC_ID}_images.json`);

        fs.writeFileSync(anchorsPath, JSON.stringify(anchorsIndex, null, 2), 'utf8');
        fs.writeFileSync(manifestPath, JSON.stringify(imagesManifest, null, 2), 'utf8');

        console.log(`\n✅ Success! Parse complete.`);
        console.log(`Found ${Object.keys(anchorsIndex).length} headings.`);
        console.log(`Found ${imagesManifest.length} images.`);
        console.log(`Saved anchors to: ${anchorsPath}`);
        console.log(`Saved image manifest to: ${manifestPath}`);

    } catch (error) {
        console.error('❌ Error fetching document:', error.message);
        if (error.response && error.response.status === 403) {
            console.error('Make sure the Service Account email is added as a "Viewer" to the Google Doc.');
        }
    }
}

fetchAndParseGDD();
