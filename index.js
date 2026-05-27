// index.js - FINAL SAFE VERSION
const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs');
const axios = require('axios');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Jakarta');

// ========== GANTI 2 NOMOR INI ==========
const OWNER_NUMBER = '6281234567890'; // GANTI!!!
const BOT_NUMBER = '6281234567890';   // GANTI!!!

// Data
let users = {};
let premiumUsers = [];
const DAILY_LIMIT = 30;

// Load/save data
try {
    if (fs.existsSync('./data.json')) {
        const d = JSON.parse(fs.readFileSync('./data.json'));
        users = d.users || {};
        premiumUsers = d.premiumUsers || [];
    }
} catch(e) { console.log('Data baru dibuat'); }

function saveData() {
    fs.writeFileSync('./data.json', JSON.stringify({ users, premiumUsers }, null, 2));
}
setInterval(saveData, 30000);

// ========== COMMANDS ==========
const cmds = {
    menu: (s, prem) => `╭──❲ LOXAS BOT ❳──⬣
│ 👤 ${s.slice(0,10)}... | ${prem ? '👑 PREMIUM' : '📊 FREE'}
│ 📊 Limit: ${users[s]??DAILY_LIMIT}/${DAILY_LIMIT}
├─🎮 GAME
│ !suit batu  !random 1 100
│ !fact  !quotes  !joke  !truth
├─📥 DOWNLOAD
│ !ytmp3 url  !tiktok url
│ !ig url  !fb url
├─🎨 STIKER
│ !stiker (balas gambar)
│ !toimg (balas stiker)
├─🔧 TOOLS
│ !ping  !time  !claim  !limit  !owner
├─👑 OWNER (.addprem .delprem)
╰────────────────⬣`,
    ping: () => `🏓 Pong!`,
    time: () => `🕐 ${moment().format('HH:mm:ss')}`,
    owner: () => `👨‍💻 Owner: wa.me/${OWNER_NUMBER}`,
    limit: (s) => `📊 Limit: ${users[s]??DAILY_LIMIT}/${DAILY_LIMIT}`,
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
        } catch { return '🔍 Kamu keren!'; }
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
        } catch { return '🤣 Ada apa dengan bot? Bot bahagia!'; }
    },
    suit: (a) => {
        let p = ['batu','kertas','gunting'];
        let u = a[0]?.toLowerCase();
        if (!p.includes(u)) return '❗ Pilih: batu/kertas/gunting';
        let b = p[Math.floor(Math.random()*3)];
        if (u===b) return `🤝 Seri (${u} vs ${b})`;
        if ((u==='batu'&&b==='gunting')||(u==='gunting'&&b==='kertas')||(u==='kertas'&&b==='batu')) 
            return `🎉 Kamu menang! (${u} vs ${b})`;
        return `😭 Kamu kalah! (${u} vs ${b})`;
    },
    random: (a) => {
        let min = parseInt(a[0])||1, max = parseInt(a[1])||100;
        if(min>=max) return '!random 1 100';
        return `🎲 ${Math.floor(Math.random()*(max-min+1))+min}`;
    },
    truth: () => `🔞 Truth: Hal paling memalukanmu?`,
    dare: () => `😈 Dare: Chat "aku bot" ke 5 kontak!`,
    report: (m) => m ? `📝 Laporan: "${m}"\nTerima kasih!` : '!report <pesan>',
    ytmp3: (u) => u ? `🎵 Download: ${u}` : '!ytmp3 <url>',
    tiktok: (u) => u ? `🎬 TikTok: ${u}` : '!tiktok <url>',
    ig: (u) => u ? `📸 IG: ${u}` : '!ig <url>',
    fb: (u) => u ? `📘 FB: ${u}` : '!fb <url>',
    stiker: () => `🎨 Balas gambar dengan teks !stiker`,
    toimg: () => `🖼️ Balas stiker dengan !toimg`,
    addprem: (n, s) => {
        if(s !== OWNER_NUMBER) return '❌ Owner only';
        if(!n) return '.addprem 628xxx';
        let cl = n.replace(/\D/g,'');
        if(!premiumUsers.includes(cl)) premiumUsers.push(cl);
        saveData();
        return `✅ ${cl} premium!`;
    },
    delprem: (n, s) => {
        if(s !== OWNER_NUMBER) return '❌ Owner only';
        let cl = n?.replace(/\D/g,'');
        premiumUsers = premiumUsers.filter(x => x !== cl);
        saveData();
        return `❌ ${cl} bukan premium.`;
    }
};

// ========== START BOT ==========
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (u) => {
        if (u.connection === 'open') console.log('\n✅ BOT AKTIF!');
        if (u.connection === 'close') setTimeout(start, 5000);
    });

    // Pairing
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode(BOT_NUMBER);
            console.log(`\n📱 PAIRING CODE: ${code}\n`);
        } catch(e) { console.log('❌ Pairing gagal:', e.message); }
    }, 2000);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        let m = messages[0];
        if (!m.message || m.key.fromMe) return;
        
        let from = m.key.remoteJid;
        let body = m.message.conversation || m.message.extendedTextMessage?.text || '';
        let sender = m.key.participant || from.split('@')[0];
        let isPrem = premiumUsers.includes(sender);
        
        if (!body.startsWith('!') && !body.startsWith('.')) return;
        
        let cmd = body.slice(1).split(' ')[0].toLowerCase();
        let args = body.split(' ').slice(1);
        
        if (users[sender] === undefined) users[sender] = DAILY_LIMIT;
        
        let noLimit = ['claim','limit','menu','ping','owner','profile'];
        if (users[sender] <= 0 && !isPrem && !noLimit.includes(cmd) && body.startsWith('!')) {
            await sock.sendMessage(from, { text: '⚠️ Limit habis! Ketik !claim' });
            return;
        }
        
        if (!noLimit.includes(cmd) && !isPrem && body.startsWith('!')) {
            users[sender]--;
            saveData();
        }
        
        let reply = '';
        switch(cmd) {
            case 'menu': reply = cmds.menu(sender, isPrem); break;
            case 'ping': reply = cmds.ping(); break;
            case 'time': reply = cmds.time(); break;
            case 'owner': reply = cmds.owner(); break;
            case 'limit': reply = cmds.limit(sender); break;
            case 'claim': reply = cmds.claim(sender); break;
            case 'fact': reply = await cmds.fact(); break;
            case 'quotes': reply = await cmds.quotes(); break;
            case 'joke': reply = await cmds.joke(); break;
            case 'suit': reply = cmds.suit(args); break;
            case 'random': reply = cmds.random(args); break;
            case 'truth': reply = cmds.truth(); break;
            case 'dare': reply = cmds.dare(); break;
            case 'report': reply = cmds.report(args.join(' ')); break;
            case 'ytmp3': reply = cmds.ytmp3(args[0]); break;
            case 'tiktok': reply = cmds.tiktok(args[0]); break;
            case 'ig': reply = cmds.ig(args[0]); break;
            case 'fb': reply = cmds.fb(args[0]); break;
            case 'stiker': reply = cmds.stiker(); break;
            case 'toimg': reply = cmds.toimg(); break;
            case 'addprem': reply = cmds.addprem(args[0], sender); break;
            case 'delprem': reply = cmds.delprem(args[0], sender); break;
            default: if(body.startsWith('!')) reply = '❌ Perintah salah. Ketik !menu';
        }
        if(reply) await sock.sendMessage(from, { text: reply });
    });
}

console.log('🟢 Loxas-Deploy starting...');
start().catch(console.error);
