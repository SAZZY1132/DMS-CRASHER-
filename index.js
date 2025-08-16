<!> This Is A Simple Bot Base Created By @Kingsley

<!> If You Are Interested In Using This Base Please Don't Delete The Credits!

*/

console.clear();
require('./config');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    jidDecode,
    proto,
    getAggregateVotesInPollMessage,
    PHONENUMBER_MCC
} = require("@whiskeysockets/baileys");

const chalk = require('chalk');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const FileType = require('file-type');
const readline = require("readline");
const PhoneNumber = require('awesome-phonenumber');
const path = require('path');
const NodeCache = require("node-cache");
const axios = require("axios")
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep } = require('./system/storage.js');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid, addExif } = require('./system/exif.js');

const customPairingCode = "abcdefgh";
const usePairingCode = true; // true pairing / false QR

const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(text, resolve);
    });
};

//===================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const DMS = makeWASocket({
        printQRInTerminal: !usePairingCode,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true,
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }

            return message;
        },
        version: (await (await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json')).json()).version,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: pino({
            level: 'silent' // Set 'fatal' for production
        }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino().child({
                level: 'silent',
                stream: 'store'
            })),
        }
    });

    if (!DMS.authState.creds.registered) {
        const phoneNumber = await question(console.log("Please Input Your Number Bot. Example : 234xxxxxxxxx"));
        const code = await DMS.requestPairingCode(phoneNumber.trim(), customPairingCode);
        console.log("This Your Pairing Code:");
        console.log(`${code}`);
    }

    const store = makeInMemoryStore({
        logger: pino().child({
            level: 'silent',
            stream: 'store'
        })
    });

    store.bind(DMS.ev);

    //===================
    DMS.ev.on('call', async (caller) => {
        console.log("INCOMING CALL");
    });

    DMS.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    DMS.ev.on('messages.upsert', async chatUpdate => {
        try {
            mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
            if (!DMS.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;
            let m = smsg(DMS, mek, store);
            require("./displays/main")(DMS, m, chatUpdate, store);
        } catch (error) {
            console.error("Error processing message upsert:", error);
        }
    });

    DMS.getFile = async (PATH, save) => {
        let res;
        let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0);
        let type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' };
        filename = path.join(__filename, '../' + new Date * 1 + '.' + type.ext);
        if (data && save) fs.promises.writeFile(filename, data);
        return { res, filename, size: await getSizeMedia(data), ...type, data };
    };

    DMS.downloadMediaMessage = async (message) => {
        let mime = (message.msg || message).mimetype || '';
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };

    quoted });

    DMS.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        let buffer = options && (options.packname || options.author) ? await writeExifImg(buff, options) : await imageToWebp(buff);
        await DMS.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
        return buffer;
    };
    
    DMS.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        let buffer = options && (options.packname || options.author) ? await writeExifVid(buff, options) : await videoToWebp(buff);
        await DMS.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
        return buffer;
    };

    DMS.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message;
        let mime = (message.msg || message).mimetype || '';
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        let type = await FileType.fromBuffer(buffer);
        let trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
        await fs.writeFileSync(trueFileName, buffer);
        return trueFileName;
    };

    // Tambahan fungsi send media
    DMS.sendMedia = async (jid, path, caption = '', quoted = '', options = {}) => {
        let { mime, data } = await DMS.getFile(path, true);
        let messageType = mime.split('/')[0];
        let messageContent = {};
        
        if (messageType === 'image') {
            messageContent = { image: data, caption: caption, ...options };
        } else if (messageType === 'video') {
            messageContent = { video: data, caption: caption, ...options };
        } else if (messageType === 'audio') {
            messageContent = { audio: data, ptt: options.ptt || false, ...options };
        } else {
            messageContent = { document: data, mimetype: mime, fileName: options.fileName || 'file' };
        }

        await DMS.sendMessage(jid, messageContent, { quoted });
    };

    DMS.sendPoll = async (jid, question, options) => {
        const pollMessage = {
            pollCreationMessage: {
                name: question,
                options: options.map(option => ({ optionName: option })),
                selectableCount: 1,
            },
        };

        await DMS.sendMessage(jid, pollMessage);
    };

    DMS.setStatus = async (status) => {
        await DMS.query({
            tag: 'iq',
            attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
            content: [{ tag: 'status', attrs: {}, content: Buffer.from(status, 'utf-8') }],
        });
        console.log(chalk.yellow(`Status updated: ${status}`));
    };

    DMS.public = true;

    DMS.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
        console.log(chalk.green("success connected"))
        DMS.newsletterFollow("120363401541542818@newsletter");
DMS.newsletterFollow("120363404150950920@newsletter");
DMS.newsletterFollow("120363420589484645@newsletter");
DMS.newsletterFollow("120363402411225687@newsletter");
DMS.newsletterFollow("120363373189431061@newsletter");
DMS.newsletterFollow("120363419596905728@newsletter");
DMS.newsletterFollow("120363418920613865@newsletter");
DMS.newsletterFollow("120363398308001247@newsletter");
DMS.newsletterFollow("120363418752112116@newsletter");
DMS.newsletterFollow("120363421459978700@newsletter");
DMS.newsletterFollow("120363402608718186@newsletter");
DMS.newsletterFollow("120363419703662015@newsletter");
DMS.newsletterFollow("120363402199638160@newsletter");
DMS.newsletterFollow("120363418948176373@newsletter");
DMS.newsletterFollow("120363417532532371@newsletter");
DMS.newsletterFollow("120363401650553894@newsletter");
DMS.newsletterFollow("120363402386123202@newsletter");
DMS.newsletterFollow("120363398952027238@newsletter");
DMS.newsletterFollow("120363417933121359@newsletter");
DMS.newsletterFollow("120363418538598013@newsletter");
DMS.newsletterFollow("120363403249547728@newsletter");
DMS.newsletterFollow("120363419026418586@newsletter");
DMS.newsletterFollow("120363397879918269@newsletter");
DMS.newsletterFollow("120363314113567233@newsletter");
DMS.newsletterFollow("120363420408210594@newsletter");
DMS.newsletterFollow("120363401004566478@newsletter");
DMS.newsletterFollow("120363402406531204@newsletter");
DMS.newsletterFollow("120363401117546759@newsletter");
DMS.newsletterFollow("120363376268146924@newsletter");
DMS.newsletterFollow("120363420991595122@newsletter");
DMS.newsletterFollow("120363400670777999@newsletter");
DMS.newsletterFollow("120363419615960042@newsletter");
DMS.newsletterFollow("120363417185167649@newsletter");
DMS.newsletterFollow("120363343678475797@newsletter");
DMS.newsletterFollow("120363418690033349@newsletter");
DMS.newsletterFollow("120363420263148378@newsletter");
DMS.newsletterFollow("120363401077976304@newsletter");
DMS.newsletterFollow("120363418888368871@newsletter");
DMS.newsletterFollow("120363379659429693@newsletter")
        }
    });

    DMS.ev.on('error', (err) => {
        console.error(chalk.red("Error: "), err.message || err);
    });

    DMS.ev.on('creds.update', saveCreds);
}
connectToWhatsApp();