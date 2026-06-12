const cheerio = require('cheerio');
const fs = require('fs');

function testParse() {
    const html = fs.readFileSync('C:/Users/joy16/.gemini/antigravity-ide/brain/b5ab299b-d593-4f22-b9c7-a98098b0440c/scratch/tutorial2.html', 'utf8');
    const $ = cheerio.load(html);

    const nodes = [];
    $('.node-box').each((i, el) => {
        const name = $(el).find('.node-name').text().trim();
        const status = $(el).find('.status-badge').text().trim();
        const host = $(el).find('.detail-item').eq(0).find('.detail-val').text().trim();
        const port = $(el).find('.detail-item').eq(1).find('.detail-val').text().trim();
        nodes.push({ name, status, host, port });
    });

    console.log('Parsed Nodes:', JSON.stringify(nodes, null, 2));

    const sslDownloadHref = $('a[href*="pem"]').attr('href');
    console.log('SSL Href:', sslDownloadHref);

    const annImage = $('#announcementModal img').attr('src');
    const annTitle = $('#announcementModal h2').text().trim();
    const annDesc = $('#announcementModal p').text().trim();
    
    console.log('Announcement:', { annImage, annTitle, annDesc });
}

testParse();
