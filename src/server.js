const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const whatsappService = require('./services/whatsappService');
const campaignService = require('./services/campaignService');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Middleware JSON & URLEncoded body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Express Rate Limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

const scheduleService = require('./services/scheduleService');

// Pass Socket.IO to services
whatsappService.setSocketIO(io);
campaignService.setSocketIO(io);
scheduleService.setSocketIO(io);

// API Routes
app.use('/api/v1', apiRoutes);

// Static files for dashboard frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route to serve index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io Client Connections
io.on('connection', (socket) => {
  console.log('⚡ Web Client connected to Socket.io:', socket.id);

  // Send initial state immediately upon connection
  socket.emit('whatsapp_status', whatsappService.getStatus());
  socket.emit('all_logs', whatsappService.getLogs(50));
  socket.emit('all_campaigns', campaignService.getAllCampaigns());

  socket.on('disconnect', () => {
    console.log('Web Client disconnected:', socket.id);
  });
});

// Start Express Server
server.listen(PORT, () => {
  console.log(`
=====================================================
🚀 WhatsFlow - WhatsApp Web Automation & REST API
=====================================================
🌐 Dashboard UI : http://localhost:${PORT}
🔌 REST API     : http://localhost:${PORT}/api/v1
🔑 API Key      : ${process.env.API_KEY || '(None set)'}
=====================================================
  `);

  // Auto initialize WhatsApp Web on startup
  whatsappService.initialize();
});
