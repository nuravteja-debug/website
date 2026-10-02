const express = require('express');
const router = express.Router();
const multer = require('multer');
const whatsappService = require('../services/whatsappService');
const campaignService = require('../services/campaignService');
const templateService = require('../services/templateService');
const apiKeyService = require('../services/apiKeyService');
const scheduleService = require('../services/scheduleService');
const chatHistoryService = require('../services/chatHistoryService');

// Multer memory storage for file uploads
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Middleware for API Key verification
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.body?.apiKey;

  if (apiKey && apiKeyService.isValidKey(apiKey)) {
    return next();
  }

  // Allow web dashboard requests from same host origin
  const referer = req.headers['referer'] || req.headers['origin'];
  const host = req.headers['host'];
  if (referer && host && (referer.includes(host) || referer.includes('localhost') || referer.includes('127.0.0.1'))) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing API key. Pass x-api-key header.'
  });
};

// Apply auth middleware to API routes
router.use(apiKeyAuth);

// --- Status & Settings Endpoints ---

router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: whatsappService.getStatus()
  });
});

router.post('/settings/india-only', (req, res) => {
  const { enable } = req.body;
  whatsappService.setIndiaOnlyRestriction(enable);
  res.json({
    success: true,
    indiaOnly: whatsappService.indiaOnly,
    message: `India (+91) restriction policy is now ${whatsappService.indiaOnly ? 'ENABLED' : 'DISABLED'}.`
  });
});

router.post('/connect', async (req, res) => {
  try {
    const { clean } = req.body || {};
    whatsappService.initialize(Boolean(clean));
    res.json({
      success: true,
      message: 'Initialization started. Fetch status or QR code shortly.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset-session', async (req, res) => {
  try {
    whatsappService.initialize(true);
    res.json({
      success: true,
      message: 'Old session files wiped. Generating a fresh QR code...'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    await whatsappService.logout();
    res.json({
      success: true,
      message: 'Successfully logged out WhatsApp Web session.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Message Sending Endpoints ---

router.post('/send-message', upload.single('file'), async (req, res) => {
  try {
    const { to, message } = req.body;
    const file = req.file;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient phone number ("to") is required.' });
    }

    if (!message && !file) {
      return res.status(400).json({ success: false, error: 'Either "message" or "file" must be provided.' });
    }

    const result = await whatsappService.sendMessage(to, message, file);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- Live Chat Endpoints ---

router.get('/chats', async (req, res) => {
  try {
    const chats = await whatsappService.getChats();
    res.json({ success: true, data: chats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const messages = await whatsappService.getChatMessages(req.params.chatId, limit);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/chats/:chatId/send', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await whatsappService.sendMessage(req.params.chatId, message);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Scheduled Messages Endpoints ---

router.get('/scheduled', (req, res) => {
  res.json({ success: true, data: scheduleService.getAll() });
});

router.post('/scheduled', (req, res) => {
  try {
    const job = scheduleService.createSchedule(req.body);
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/scheduled/:id', (req, res) => {
  const success = scheduleService.cancelSchedule(req.params.id);
  res.json({ success, message: success ? 'Scheduled message cancelled.' : 'Could not cancel job.' });
});

// --- API Keys Management Endpoints ---

router.get('/keys', (req, res) => {
  res.json({ success: true, data: apiKeyService.getAll() });
});

router.post('/keys', (req, res) => {
  const { label } = req.body;
  const newKey = apiKeyService.generateKey(label || 'Dashboard Key');
  res.json({ success: true, data: newKey });
});

router.delete('/keys/:id', (req, res) => {
  const success = apiKeyService.deleteKey(req.params.id);
  res.json({ success });
});

// --- Bulk Campaign Endpoints ---

router.post('/bulk-send', upload.single('file'), async (req, res) => {
  try {
    let { name, template, recipients, delayMin, delayMax } = req.body;

    if (typeof recipients === 'string') {
      try {
        recipients = JSON.parse(recipients);
      } catch (e) {
        recipients = recipients
          .split(/[\n,]+/)
          .map((n) => n.trim())
          .filter(Boolean);
      }
    }

    const mediaFile = req.file || null;

    const result = await campaignService.createAndStartCampaign({
      name,
      template,
      recipients,
      delayMin,
      delayMax,
      mediaFile
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/campaigns', (req, res) => {
  res.json({
    success: true,
    data: campaignService.getAllCampaigns()
  });
});

router.get('/campaigns/:id', (req, res) => {
  const campaign = campaignService.getCampaign(req.params.id);
  if (!campaign) {
    return res.status(404).json({ success: false, error: 'Campaign not found.' });
  }
  res.json({ success: true, data: campaign });
});

router.post('/campaigns/:id/pause', (req, res) => {
  const success = campaignService.pauseCampaign(req.params.id);
  res.json({ success, message: success ? 'Campaign paused.' : 'Could not pause campaign.' });
});

router.post('/campaigns/:id/resume', (req, res) => {
  const success = campaignService.resumeCampaign(req.params.id);
  res.json({ success, message: success ? 'Campaign resumed.' : 'Could not resume campaign.' });
});

router.post('/campaigns/:id/cancel', (req, res) => {
  const success = campaignService.cancelCampaign(req.params.id);
  res.json({ success, message: success ? 'Campaign cancelled.' : 'Could not cancel campaign.' });
});

// --- Template Endpoints ---

router.get('/templates', (req, res) => {
  res.json({
    success: true,
    data: templateService.getAll()
  });
});

router.post('/templates', (req, res) => {
  try {
    const template = templateService.create(req.body);
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/templates/:id', (req, res) => {
  try {
    const template = templateService.update(req.params.id, req.body);
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/templates/:id', (req, res) => {
  const success = templateService.delete(req.params.id);
  res.json({ success });
});

// --- System Audit Logs ---

router.get('/logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 100;
  res.json({
    success: true,
    data: whatsappService.getLogs(limit)
  });
});

router.post('/logs/clear', (req, res) => {
  whatsappService.clearLogs();
  res.json({ success: true, message: 'Logs cleared.' });
});

// --- Chat History Endpoints ---

router.get('/history', (req, res) => {
  res.json({ success: true, data: chatHistoryService.getAllChats() });
});

router.get('/history/stats', (req, res) => {
  res.json({ success: true, data: chatHistoryService.getStats() });
});

router.get('/history/:chatId/messages', (req, res) => {
  const messages = chatHistoryService.getChatMessages(req.params.chatId);
  res.json({ success: true, data: messages });
});

router.post('/history/:chatId/clear', (req, res) => {
  const success = chatHistoryService.clearChat(req.params.chatId);
  res.json({ success, message: success ? 'Chat messages cleared.' : 'Chat not found.' });
});

router.delete('/history/:chatId', (req, res) => {
  const success = chatHistoryService.deleteChat(req.params.chatId);
  res.json({ success, message: success ? 'Chat deleted.' : 'Chat not found.' });
});

router.delete('/history', (req, res) => {
  chatHistoryService.clearAllHistory();
  res.json({ success: true, message: 'All chat history cleared.' });
});

module.exports = router;
