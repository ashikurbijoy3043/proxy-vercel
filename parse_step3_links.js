const cheerio = require('cheerio');
const fs = require('fs');

function parseStep3Links() {
    const html = fs.readFileSync('C:/Users/joy16/.gemini/antigravity-ide/brain/b5ab299b-d593-4f22-b9c7-a98098b0440c/scratch/step3.html', 'utf8');
    const $ = cheerio.load(html);

    console.log('--- Printing all buttons and links in Step 3 ---');
    $('a, button').each((i, el) => {
        console.log(`Tag: ${el.name}, text: "${$(el).text().trim()}", href: "${$(el).attr('href') || ''}", name: "${$(el).attr('name') || ''}"`);
    });

    console.log('\n--- Printing all container elements and headings ---');
    $('h1, h2, h3, h4, h5, h6, .brand-title, .card-header-badge').each((i, el) => {
        console.log(`Heading/Badge ${i + 1}: <${el.name}> - "${$(el).text().trim()}"`);
    });

    console.log('\n--- Printing tab buttons inside cyber-tabs-nav ---');
    $('.cyber-tabs-nav button').each((i, el) => {
        console.log(`Tab Button ${i + 1}: text="${$(el).text().trim()}", id="${$(el).attr('id') || ''}"`);
    });
}

parseStep3Links();
