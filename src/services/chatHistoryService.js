const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ChatHistoryService {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'chat_history.json');
    this.history = {}; // keyed by chatId/phone
    this.loadHistory();
  }

  loadHistory() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.history = JSON.parse(raw);
      } else {
        this.history = {};
        this.saveHistory();
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      this.history = {};
    }
  }

  saveHistory() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.history, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save chat history:', err);
    }
  }

  /**
   * Record a sent or received message into persistent history.
   */
  addMessage({ chatId, contactName, fromMe, body, mediaType = null, timestamp = null }) {
    const id = chatId.replace('@c.us', '').replace('@g.us', '');
    if (!this.history[id]) {
      this.history[id] = {
        chatId: id,
        contactName: contactName || id,
        messages: []
      };
    }

    if (contactName && contactName !== id) {
      this.history[id].contactName = contactName;
    }

    const msg = {
      id: uuidv4(),
      fromMe: Boolean(fromMe),
      body: body || '',
      mediaType,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      savedAt: new Date().toISOString()
    };

    this.history[id].messages.push(msg);
    this.history[id].lastMessageAt = msg.savedAt;
    this.history[id].lastMessageBody = body ? body.substring(0, 80) : '[Media]';

    // Keep max 500 messages per chat
    if (this.history[id].messages.length > 500) {
      this.history[id].messages = this.history[id].messages.slice(-500);
    }

    this.saveHistory();
    return msg;
  }

  getAllChats() {
    return Object.values(this.history)
      .map((c) => ({
        chatId: c.chatId,
        contactName: c.contactName,
        lastMessageBody: c.lastMessageBody || '',
        lastMessageAt: c.lastMessageAt || '',
        messageCount: c.messages.length
      }))
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  }

  getChatMessages(chatId) {
    const id = chatId.replace('@c.us', '').replace('@g.us', '');
    if (!this.history[id]) return [];
    return this.history[id].messages;
  }

  clearChat(chatId) {
    const id = chatId.replace('@c.us', '').replace('@g.us', '');
    if (this.history[id]) {
      this.history[id].messages = [];
      this.history[id].lastMessageBody = '';
      this.history[id].lastMessageAt = new Date().toISOString();
      this.saveHistory();
      return true;
    }
    return false;
  }

  deleteChat(chatId) {
    const id = chatId.replace('@c.us', '').replace('@g.us', '');
    if (this.history[id]) {
      delete this.history[id];
      this.saveHistory();
      return true;
    }
    return false;
  }

  clearAllHistory() {
    this.history = {};
    this.saveHistory();
  }

  getStats() {
    const chats = Object.values(this.history);
    const totalMessages = chats.reduce((sum, c) => sum + c.messages.length, 0);
    const sentMessages = chats.reduce((sum, c) => sum + c.messages.filter((m) => m.fromMe).length, 0);
    const receivedMessages = totalMessages - sentMessages;
    return {
      totalChats: chats.length,
      totalMessages,
      sentMessages,
      receivedMessages
    };
  }
}

module.exports = new ChatHistoryService();
