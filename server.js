const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let qrCodeData = null;
let isConnected = false;

// HTML untuk menampilkan QR
const htmlPage = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loxas-Deploy | QR Bot WhatsApp</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0f1e 0%, #0d1425 100%);
            color: #eef5ff;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .container { max-width: 500px; width: 90%; padding: 20px; }
        .card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 40px;
            padding: 40px 30px;
            text-align: center;
            border: 1px solid rgba(0,242,254,0.2);
        }
        .logo { font-size: 3rem; margin-bottom: 20px; }
        h1 { font-size: 1.8rem; margin-bottom: 10px; background: linear-gradient(135deg, #00f2fe, #4facfe); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 20px;
            margin: 20px 0;
            display: inline-block;
        }
        .qr-code {
            font-family: monospace;
            font-size: 0.7rem;
            white-space: pre;
            background: black;
            color: white;
            padding: 10px;
            border-radius: 10px;
            overflow-x: auto;
        }
        .status {
            margin-top: 20px;
            padding: 12px;
            border-radius: 20px;
            font-weight: 600;
        }
        .status.online { background: rgba(0,255,0,0.2); color: #00ff00; }
        .status.offline { background: rgba(255,0,0,0.2); color: #ff4444; }
        .status.pending { background: rgba(255,255,0,0.2); color: #ffff00; }
        .steps { margin-top: 25px; text-align: left; font-size: 0.8rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
        .steps ol { margin-left: 20px; margin-top: 10px; }
        button {
            background: linear-gradient(135deg, #00f2fe, #4facfe);
            border: none;
            padding: 12px 24px;
            border-radius: 30px;
            color: #0a0f1e;
            font-weight: bold;
            cursor: pointer;
            margin-top: 15px;
        }
        footer { margin-top: 30px; font-size: 0.7rem; color: #4a5a7a; }
        .refresh-note { font-size: 0.7rem; margin-top: 10px; color: #ffaa00; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo">🤖⚡</div>
            <h1>Loxas-Deploy</h1>
            <div class="subtitle" style="margin-bottom: 20px;">Scan QR Code untuk hubungkan bot</div>
            
            <div id="qrContainer" class="qr-container">
                <div id="qrCode" class="qr-code">Memuat QR Code...</div>
            </div>
            
            <div id="status" class="status pending">⏳ Menunggu scan...</div>
            
            <button onclick="location.reload()">🔄 Refresh QR</button>
            <div class="refresh-note">⚠️ Jika QR tidak muncul, refresh halaman</div>
            
            <div class="steps">
                <strong>📌 CARA:</strong>
                <ol>
                    <li>Buka WhatsApp di HP</li>
                    <li>Setelan → Perangkat Tertaut → Tautkan Perangkat</li>
                    <li>Scan QR Code di atas dengan HP</li>
                    <li>✅ Selesai! Bot akan aktif</li>
                </ol>
            </div>
        </div>
        <footer>Loxas-Deploy | Bot WhatsApp 24 Jam</footer>
    </div>
    <script>
        function updateStatus() {
            fetch('/api/status')
                .then(res => res.json())
                .then(data => {
                    const statusEl = document.getElementById('status');
                    if (data.connected) {
                        statusEl.className = 'status online';
                        statusEl.innerHTML = '✅ BOT ONLINE! WhatsApp terhubung';
                    } else if (data.qr) {
                        statusEl.className = 'status pending';
                        statusEl.innerHTML = '📱 Scan QR Code di atas dengan WhatsApp';
                        document.getElementById('qrCode').innerHTML = '<pre>' + data.qr + '</pre>';
                    } else {
                        statusEl.className = 'status offline';
                        statusEl.innerHTML = '❌ Menunggu QR Code... refresh halaman';
                    }
                });
        }
        setInterval(updateStatus, 3000);
        updateStatus();
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(htmlPage));

app.get('/api/status', (req, res) => {
    res.json({ connected: isConnected, qr: qrCodeData });
});

// ========== BOT WHATSAPP ==========
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('bot_session');
    
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
            isConnected = false;
            console.log('📱 QR Code baru siap scan');
            // Tampilkan QR di terminal juga
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            isConnected = true;
            qrCodeData = null;
            console.log('✅ BOT AKTIF! WhatsApp terhubung');
        }
        
        if (connection === 'close') {
            isConnected = false;
            console.log('❌ Koneksi putus, reconnect...');
            setTimeout(startBot, 5000);
        }
    });

    // Proses pesan (fitur bot)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        let body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        if (body === '!ping') {
            await sock.sendMessage(from, { text: '🏓 Pong! Bot aktif!' });
        } else if (body === '!menu') {
            await sock.sendMessage(from, { text: `╭──❲ LOXAS BOT ❳──⬣
│ ✅ Bot aktif!
│ 📱 WhatsApp terhubung
│ 
│ Fitur lengkap segera hadir!
│ !ping, !time, dll
╰────────────────⬣` });
        } else if (body.startsWith('!')) {
            await sock.sendMessage(from, { text: '❌ Perintah belum tersedia. Ketik !menu' });
        }
    });
}

startBot();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Website QR: https://your-railway-url`);
});
