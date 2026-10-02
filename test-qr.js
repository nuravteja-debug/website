const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('Starting test WhatsApp client...');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './data/test-session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', (qr) => {
  console.log('✅ QR RECEIVED SUCCESSFULLY! ASCII QR:');
  console.log(qr);
  process.exit(0);
});

client.on('ready', () => {
  console.log('Ready event fired!');
  process.exit(0);
});

client.initialize().catch((err) => {
  console.error('Init error:', err);
  process.exit(1);
});
