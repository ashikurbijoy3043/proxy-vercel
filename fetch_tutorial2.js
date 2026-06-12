const https = require('https');
const fs = require('fs');

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: data
            }));
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        const cookie = 'PHPSESSID=j5bm2ij4tvdom3kjt3ai73qk44'; // Use a valid session from earlier or any session

        const options = {
            hostname: 'proxy.xsteam.store',
            path: '/tutorial2.html?v=1781265404',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                'Cookie': cookie
            }
        };

        const res = await makeRequest(options);
        console.log('Status:', res.status);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        fs.writeFileSync('C:/Users/joy16/.gemini/antigravity-ide/brain/b5ab299b-d593-4f22-b9c7-a98098b0440c/scratch/tutorial2.html', res.body);
        console.log('Saved tutorial2.html to scratch/tutorial2.html');

    } catch (err) {
        console.error('Error fetching tutorial2.html:', err);
    }
}

run();
