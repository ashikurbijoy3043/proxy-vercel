const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Helper to translate Thai error messages to English
function translateErrorMessage(msg) {
    if (!msg) return msg;
    const lower = msg.toLowerCase();
    if (lower.includes('เครื่องไม่ตรงกัน') || lower.includes('ผูกกับเครื่องอื่น')) {
        return 'Device mismatch: This key is already bound to another device.';
    }
    if (lower.includes('คีย์ไม่ถูกต้อง') || lower.includes('รหัสไม่ถูกต้อง')) {
        return 'Invalid license key. Please check and try again.';
    }
    if (lower.includes('หมดอายุ')) {
        return 'This license key has expired.';
    }
    if (lower.includes('ไม่พบ')) {
        return 'License key not found.';
    }
    if (/[\u0e00-\u0e7f]/.test(msg)) {
        return 'Activation failed. Please check your key/UDID and try again.';
    }
    return msg;
}

// Helper to translate device info labels and values to English
function translateDeviceInfo(label, value) {
    let newLabel = label;
    let newValue = value;

    if (label.includes('ไอดีเครื่อง') || label.includes('UDID') || label.includes('เครื่อง')) {
        newLabel = 'Device ID (UDID)';
    } else if (label.includes('ไอพีลงทะเบียน') || label.includes('ลงทะเบียน')) {
        newLabel = 'Registered IP';
    } else if (label.includes('ไอพีปัจจุบัน') || label.includes('ปัจจุบัน')) {
        newLabel = 'Current IP';
    } else if (label.includes('สถานะ') || label.includes('ทำงาน')) {
        newLabel = 'Operation Status';
    }

    if (value.toLowerCase().includes('secured connection') || value.toLowerCase().includes('active')) {
        newValue = value;
    } else if (value.includes('สำเร็จ') || value.toLowerCase().includes('success')) {
        newValue = 'Active';
    } else if (value.includes('ไม่พบ') || value.toLowerCase().includes('not found')) {
        newValue = 'Not Found';
    } else if (/[\u0e00-\u0e7f]/.test(value)) {
        newValue = 'Active';
    }

    return { label: newLabel, value: newValue };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Use JSON body parser for general API requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Raw body parser for /load_udid.php to capture the iOS provisioning profile payload
app.use('/load_udid.php', bodyParser.raw({ type: '*/*', limit: '50mb' }));

/**
 * 1. GET /extract.php
 * Fetches the get_udid.mobileconfig from the backend, modifies the URL to point to our proxy,
 * and sends it back to the client.
 */
app.get('/extract.php', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        const host = req.headers.host;
        const proxyLoadUdidUrl = `${protocol}://${host}/load_udid.php`;

        console.log(`[Proxy GET /extract.php] Fetching mobileconfig from backend...`);
        
        const response = await axios.get('https://proxy.xsteam.store/extract.php', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
            },
            responseType: 'text'
        });

        const originalConfigXml = response.data;
        
        // Replace the submission URL to point to our proxy load_udid.php
        const modifiedConfigXml = originalConfigXml.replace(
            /https:\/\/proxy\.xsteam\.store\/load_udid\.php/g,
            proxyLoadUdidUrl
        );

        console.log(`[Proxy GET /extract.php] Replaced backend URL with proxy URL: ${proxyLoadUdidUrl}`);

        res.setHeader('Content-Type', 'application/x-apple-aspen-config; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="get_udid.mobileconfig"');
        res.status(200).send(modifiedConfigXml);
    } catch (error) {
        console.error('[Proxy GET /extract.php] Error:', error.message);
        res.status(500).send('Failed to generate provisioning profile. Please try again.');
    }
});

/**
 * 2. POST /load_udid.php
 * Captures the iOS device settings payload (which is PKCS#7 signed XML plist),
 * forwards it directly to the backend load_udid.php, and rewrites the redirect Location header
 * to point back to our domain instead of proxy.xsteam.store.
 */
app.post('/load_udid.php', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        const host = req.headers.host;

        console.log(`[Proxy POST /load_udid.php] Forwarding iOS profile payload to backend...`);

        // Forward request to proxy.xsteam.store/load_udid.php
        // We disable redirects (maxRedirects: 0) to capture the 302 Found response
        const response = await axios.post('https://proxy.xsteam.store/load_udid.php', req.body, {
            headers: {
                'Content-Type': req.headers['content-type'] || 'application/pkcs7-signature',
                'User-Agent': req.headers['user-agent']
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });

        console.log(`[Proxy POST /load_udid.php] Backend response code:`, response.status);
        console.log(`[Proxy POST /load_udid.php] Backend response headers:`, JSON.stringify(response.headers, null, 2));

        const backendLocation = response.headers.location;
        if (backendLocation) {
            console.log(`[Proxy POST /load_udid.php] Backend redirect Location:`, backendLocation);
            
            // Rewrite redirect Location to point to our host/frontend
            // Expecting: https://proxy.xsteam.store/?udid=XXXXX -> https://our-host/?udid=XXXXX
            const modifiedLocation = backendLocation.replace(
                /https:\/\/proxy\.xsteam\.store\//g,
                `${protocol}://${host}/`
            );

            console.log(`[Proxy POST /load_udid.php] Rewritten redirect Location:`, modifiedLocation);
            res.setHeader('Location', modifiedLocation);
            res.status(302).send();
        } else {
            // If there was no redirect, pass back whatever response the backend returned
            res.status(response.status).send(response.data);
        }
    } catch (error) {
        console.error('[Proxy POST /load_udid.php] Error forwarding payload:', error.message);
        res.status(500).send('Verification failed.');
    }
});

/**
 * Helper to fetch and parse tutorial2.html (Dashboard Data) using session cookie
 */
async function fetchDashboardData(session) {
    try {
        console.log('[Proxy fetchDashboardData] Fetching tutorial2.html...');
        const response = await axios.get('https://proxy.xsteam.store/tutorial2.html', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                'Cookie': session
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const nodes = [];
        $('.node-box').each((i, el) => {
            let name = $(el).find('.node-name').text().trim();
            const status = $(el).find('.status-badge').text().trim();
            const host = $(el).find('.detail-item').eq(0).find('.detail-val').text().trim();
            const port = $(el).find('.detail-item').eq(1).find('.detail-val').text().trim();
            
            // Translate node name to English
            if (name.includes('ขยายดาเมจหัว')) name = 'Increase Head Damage';
            else if (name.includes('ยิงตัวขึ้นหัว')) name = 'Body to Head Shot';
            else if (name.includes('ยิงคอขึ้นหัว')) name = 'Neck to Head Shot';
            else if (name.includes('ขยายตัว80%')) name = 'Expand Player 80%';
            else if (name.includes('ขยายตัว 10%')) name = 'Expand Player 10%';

            nodes.push({ name, status, host, port });
        });

        const sslDownloadHref = $('a[href*="pem"]').attr('href') || 'downloads/parkin.pem';

        const annImage = $('#announcementModal img').attr('src') || '';
        let annTitle = $('#announcementModal h2').text().trim() || '';
        let annDesc = $('#announcementModal p').text().trim() || '';

        // Translate announcement to English
        if (annTitle.includes('ประกาศ') || annTitle.includes('แจ้งเตือน')) {
            annTitle = 'Announcement';
        }
        if (annDesc.includes('ขอบคุณที่ใช้บริการ')) {
            annDesc = '💌 Thank you for using our service! 👏';
        } else if (/[\u0e00-\u0e7f]/.test(annDesc)) {
            annDesc = 'Welcome to IOS PROXY Client Portal!';
        }

        console.log(`[Proxy fetchDashboardData] Parsed ${nodes.length} nodes successfully.`);

        return {
            nodes,
            ssl_href: sslDownloadHref,
            announcement: annTitle || annDesc ? {
                image: 'ios_proxy_banner.png',
                title: annTitle || 'IOS PROXY',
                desc: annDesc
            } : null
        };
    } catch (error) {
        console.error('[Proxy fetchDashboardData] Error:', error.message);
        return {
            nodes: [],
            ssl_href: 'downloads/parkin.pem',
            announcement: null
        };
    }
}

// Route to proxy SSL certificate download
app.get('/downloads/parkin.pem', async (req, res) => {
    try {
        console.log('[Proxy GET /downloads/parkin.pem] Forwarding certificate request to backend...');
        const response = await axios.get('https://proxy.xsteam.store/downloads/parkin.pem', { responseType: 'stream' });
        res.setHeader('Content-Disposition', 'attachment; filename="parkin.pem"');
        response.data.pipe(res);
    } catch (error) {
        console.error('[Proxy GET /downloads/parkin.pem] Error:', error.message);
        res.status(500).send('Failed to fetch certificate.');
    }
});

// Route to proxy uploaded announcement images
app.get('/data/uploads/:filename', async (req, res) => {
    try {
        console.log(`[Proxy GET /data/uploads/${req.params.filename}] Forwarding upload file request...`);
        const response = await axios.get(`https://proxy.xsteam.store/data/uploads/${req.params.filename}`, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (error) {
        console.error('[Proxy GET /data/uploads] Error:', error.message);
        res.status(404).send('Not Found');
    }
});

/**
 * 3. POST /api/verify
 * Accepts validation requests, sends them to the backend, parses the returned HTML page,
 * and replies with JSON format.
 */
app.post('/api/verify', async (req, res) => {
    const { udid, key } = req.body;
    if (!udid || !key) {
        return res.status(400).json({ success: false, message: 'Please enter both UDID and License Key.' });
    }

    try {
        console.log(`[Proxy POST /api/verify] Verifying UDID: ${udid}, Key: ${key}`);

        // Encode the form-urlencoded request body
        const formParams = new URLSearchParams();
        formParams.append('udid_hidden', '');
        formParams.append('udid', udid);
        formParams.append('key', key);
        formParams.append('verify_key', 'เปิดใช้งานระบบเข้าเครื่อง');

        // Post request to proxy.xsteam.store
        const response = await axios.post('https://proxy.xsteam.store/', formParams.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Check if there is a success page indicator (Step 3): e.g., shield-halo or countdown-grid
        const isSuccess = $('.success-glowing-shield').length > 0 || $('.premium-countdown-card').length > 0;
        // Check if there is a confirmation form (Step 2)
        const isStep2 = $('button[name="confirm_activation"]').length > 0;

        if (isSuccess) {
            console.log('[Proxy POST /api/verify] Key verification SUCCESS! (Direct to Step 3)');

            // Parse device info from .neon-tech-panel / .tech-row
            const deviceInfo = [];
            $('.tech-row').each((i, el) => {
                const label = $(el).find('.tech-lbl').text().trim();
                const value = $(el).find('.tech-val').text().trim();
                if (label || value) {
                    deviceInfo.push(translateDeviceInfo(label, value));
                }
            });

            // Parse countdown values
            const countdown = {
                days: '00',
                hours: '00',
                minutes: '00',
                seconds: '00'
            };

            $('.cd-item').each((i, el) => {
                const val = $(el).find('.cd-val').text().trim();
                const lbl = $(el).find('.cd-lbl').text().trim();
                if (lbl.includes('วัน') || lbl.toLowerCase().includes('day')) {
                    countdown.days = val;
                } else if (lbl.includes('ชม') || lbl.toLowerCase().includes('hour')) {
                    countdown.hours = val;
                } else if (lbl.includes('นาที') || lbl.toLowerCase().includes('min')) {
                    countdown.minutes = val;
                } else if (lbl.includes('วิ') || lbl.toLowerCase().includes('sec')) {
                    countdown.seconds = val;
                }
            });

            let expiryTimestamp = null;
            $('script').each((i, el) => {
                const scriptText = $(el).html();
                if (scriptText) {
                    const dateMatch = scriptText.match(/new\s+Date\((['"`])(.*?)\1\)/i);
                    if (dateMatch && dateMatch[2]) {
                        const parsedDate = Date.parse(dateMatch[2]);
                        if (!isNaN(parsedDate)) {
                            expiryTimestamp = parsedDate;
                        }
                    }
                    if (!expiryTimestamp) {
                        const countdownMatch = scriptText.match(/countDownDate\s*=\s*([0-9]+)/i);
                        if (countdownMatch && countdownMatch[1]) {
                            expiryTimestamp = parseInt(countdownMatch[1], 10);
                        }
                    }
                }
            });

            // Extract session cookie PHPSESSID to fetch dashboard data
            const setCookie = response.headers['set-cookie'];
            let cookieHeader = '';
            if (setCookie) {
                const phpsessid = setCookie.find(c => c.startsWith('PHPSESSID='));
                if (phpsessid) {
                    cookieHeader = phpsessid.split(';')[0];
                }
            }
            const dashboardData = await fetchDashboardData(cookieHeader);

            return res.json({
                success: true,
                step: 3,
                device_info: deviceInfo,
                countdown,
                expiry_timestamp: expiryTimestamp,
                dashboard: dashboardData
            });
        } else if (isStep2) {
            console.log('[Proxy POST /api/verify] Key verification returns Step 2 (Confirmation Required)');

            // Extract session cookie PHPSESSID
            const setCookie = response.headers['set-cookie'];
            let cookieHeader = '';
            if (setCookie) {
                const phpsessid = setCookie.find(c => c.startsWith('PHPSESSID='));
                if (phpsessid) {
                    cookieHeader = phpsessid.split(';')[0];
                }
            }
            console.log('[Proxy POST /api/verify] Saved session cookie:', cookieHeader);

            // Extract confirmation details
            const licenseKey = $('.neon-data-box .font-monospace, .neon-tech-panel .font-monospace').first().text().trim() || $('.font-monospace.text-white').first().text().trim() || key;
            const userIp = $('.neon-data-box .font-monospace.text-info').first().text().trim() || $('.text-info').next().first().text().trim() || 'Unknown';

            return res.json({
                success: true,
                step: 2,
                session: cookieHeader,
                details: {
                    key: licenseKey,
                    ip: userIp
                }
            });
        } else {
            console.log('[Proxy POST /api/verify] Key verification FAILED/STILL ON REGISTER PAGE');

            let errorMessage = '';
            $('.warning-card').each((i, el) => {
                const text = $(el).text();
                if (!text.includes('คำเตือนเรื่องบราวเซอร์') && !text.includes('Safari')) {
                    errorMessage = $(el).find('.warning-text').text().trim() || text.trim();
                }
            });

            if (!errorMessage) {
                const alertText = $('.alert-danger, .alert').text().trim();
                if (alertText) {
                    errorMessage = alertText;
                }
            }

            if (!errorMessage) {
                errorMessage = 'Activation failed. Please check your license key or device UDID and try again.';
            } else {
                errorMessage = translateErrorMessage(errorMessage);
            }

            return res.json({
                success: false,
                message: errorMessage
            });
        }
    } catch (error) {
        console.error('[Proxy POST /api/verify] Exception:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while connecting to the backend system: ' + error.message
        });
    }
});

/**
 * 4. POST /api/confirm
 * Submits the Step 2 confirmation to the backend using the stored session cookie,
 * follows the redirect, and parses the final success HTML page.
 */
app.post('/api/confirm', async (req, res) => {
    const { session } = req.body;
    if (!session) {
        return res.status(400).json({ success: false, message: 'Invalid or expired session.' });
    }

    try {
        console.log(`[Proxy POST /api/confirm] Confirming activation with session cookie...`);

        const formParams = new URLSearchParams();
        formParams.append('confirm_activation', '');

        // Post request to confirm activation
        const response = await axios.post('https://proxy.xsteam.store/', formParams.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                'Cookie': session
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });

        const redirectUrl = response.headers.location;
        console.log(`[Proxy POST /api/confirm] Confirmation POST responded with status: ${response.status}, redirecting to: ${redirectUrl}`);

        if (redirectUrl) {
            let redirectPath = redirectUrl.replace('https://proxy.xsteam.store', '');
            if (!redirectPath.startsWith('/')) {
                redirectPath = '/' + redirectPath;
            }

            console.log(`[Proxy POST /api/confirm] Fetching Step 3 page from: ${redirectPath}`);

            // GET the redirect page
            const step3Response = await axios.get(`https://proxy.xsteam.store${redirectPath}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                    'Cookie': session
                }
            });

            const html = step3Response.data;
            const $ = cheerio.load(html);

            const isSuccess = $('.success-glowing-shield').length > 0 || $('.premium-countdown-card').length > 0;

            if (isSuccess) {
                console.log('[Proxy POST /api/confirm] Final verification SUCCESS!');

                // Parse device info from .neon-tech-panel / .tech-row
                const deviceInfo = [];
                $('.tech-row').each((i, el) => {
                    const label = $(el).find('.tech-lbl').text().trim();
                    const value = $(el).find('.tech-val').text().trim();
                    if (label || value) {
                        deviceInfo.push(translateDeviceInfo(label, value));
                    }
                });

                // Parse countdown values
                const countdown = {
                    days: '00',
                    hours: '00',
                    minutes: '00',
                    seconds: '00'
                };

                $('.cd-item').each((i, el) => {
                    const val = $(el).find('.cd-val').text().trim();
                    const lbl = $(el).find('.cd-lbl').text().trim();
                    if (lbl.includes('วัน') || lbl.toLowerCase().includes('day')) {
                        countdown.days = val;
                    } else if (lbl.includes('ชม') || lbl.toLowerCase().includes('hour')) {
                        countdown.hours = val;
                    } else if (lbl.includes('นาที') || lbl.toLowerCase().includes('min')) {
                        countdown.minutes = val;
                    } else if (lbl.includes('วิ') || lbl.toLowerCase().includes('sec')) {
                        countdown.seconds = val;
                    }
                });

                let expiryTimestamp = null;
                $('script').each((i, el) => {
                    const scriptText = $(el).html();
                    if (scriptText) {
                        const dateMatch = scriptText.match(/new\s+Date\((['"`])(.*?)\1\)/i);
                        if (dateMatch && dateMatch[2]) {
                            const parsedDate = Date.parse(dateMatch[2]);
                            if (!isNaN(parsedDate)) {
                                expiryTimestamp = parsedDate;
                            }
                        }
                        if (!expiryTimestamp) {
                            const countdownMatch = scriptText.match(/countDownDate\s*=\s*([0-9]+)/i);
                            if (countdownMatch && countdownMatch[1]) {
                                expiryTimestamp = parseInt(countdownMatch[1], 10);
                            }
                        }
                    }
                });

                const dashboardData = await fetchDashboardData(session);

                return res.json({
                    success: true,
                    step: 3,
                    device_info: deviceInfo,
                    countdown,
                    expiry_timestamp: expiryTimestamp,
                    dashboard: dashboardData
                });
            } else {
                console.log('[Proxy POST /api/confirm] Final verification FAILED to verify success indicators');

                let errorMessage = '';
                $('.warning-card').each((i, el) => {
                    const text = $(el).text();
                    if (!text.includes('คำเตือนเรื่องบราวเซอร์') && !text.includes('Safari')) {
                        errorMessage = $(el).find('.warning-text').text().trim() || text.trim();
                    }
                });

                if (!errorMessage) {
                    errorMessage = 'An error occurred during verification confirmation.';
                } else {
                    errorMessage = translateErrorMessage(errorMessage);
                }

                return res.json({
                    success: false,
                    message: errorMessage
                });
            }
        } else {
            return res.json({
                success: false,
                message: 'Redirect for activation verification not received.'
            });
        }
    } catch (error) {
        console.error('[Proxy POST /api/confirm] Exception:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred during activation connection: ' + error.message
        });
    }
});

// Fallback to serving the frontend for all other requests (useful for SPA behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`IOS PROXY Licensing Client Proxy Server is running!`);
        console.log(`Local url: http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
