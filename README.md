# WhatsFlow 💬⚡
> **Open-Source WhatsApp Web Automation Engine, Bulk Campaign Manager & REST API Gateway**

![License](https://img.shields.io/badge/license-MIT-emerald.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)

**WhatsFlow** is a powerful, production-ready open-source platform designed to automate sending WhatsApp Web messages. It features a modern, ultra-sleek dark-mode Web Dashboard UI, real-time WebSocket session management, bulk campaign dispatcher with anti-ban random delays, reusable template store, and an extensible REST API for seamless integration into Python, PHP, Node.js, C#, or Go applications.

---

## ✨ Features

- 🇮🇳 **India-Only (+91) Safeguard Policy**: Built-in validation restricting outbound WhatsApp messages strictly to Indian phone numbers (+91 / 10-digit mobile format).
- 🔑 **API Key Generator & Manager**: Create, list, copy, and revoke persistent API secret keys (`wf_live_...`) on demand from the dashboard.
- 💬 **Live WhatsApp Web Chat UI**: Interactive real-time conversation panel for viewing active contacts, reading incoming WhatsApp messages live, and sending instant chat replies.
- ⏰ **Future Message Scheduler**: Schedule WhatsApp messages for future delivery with an automated background worker.
- 📱 **Real-time WhatsApp Web Session Manager**: Instant QR code scanning & session persistence using `whatsapp-web.js` LocalAuth.
- 💬 **Direct Message Dispatcher**: Send formatted text, images, media attachments, and document files.
- 🚀 **Bulk Campaign Engine**:
  - Broadcast campaigns via CSV or bulk list import.
  - Dynamic template variables interpolation (e.g. `{name}`, `{order_id}`).
  - Built-in anti-ban safeguards: randomized throttle delays.
  - Live progress monitor with pause, resume, and cancel capabilities.
- 📋 **Reusable Template Store**: Save, organize, and insert message templates.
- ⚡ **Developer REST API**: High-performance REST API endpoints.
- 📜 **System Audit Terminal**: Streaming event logs and delivery receipts.
- 🎨 **Modern Glassmorphic UI**: Sleek dark mode dashboard built with vanilla CSS & HTML5, responsive on mobile and desktop.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.IO, `whatsapp-web.js`, Puppeteer
- **Frontend**: HTML5, Vanilla Modern CSS (Glassmorphism & CSS Grid/Flexbox), Socket.IO Client, JavaScript ES6+
- **Database/Storage**: File-system based state persistence (`LocalAuth` session directory + JSON template store)

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed on your system.

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/whatsflow.git
cd whatsflow
npm install
```

### 3. Configuration
Create a `.env` file in the project root (or copy from `.env.example`):

```env
PORT=3000
API_KEY=whatsflow_secret_key_12345
SESSION_PATH=./data/session
HEADLESS=true

DEFAULT_DELAY_MIN=3000
DEFAULT_DELAY_MAX=7000
```

### 4. Running the Server

Start in development mode (with auto-reload):
```bash
npm run dev
```

Or start in standard production mode:
```bash
npm start
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 📖 REST API Documentation

WhatsFlow exposes a RESTful API for external software integration.

### Authentication
If `API_KEY` is configured in your `.env`, pass the key in the request header:
```http
x-api-key: your_secret_api_key
```

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/status` | Get current WhatsApp Web connection state |
| `POST` | `/api/v1/connect` | Trigger WhatsApp client initialization / QR generation |
| `POST` | `/api/v1/logout` | Disconnect current WhatsApp Web session |
| `POST` | `/api/v1/send-message` | Send message or file attachment to a phone number |
| `POST` | `/api/v1/bulk-send` | Create and execute a bulk message campaign |
| `GET` | `/api/v1/campaigns` | List all active and past campaigns |
| `POST` | `/api/v1/campaigns/:id/pause` | Pause an in-progress campaign |
| `POST` | `/api/v1/campaigns/:id/resume` | Resume a paused campaign |
| `GET` | `/api/v1/templates` | List all saved message templates |
| `POST` | `/api/v1/templates` | Save a new message template |
| `GET` | `/api/v1/logs` | Fetch real-time system audit logs |

---

### Code Examples

#### Send Message via cURL
```bash
curl -X POST http://localhost:3000/api/v1/send-message \
  -H "Content-Type: application/json" \
  -H "x-api-key: whatsflow_secret_key_12345" \
  -d '{
    "to": "14155552671",
    "message": "Hello from WhatsFlow REST API!"
  }'
```

#### Send Message via Python
```python
import requests

url = "http://localhost:3000/api/v1/send-message"
headers = {
    "x-api-key": "whatsflow_secret_key_12345",
    "Content-Type": "application/json"
}
payload = {
    "to": "14155552671",
    "message": "Hello from Python automation!"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

#### Send Message via Node.js / Fetch
```javascript
const response = await fetch('http://localhost:3000/api/v1/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'whatsflow_secret_key_12345'
  },
  body: JSON.stringify({
    to: '14155552671',
    message: 'Hello from Node.js!'
  })
});
const data = await response.json();
console.log(data);
```

---

## 📂 Project Structure

```
whatsflow/
├── src/
│   ├── server.js               # Express & Socket.io server entrypoint
│   ├── routes/
│   │   └── api.js              # REST API routing logic & authentication
│   ├── services/
│   │   ├── whatsappService.js  # whatsapp-web.js engine integration & QR handler
│   │   ├── campaignService.js  # Bulk message campaign worker & rate limiter
│   │   └── templateService.js  # Template management and persistence logic
│   └── public/                 # Web Dashboard SPA static frontend
│       ├── index.html          # Dashboard markup
│       ├── css/
│       │   └── styles.css      # Dark mode glassmorphism UI styling
│       └── js/
│           └── app.js          # Client-side Socket.io & REST UI controller
├── data/                       # Persistent sessions, logs, and template store
├── .env.example                # Example environment variables
├── package.json                # Project dependencies and script definitions
├── LICENSE                     # MIT License
└── README.md                   # Project documentation
```

---

## 🛡️ Best Practices & Anti-Ban Tips

1. **Avoid Aggressive Spooling**: Keep `DEFAULT_DELAY_MIN` at 3000ms+ and `DEFAULT_DELAY_MAX` at 7000ms+. Sending 100s of messages per minute from a fresh WhatsApp number risks spam flagging.
2. **Use Template Variables**: Varying message content using dynamic variables (`{name}`, `{order_id}`) makes bulk messages unique and less prone to automated spam detection.
3. **Warm Up New Numbers**: Gradually increase your daily message volume when using new phone numbers.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the [Issues](https://github.com/your-username/whatsflow/issues) page.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more details.
