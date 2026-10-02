const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ApiKeyService {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'apikeys.json');
    this.keys = [];
    this.loadKeys();
  }

  loadKeys() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.keys = JSON.parse(data);
      } else {
        // Seed default initial key if needed
        const defaultKey = process.env.API_KEY || 'whatsflow_secret_key_12345';
        this.keys = [
          {
            id: 'key-master',
            label: 'Default Master Key',
            key: defaultKey,
            active: true,
            createdAt: new Date().toISOString()
          }
        ];
        this.saveKeys();
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
      this.keys = [];
    }
  }

  saveKeys() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.keys, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save API keys:', err);
    }
  }

  getAll() {
    return this.keys.map((k) => ({
      id: k.id,
      label: k.label,
      key: k.key,
      active: k.active,
      createdAt: k.createdAt
    }));
  }

  generateKey(label = 'API Key') {
    const randomHex = uuidv4().replace(/-/g, '');
    const keyString = `wf_live_${randomHex.substring(0, 24)}`;

    const newKey = {
      id: `key-${uuidv4().substring(0, 8)}`,
      label,
      key: keyString,
      active: true,
      createdAt: new Date().toISOString()
    };

    this.keys.unshift(newKey);
    this.saveKeys();
    return newKey;
  }

  isValidKey(keyString) {
    if (!keyString) return false;
    // Check against master .env key
    if (process.env.API_KEY && keyString === process.env.API_KEY) {
      return true;
    }
    const found = this.keys.find((k) => k.key === keyString && k.active === true);
    return !!found;
  }

  revokeKey(id) {
    const keyObj = this.keys.find((k) => k.id === id);
    if (keyObj) {
      keyObj.active = false;
      this.saveKeys();
      return true;
    }
    return false;
  }

  deleteKey(id) {
    const index = this.keys.findIndex((k) => k.id === id);
    if (index !== -1) {
      this.keys.splice(index, 1);
      this.saveKeys();
      return true;
    }
    return false;
  }
}

module.exports = new ApiKeyService();
