const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs');
const axios = require('axios');
const moment = require('moment-timezone');
const { exec } = require('child_process');

moment.tz.setDefault('Asia/Jakarta');

// ========== KONFIGURASI ==========
const OWNER_NUMBER = '6282342265016'; // GANTI DENGAN NOMOR WHATSAPP KAMU!!!

let users = {};
let premiumUsers = [];
const DAILY_LIMIT = 30;

// Load data
try {
    if (fs.existsSync('./data.json')) {
        const d = JSON.parse(fs.readFileSync('./data.json'));
        users = d.users || {};
        premiumUsers = d.premiumUsers || [];
    }
} catch(e) {}

function saveData() {
    fs.writeFileSync('./data.json', JSON.stringify({ users, premiumUsers }));
}
setInterval(saveData, 30000);

// ========== FITUR BOT ==========
const commands = {
    menu: (s, prem) => {
        let limit = users[s] ?? DAILY_LIMIT;
        return `╭──❲ LOXAS BOT ❳──⬣
│ 👤 ${s.slice(0,8)}... | ${prem ? '👑 PREMIUM' : '📊 FREE'}
│ 📊 Limit: ${limit}/${DAILY_LIMIT}
├─🎮 GAME
│ !suit batu  !random 1 100
│ !fact  !quotes  !joke  !truth  !dare
├─📥 DOWNLOAD
│ !ytmp3 url  !tiktok url
│ !ig url  !fb url
├─🎨 STIKER
│ !stiker (balas gambar)
│ !toimg (balas stiker)
├─🔧 TOOLS
│ !ping  !time  !owner  !limit  !claim
├─👑 OWNER (.addprem .delprem)
╰────────────────⬣`;
    },
    ping: () => `🏓 Pong!`,
    time: () => `🕐 ${moment().format('HH:mm:ss, DD/MM/YYYY')}`,
    owner: () => `👨‍💻 Owner: wa.me/${OWNER_NUMBER}`,
    limit: (s) => `📊 Limit: ${users[s] ?? DAILY_LIMIT}/${DAILY_LIMIT}`,
    claim: (s) => {
        let cur = users[s] ?? DAILY_LIMIT;
        if (cur >= DAILY_LIMIT) return '⚠️ Limit masih penuh!';
        users[s] = DAILY_LIMIT;
        saveData();
        return '✅ +30 limit!';
    },
    fact: async () => {
        try {
            let r = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 3000 });
            return `🔍 ${r.data.text}`;
        } catch { return '🔍 Fakta: Kamu keren!'; }
    },
    quotes: async () => {
        try {
            let r = await axios.get('https://api.quotable.io/random', { timeout: 3000 });
            return `💭 "${r.data.content}" — ${r.data.author}`;
        } catch { return '💭 Hidup itu indah'; }
    },
    joke: async () => {
        try {
            let r = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 3000 });
            return `😂 ${r.data.setup}\n🎯 ${r.data.punchline}`;
        } catch { return '🤣 Kenapa bot bahagia? Karena selalu ada chat!'; }
    },
    suit: (args) => {
        let p = ['batu', 'kertas', 'gunting'];
        let u = args[0]?.toLowerCase();
        if (!p.includes(u)) return '❗ Pilih: batu/kertas/gunting';
        let b = p[Math.floor(Math.random() * 3)];
        if (u === b) return `🤝 Seri! (${u} vs ${b})`;
        if ((u === 'batu' && b === 'gunting') || (u === 'gunting' && b === 'kertas') || (u === 'kertas' && b === 'batu')) {
            return `🎉 Menang! (${u} vs ${b})`;
        }
        return `😭 Kalah! (${u} vs ${b})`;
    },
    random: (args) => {
        let min = parseInt(args[0]) || 1;
        let max = parseInt(args[1]) || 100;
        if (min >= max) return '❗ !random 1 100';
        return `🎲 ${Math.floor(Math.random() * (max - min + 1)) + min}`;
    },
    truth: () => `🔞 Truth: Hal paling memalukanmu?`,
    dare: () => `😈 Dare: Chat "aku suka bot" ke 3 kontak!`,
    sticker: () => `🎨 Balas gambar dengan teks !stiker`,
    toimg: () => `🖼️ Balas stiker dengan !toimg`,
    ytmp3: (url) => url ? `🎵 Download: ${url}` : '!ytmp3 <url>',
    tiktok: (url) => url ? `🎬 TikTok: ${url}` : '!tiktok <url>',
    ig: (url) => url ? `📸 IG: ${url}` : '!ig <url>',
    fb: (url) => url ? `📘 FB: ${url}` : '!fb <url>',
    addprem: (n, s) => {
        if (s !== OWNER_NUMBER) return '❌ Owner only!';
        let num = n?.replace(/\D/g, '');
        if (!num) return '.addprem 628xxx';
        if (!premiumUsers.includes(num)) premiumUsers.push(num);
        saveData();
        return `✅ ${num} premium!`;
    },
    delprem: (n, s) => {
        if (s !== OWNER_NUMBER) return '❌ Owner only!';
        let num = n?.replace(/\D/g, '');
        premiumUsers = premiumUsers.filter(x => x !== num);
        saveData();
        return `❌ ${num} bukan premium.`;
    }
};

// ========== BOT WHATSAPP ==========
let sock = null;
let isBotConnected = false;

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('bot_session');
        sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: false,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                isBotConnected = true;
                console.log('✅ BOT AKTIF!');
            }
            if (connection === 'close') {
                isBotConnected = false;
                console.log('❌ Koneksi putus, reconnect dalam 5 detik...');
                setTimeout(startBot, 5000);
            }
        });

        // Proses pesan
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            const from = msg.key.remoteJid;
            let body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const sender = msg.key.participant || from.split('@')[0];
            const isPremium = premiumUsers.includes(sender);
            
            if (!body.startsWith('!') && !body.startsWith('.')) return;
            
            let cmd = body.slice(1).split(' ')[0].toLowerCase();
            let args = body.split(' ').slice(1);
            
            if (users[sender] === undefined) users[sender] = DAILY_LIMIT;
            
            let noLimit = ['claim', 'limit', 'menu', 'ping', 'owner'];
            if (users[sender] <= 0 && !isPremium && !noLimit.includes(cmd) && body.startsWith('!')) {
                await sock.sendMessage(from, { text: '⚠️ Limit habis! Ketik !claim' });
                return;
            }
            
            if (!noLimit.includes(cmd) && !isPremium && body.startsWith('!')) {
                users[sender]--;
                saveData();
            }
            
            let reply = '';
            switch(cmd) {
                case 'menu': reply = commands.menu(sender, isPremium); break;
                case 'ping': reply = commands.ping(); break;
                case 'time': reply = commands.time(); break;
                case 'owner': reply = commands.owner(); break;
                case 'limit': reply = commands.limit(sender); break;
                case 'claim': reply = commands.claim(sender); break;
                case 'fact': reply = await commands.fact(); break;
                case 'quotes': reply = await commands.quotes(); break;
                case 'joke': reply = await commands.joke(); break;
                case 'suit': reply = commands.suit(args); break;
                case 'random': reply = commands.random(args); break;
                case 'truth': reply = commands.truth(); break;
                case 'dare': reply = commands.dare(); break;
                case 'stiker': reply = commands.sticker(); break;
                case 'toimg': reply = commands.toimg(); break;
                case 'ytmp3': reply = commands.ytmp3(args[0]); break;
                case 'tiktok': reply = commands.tiktok(args[0]); break;
                case 'ig': reply = commands.ig(args[0]); break;
                case 'fb': reply = commands.fb(args[0]); break;
                case 'addprem': reply = commands.addprem(args[0], sender); break;
                case 'delprem': reply = commands.delprem(args[0], sender); break;
                default: if(body.startsWith('!')) reply = '❌ Perintah salah. Ketik !menu';
            }
            if(reply) await sock.sendMessage(from, { text: reply });
        });
    } catch (err) {
        console.log('Error startBot:', err);
        setTimeout(startBot, 10000);
    }
}

startBot();

// ========== WEBSITE PAIRING ==========
const app = express();
app.use(express.json());

const htmlPage = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loxas-Deploy | Pairing Bot WhatsApp</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
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
            border: 1px solid rgba(0,242,254,0.2);
            text-align: center;
        }
        .logo { font-size: 3rem; margin-bottom: 20px; }
        h1 { font-size: 1.8rem; margin-bottom: 10px; background: linear-gradient(135deg, #00f2fe, #4facfe); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .subtitle { color: #a0c4ff; margin-bottom: 30px; font-size: 0.9rem; }
        .input-group { margin-bottom: 25px; text-align: left; }
        .input-group label { display: block; margin-bottom: 8px; color: #00f2fe; font-weight: 500; }
        .input-group input {
            width: 100%; padding: 15px 20px; background: rgba(255,255,255,0.1);
            border: 1px solid rgba(0,242,254,0.3); border-radius: 30px;
            color: white; font-size: 1rem; outline: none;
        }
        .btn {
            width: 100%; padding: 15px; background: linear-gradient(135deg, #00f2fe, #4facfe);
            border: none; border-radius: 30px; color: #0a0f1e;
            font-weight: 700; font-size: 1rem; cursor: pointer;
        }
        .btn:hover { transform: translateY(-2px); }
        .btn:disabled { opacity: 0.5; }
        .code-box { margin-top: 30px; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 20px; display: none; }
        .code-box.show { display: block; }
        .code-value { font-size: 2rem; font-weight: 800; letter-spacing: 8px; color: #00f2fe; background: #0a0f1e; padding: 15px; border-radius: 20px; }
        .steps { margin-top: 25px; text-align: left; font-size: 0.8rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
        .steps ol { margin-left: 20px; margin-top: 10px; }
        .error { background: rgba(255,68,68,0.2); border: 1px solid #ff4444; border-radius: 15px; padding: 12px; margin-top: 15px; display: none; }
        .error.show { display: block; }
        .loading { display: none; margin-top: 15px; }
        .loading.show { display: block; }
        footer { margin-top: 30px; font-size: 0.7rem; color: #4a5a7a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo">🤖⚡</div>
            <h1>Loxas-Deploy</h1>
            <div class="subtitle">Pairing Gateway - Hubungkan Bot ke WhatsApp</div>
            <div class="input-group">
                <label>📱 Nomor WhatsApp</label>
                <input type="tel" id="phoneNumber" placeholder="6281234567890" value="628">
            </div>
            <button class="btn" id="generateBtn">🔗 GENERATE PAIRING CODE</button>
            <div id="loading" class="loading">⏳ Memproses, tunggu sebentar...</div>
            <div id="codeBox" class="code-box">
                <div class="code-label">✨ PAIRING CODE:</div>
                <div class="code-value" id="pairingCode">------</div>
            </div>
            <div id="errorMsg" class="error"></div>
            <div class="steps">
                <strong>📌 CARA:</strong>
                <ol>
                    <li>Masukkan nomor WhatsApp yang akan jadi BOT</li>
                    <li>Klik Generate Pairing Code</li>
                    <li>Buka WhatsApp → Setelan → Perangkat Tertaut</li>
                    <li>Klik Tautkan Perangkat → Masukkan kode di atas</li>
                    <li>✅ Selesai! Bot Anda aktif</li>
                </ol>
            </div>
        </div>
        <footer>Loxas-Deploy Pairing Server | Bot 24 Jam</footer>
    </div>
    <script>
        document.getElementById('generateBtn').onclick = async () => {
            let phone = document.getElementById('phoneNumber').value.trim();
            phone = phone.replace(/[^0-9]/g, '');
            if (!phone.startsWith('62')) phone = '62' + phone;
            if (phone.length < 10 || phone.length > 15) {
                document.getElementById('errorMsg').innerText = 'Nomor tidak valid! Contoh: 6281234567890';
                document.getElementById('errorMsg').classList.add('show');
                setTimeout(() => document.getElementById('errorMsg').classList.remove('show'), 3000);
                return;
            }
            
            const btn = document.getElementById('generateBtn');
            const loading = document.getElementById('loading');
            const codeBox = document.getElementById('codeBox');
            const errorMsg = document.getElementById('errorMsg');
            
            btn.disabled = true;
            btn.innerText = '⏳ Memproses...';
            loading.classList.add('show');
            codeBox.classList.remove('show');
            errorMsg.classList.remove('show');
            
            try {
                const res = await fetch('/api/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone })
                });
                const data = await res.json();
                if (data.code) {
                    document.getElementById('pairingCode').innerText = data.code;
                    codeBox.classList.add('show');
                } else {
                    errorMsg.innerText = data.error || 'Gagal mendapatkan kode. Pastikan nomor aktif!';
                    errorMsg.classList.add('show');
                }
            } catch(err) {
                errorMsg.innerText = 'Server error: ' + err.message;
                errorMsg.classList.add('show');
            } finally {
                btn.disabled = false;
                btn.innerText = '🔗 GENERATE PAIRING CODE';
                loading.classList.remove('show');
            }
        };
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(htmlPage));

app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Nomor diperlukan' });
    
    // Bersihkan nomor
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('62')) cleanPhone = '62' + cleanPhone;
    
    console.log(`📱 Minta pairing untuk: ${cleanPhone}`);
    
    try {
        // Hapus session lama jika ada
        const sessionPath = `./temp_session_${cleanPhone}`;
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(`temp_session_${cleanPhone}`);
        const tempSock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: false,
            defaultQueryTimeoutMs: 30000
        });
        
        // Request pairing code
        const code = await tempSock.requestPairingCode(cleanPhone);
        console.log(`✅ Pairing code untuk ${cleanPhone}: ${code}`);
        
        // Simpan creds
        setTimeout(() => saveCreds(), 2000);
        
        // Hapus session setelah 1 menit
        setTimeout(() => {
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        }, 60000);
        
        res.json({ code, success: true });
    } catch (err) {
        console.error(`❌ Error pairing untuk ${cleanPhone}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   LOXAS-DEPLOY BOT + PAIRING WEB    ║
║   Running on port ${PORT}              ║
║   Bot aktif & siap digunakan!       ║
╚══════════════════════════════════════╝
    `);
});
