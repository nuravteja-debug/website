const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chatHistoryService = require('./chatHistoryService');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.qrCodeDataUrl = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, INITIALIZING, QR_READY, AUTHENTICATED, READY
    this.userInfo = null;
    this.io = null;
    this.logs = [];
    this.maxLogs = 500;
    this.indiaOnly = process.env.RESTRICT_INDIA_ONLY !== 'false';
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.keepAliveTimer = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  setIndiaOnlyRestriction(enable) {
    this.indiaOnly = Boolean(enable);
  }

  // Detects Puppeteer "detached Frame" or "Session closed" errors
  isDetachedError(err) {
    const msg = err?.message || '';
    return (
      msg.includes('detached Frame') ||
      msg.includes('Session closed') ||
      msg.includes('Target closed') ||
      msg.includes('Protocol error') ||
      msg.includes('Execution context was destroyed')
    );
  }

  // Auto-reconnect after a detach/crash (keeps existing session)
  scheduleReconnect(delayMs = 5000) {
    if (this.isInitializing) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.addLog({ level: 'error', type: 'system', message: 'Max reconnect attempts reached. Please manually reconnect.' });
      return;
    }
    this.reconnectAttempts++;
    this.addLog({ level: 'warning', type: 'system', message: `Auto-reconnecting in ${delayMs / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})` });
    setTimeout(() => {
      this.initialize(false); // false = keep existing session, don't wipe QR
    }, delayMs);
  }

  // Start periodic keep-alive watchdog
  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(async () => {
      if (this.status !== 'READY' || !this.client) return;
      try {
        await this.client.getState();
      } catch (err) {
        console.error('Keep-alive check failed:', err.message);
        this.addLog({ level: 'warning', type: 'system', message: 'Keep-alive check failed — triggering reconnect.' });
        this.status = 'DISCONNECTED';
        this.emitState();
        this.scheduleReconnect(3000);
      }
    }, 30000); // check every 30 seconds
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  emitState() {
    if (this.io) {
      this.io.emit('whatsapp_status', {
        status: this.status,
        qrCode: this.qrCodeDataUrl,
        userInfo: this.userInfo,
        indiaOnly: this.indiaOnly
      });
    }
  }

  addLog(entry) {
    const log = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    if (this.io) {
      this.io.emit('new_log', log);
    }
    return log;
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
  }

  async initialize(forceCleanSession = false) {
    if (this.isInitializing) {
      console.log('WhatsApp client initialization already in progress. Skipping duplicate call...');
      return;
    }

    this.isInitializing = true;

    if (this.client) {
      console.log('Destroying existing client...');
      try {
        await this.client.destroy();
      } catch (err) {
        console.error('Error destroying existing client:', err.message);
      }
      this.client = null;
    }

    const sessionPath = process.env.SESSION_PATH || './data/session';

    if (forceCleanSession) {
      console.log('Force cleaning session directory for fresh QR code...');
      try {
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (e) {
        console.error('Failed cleaning session dir:', e.message);
      }
    }

    this.status = 'INITIALIZING';
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.emitState();
    this.addLog({ level: 'info', type: 'system', message: 'Initializing WhatsApp Web client engine...' });

    const dataDir = path.dirname(sessionPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 10000,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--safebrowsing-disable-auto-update',
          '--single-process'
        ],
        timeout: 60000
      }
    });

    // Event handlers
    this.client.on('qr', async (qr) => {
      console.log('⚡ QR Code generated! Ready for scanning.');
      this.status = 'QR_READY';
      this.isInitializing = false;
      try {
        this.qrCodeDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 8 });
      } catch (err) {
        console.error('Failed to generate QR Data URL:', err);
        this.qrCodeDataUrl = null;
      }
      this.emitState();
      this.addLog({ level: 'info', type: 'qr', message: 'New QR Code generated. Ready for scanning.' });
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Authenticated successfully');
      this.status = 'AUTHENTICATED';
      this.qrCodeDataUrl = null;
      this.emitState();
      this.addLog({ level: 'success', type: 'auth', message: 'WhatsApp Web authenticated successfully.' });
    });

    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp Auth failure:', msg);
      this.status = 'DISCONNECTED';
      this.qrCodeDataUrl = null;
      this.isInitializing = false;
      this.emitState();
      this.addLog({ level: 'error', type: 'auth', message: `Authentication failure: ${msg}` });
    });

    this.client.on('ready', async () => {
      console.log('WhatsApp Client is Ready!');
      this.status = 'READY';
      this.isInitializing = false;
      this.reconnectAttempts = 0; // reset on successful connect
      try {
        const info = this.client.info;
        this.userInfo = {
          number: info.wid.user,
          pushname: info.pushname || 'WhatsApp User',
          platform: info.platform
        };
      } catch (e) {
        this.userInfo = { number: 'Connected', pushname: 'WhatsApp User' };
      }
      this.emitState();
      this.addLog({
        level: 'success',
        type: 'system',
        message: `WhatsApp Web Ready! Connected as ${this.userInfo.pushname} (+${this.userInfo.number})`
      });
      this.startKeepAlive(); // begin watchdog
    });

    // Handle Incoming WhatsApp Messages for Real-Time Live Chat
    this.client.on('message', async (msg) => {
      try {
        const contact = await msg.getContact();
        const senderName = contact.pushname || contact.name || msg.from.replace('@c.us', '');
        const chatData = {
          id: msg.id._serialized,
          from: msg.from,
          senderName,
          body: msg.body,
          timestamp: msg.timestamp,
          hasMedia: msg.hasMedia,
          isGroup: msg.from.includes('@g.us')
        };

        // Persist to chat history
        chatHistoryService.addMessage({
          chatId: msg.from,
          contactName: senderName,
          fromMe: false,
          body: msg.body || '',
          mediaType: msg.hasMedia ? 'media' : null,
          timestamp: msg.timestamp
        });

        if (this.io) {
          this.io.emit('new_incoming_chat_message', chatData);
        }

        this.addLog({
          level: 'info',
          type: 'chat_receive',
          recipient: msg.from.replace('@c.us', ''),
          message: `Received message from ${senderName}: "${msg.body ? msg.body.substring(0, 50) : '[Media]'}"`
        });
      } catch (err) {
        console.error('Error handling incoming message event:', err);
      }
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp Client Disconnected:', reason);
      this.status = 'DISCONNECTED';
      this.qrCodeDataUrl = null;
      this.userInfo = null;
      this.isInitializing = false;
      this.stopKeepAlive();
      this.emitState();
      this.addLog({ level: 'warning', type: 'system', message: `Disconnected from WhatsApp Web: ${reason}` });

      // Auto-reconnect on unexpected disconnection
      if (reason !== 'LOGOUT') {
        this.scheduleReconnect(6000);
      }
    });

    try {
      await this.client.initialize();
    } catch (error) {
      console.error('Error starting WhatsApp Client:', error);
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
      this.emitState();
      this.addLog({ level: 'error', type: 'system', message: `Failed to start WhatsApp Client: ${error.message}` });
    }
  }

  formatPhoneNumber(phone) {
    if (!phone) return null;
    let sanitized = phone.toString().replace(/\D/g, '');
    if (!sanitized) return null;

    if (sanitized.endsWith('@g.us') || phone.endsWith('@g.us')) {
      return phone;
    }

    if (sanitized.endsWith('@c.us')) {
      sanitized = sanitized.replace('@c.us', '');
    }

    if (sanitized.length === 10 && /^[6-9]/.test(sanitized)) {
      sanitized = `91${sanitized}`;
    }

    if (this.indiaOnly) {
      if (!sanitized.startsWith('91')) {
        throw new Error(`Security Policy: Messaging is restricted to Indian (+91) phone numbers only. "${phone}" is invalid.`);
      }
    }

    return `${sanitized}@c.us`;
  }

  async sendMessage(to, message, file = null) {
    if (this.status !== 'READY' || !this.client) {
      throw new Error('WhatsApp client is not ready. Please scan QR code first.');
    }

    const chatId = this.formatPhoneNumber(to);
    if (!chatId) {
      throw new Error('Invalid phone number provided.');
    }

    try {
      // Skip the isRegisteredUser check — it can cause detached frame errors
      // and is not critical for sending

      let options = {};
      let media = null;

      if (file) {
        if (typeof file === 'string' && fs.existsSync(file)) {
          media = MessageMedia.fromFilePath(file);
        } else if (file.buffer && file.mimetype) {
          media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);
        } else if (file.mimetype && file.base64) {
          media = new MessageMedia(file.mimetype, file.base64, file.filename);
        }
      }

      let sentMsg;
      if (media && message) {
        options.caption = message;
        sentMsg = await this.client.sendMessage(chatId, media, options);
      } else if (media) {
        sentMsg = await this.client.sendMessage(chatId, media);
      } else {
        sentMsg = await this.client.sendMessage(chatId, message);
      }

      const sentTimestamp = sentMsg?.timestamp || Math.floor(Date.now() / 1000);

      // Persist sent message to chat history
      chatHistoryService.addMessage({
        chatId: to,
        contactName: to,
        fromMe: true,
        body: message || '',
        mediaType: file ? 'media' : null,
        timestamp: sentTimestamp
      });

      this.addLog({
        level: 'success',
        type: 'send',
        recipient: to,
        message: `Message sent to ${to}`,
        details: message ? message.substring(0, 100) : '[Media File]'
      });

      return {
        success: true,
        id: sentMsg?.id?._serialized || sentMsg?.id || uuidv4(),
        timestamp: sentTimestamp,
        to: chatId
      };
    } catch (error) {
      console.error(`Failed to send message to ${to}:`, error);

      // Handle detached frame / session crashed — auto-reconnect
      if (this.isDetachedError(error)) {
        this.addLog({
          level: 'warning',
          type: 'send',
          recipient: to,
          message: `WhatsApp session detached. Reconnecting automatically...`
        });
        this.status = 'DISCONNECTED';
        this.stopKeepAlive();
        this.emitState();
        this.scheduleReconnect(4000);
        throw new Error('WhatsApp session lost. Reconnecting automatically — please retry in a few seconds.');
      }

      this.addLog({
        level: 'error',
        type: 'send',
        recipient: to,
        message: `Failed sending to ${to}: ${error.message}`
      });
      throw error;
    }
  }

  async getChats() {
    if (this.status !== 'READY' || !this.client) {
      return [];
    }
    try {
      const chats = await this.client.getChats();
      return chats.slice(0, 30).map((c) => ({
        id: c.id._serialized,
        name: c.name || c.id.user,
        unreadCount: c.unreadCount,
        timestamp: c.timestamp,
        lastMessage: c.lastMessage ? c.lastMessage.body : '',
        isGroup: c.isGroup
      }));
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  }

  async getChatMessages(chatId, limit = 50) {
    if (this.status !== 'READY' || !this.client) {
      return [];
    }
    try {
      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      return messages.map((m) => ({
        id: m.id._serialized,
        fromMe: m.fromMe,
        body: m.body,
        timestamp: m.timestamp,
        hasMedia: m.hasMedia,
        author: m.author
      }));
    } catch (err) {
      console.error(`Error fetching messages for chat ${chatId}:`, err);
      return [];
    }
  }

  async logout() {
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.destroy();
      } catch (e) {
        console.error('Logout error:', e);
      }
      this.client = null;
      this.status = 'DISCONNECTED';
      this.qrCodeDataUrl = null;
      this.userInfo = null;
      this.isInitializing = false;
      this.emitState();
      this.addLog({ level: 'info', type: 'auth', message: 'Logged out of WhatsApp Web session.' });
    }
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      userInfo: this.userInfo,
      indiaOnly: this.indiaOnly
    };
  }
}

module.exports = new WhatsAppService();
