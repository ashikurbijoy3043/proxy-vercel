const cheerio = require('cheerio');
const fs = require('fs');

function parseTutorial2() {
    const html = fs.readFileSync('C:/Users/joy16/.gemini/antigravity-ide/brain/b5ab299b-d593-4f22-b9c7-a98098b0440c/scratch/tutorial2.html', 'utf8');
    const $ = cheerio.load(html);

    console.log('--- Printing all buttons and links in tutorial2.html ---');
    $('a, button').each((i, el) => {
        console.log(`Tag: ${el.name}, text: "${$(el).text().trim()}", href: "${$(el).attr('href') || ''}"`);
    });

    console.log('\n--- Printing headings ---');
    $('h1, h2, h3, h4, h5, h6, .brand-title, .card-header-badge').each((i, el) => {
        console.log(`Heading: <${el.name}> - "${$(el).text().trim()}"`);
    });

    console.log('\n--- Printing all paragraph/instructions text ---');
    $('p, li, .timeline-desc, .warning-text').each((i, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) {
            console.log(`Text ${i + 1}: "${text.substring(0, 150)}"`);
        }
    });
}

parseTutorial2();
