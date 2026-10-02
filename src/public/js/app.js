// WhatsFlow Frontend Controller
const socket = io();

// UI Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

// Status Widgets
const sidebarStatusDot = document.getElementById('sidebar-status-dot');
const sidebarStatusText = document.getElementById('sidebar-status-text');
const sidebarUserText = document.getElementById('sidebar-user-text');
const headerConnectBtn = document.getElementById('header-connect-btn');
const toggleIndiaOnly = document.getElementById('toggle-india-only');
const indiaBadge = document.getElementById('india-badge');

const qrImage = document.getElementById('qr-image');
const qrSpinner = document.getElementById('qr-spinner');
const userInfoCard = document.getElementById('user-info-card');
const userPushname = document.getElementById('user-pushname');
const userPhone = document.getElementById('user-phone');

const btnReconnect = document.getElementById('btn-reconnect');
const btnLogout = document.getElementById('btn-logout');

// Overview Stats
const statSentCount = document.getElementById('stat-sent-count');
const statScheduleCount = document.getElementById('stat-schedule-count');
const statKeyCount = document.getElementById('stat-key-count');
const statStatusVal = document.getElementById('stat-status-val');

// Chat UI State
let activeChatId = null;
let activeChatName = '';
let templatesList = [];
let totalSentCounter = 0;
let currentStatus = 'DISCONNECTED';

// Tab Titles
const tabTitles = {
  'tab-overview': { title: 'Dashboard Overview', subtitle: 'Real-time performance and system analytics' },
  'tab-qr': { title: 'WhatsApp Web QR Session', subtitle: 'Pair your WhatsApp account via QR scanner' },
  'tab-chat': { title: 'Live Chat Interface', subtitle: 'Read incoming messages and send instant chat replies' },
  'tab-send': { title: 'Direct Message Dispatcher', subtitle: 'Send instant messages or files to individual numbers' },
  'tab-schedule': { title: 'Schedule Future Messages', subtitle: 'Set messages to be delivered automatically at a future time' },
  'tab-bulk': { title: 'Bulk Campaign Runner', subtitle: 'Schedule and dispatch broadcast campaigns safely' },
  'tab-keys': { title: 'API Key Generator', subtitle: 'Generate and manage API keys for external software integration' },
  'tab-templates': { title: 'Message Template Library', subtitle: 'Manage reusable message layouts with dynamic placeholders' },
  'tab-api': { title: 'REST API Developer Hub', subtitle: 'Integrate WhatsApp messaging into your own applications' },
  'tab-logs': { title: 'System Audit Logs', subtitle: 'Live streaming event history and error diagnostics' },
  'tab-history': { title: 'Chat History', subtitle: 'Persistent record of all sent & received WhatsApp messages' }
};

// Navigation Switching
function switchTab(tabId) {
  navItems.forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  tabPanes.forEach((pane) => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabTitles[tabId]) {
    pageTitle.textContent = tabTitles[tabId].title;
    pageSubtitle.textContent = tabTitles[tabId].subtitle;
  }

  if (tabId === 'tab-chat') loadChats();
  if (tabId === 'tab-keys') loadApiKeys();
  if (tabId === 'tab-schedule') loadScheduledJobs();
  if (tabId === 'tab-history') loadHistory();
}

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    switchTab(item.getAttribute('data-tab'));
  });
});

// Socket.io Handlers
socket.on('whatsapp_status', (data) => {
  updateStatusUI(data);
});

socket.on('new_log', (log) => {
  appendLog(log);
});

socket.on('all_logs', (logs) => {
  const fullLogTerminal = document.getElementById('full-log-terminal');
  const overviewLogsList = document.getElementById('overview-logs-list');
  if (fullLogTerminal) fullLogTerminal.innerHTML = '';
  if (overviewLogsList) overviewLogsList.innerHTML = '';
  logs.forEach((log) => appendLog(log));
});

socket.on('campaign_progress', (campaign) => {
  renderCampaignProgress(campaign);
});

socket.on('scheduled_jobs_update', (jobs) => {
  renderScheduledJobs(jobs);
});

socket.on('new_incoming_chat_message', (msg) => {
  if (activeChatId && activeChatId === msg.from) {
    appendChatMessage({
      fromMe: false,
      body: msg.body,
      timestamp: msg.timestamp
    });
  }
  loadChats();
});

// Update Connection & India Restriction UI
function updateStatusUI(data) {
  currentStatus = data.status || 'DISCONNECTED';
  statStatusVal.textContent = currentStatus;

  if (toggleIndiaOnly && data.indiaOnly !== undefined) {
    toggleIndiaOnly.checked = data.indiaOnly;
    indiaBadge.style.display = data.indiaOnly ? 'inline-block' : 'none';
  }

  sidebarStatusDot.className = 'status-indicator ' + currentStatus.toLowerCase();
  sidebarStatusText.textContent = currentStatus;

  if (currentStatus === 'READY') {
    sidebarStatusDot.className = 'status-indicator ready';
    sidebarUserText.textContent = data.userInfo ? `+${data.userInfo.number}` : 'Connected';

    qrSpinner.style.display = 'none';
    qrImage.style.display = 'none';
    userInfoCard.style.display = 'flex';
    btnLogout.style.display = 'inline-flex';

    if (data.userInfo) {
      userPushname.textContent = data.userInfo.pushname || 'WhatsApp User';
      userPhone.textContent = `+${data.userInfo.number}`;
    }

    headerConnectBtn.textContent = '✅ Connected';
    headerConnectBtn.style.background = 'rgba(16, 185, 129, 0.2)';
    headerConnectBtn.style.color = '#10b981';

    document.getElementById('overview-conn-title').textContent = 'WhatsApp Web Connected';
    document.getElementById('overview-conn-desc').textContent = `Active session ready as ${data.userInfo?.pushname || 'User'}`;
  } else if (currentStatus === 'QR_READY' && data.qrCode) {
    sidebarStatusDot.className = 'status-indicator qr';
    sidebarUserText.textContent = 'Scan QR Code';

    qrSpinner.style.display = 'none';
    qrImage.style.display = 'block';
    qrImage.src = data.qrCode;
    userInfoCard.style.display = 'none';
    btnLogout.style.display = 'none';

    headerConnectBtn.textContent = '📱 Scan QR';
    headerConnectBtn.style.background = 'rgba(245, 158, 11, 0.2)';
    headerConnectBtn.style.color = '#f59e0b';
  } else {
    sidebarStatusDot.className = 'status-indicator disconnected';
    sidebarUserText.textContent = 'No session';

    qrSpinner.style.display = 'block';
    qrSpinner.textContent = currentStatus === 'INITIALIZING' ? 'Starting engine & generating QR...' : 'Click Connect to scan QR';
    qrImage.style.display = 'none';
    userInfoCard.style.display = 'none';
    btnLogout.style.display = 'none';

    headerConnectBtn.textContent = '⚡ Connect Session';
    headerConnectBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    headerConnectBtn.style.color = '#fff';
  }
}

// Toggle India-Only Setting
if (toggleIndiaOnly) {
  toggleIndiaOnly.addEventListener('change', async (e) => {
    try {
      await fetch('/api/v1/settings/india-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: e.target.checked })
      });
      indiaBadge.style.display = e.target.checked ? 'inline-block' : 'none';
    } catch (err) {
      console.error('Failed toggling India policy:', err);
    }
  });
}

// Append Audit Log
function appendLog(log) {
  if (log.type === 'send' && log.level === 'success') {
    totalSentCounter++;
    statSentCount.textContent = totalSentCounter;
  }

  const logHtml = `
    <div class="log-item">
      <span class="log-time">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
      <span class="log-tag ${log.level}">${log.type || log.level}</span>
      <span>${log.message} ${log.details ? `(${log.details})` : ''}</span>
    </div>
  `;

  const fullLogTerminal = document.getElementById('full-log-terminal');
  const overviewLogsList = document.getElementById('overview-logs-list');

  if (fullLogTerminal) fullLogTerminal.insertAdjacentHTML('afterbegin', logHtml);
  if (overviewLogsList) overviewLogsList.insertAdjacentHTML('afterbegin', logHtml);
}

function clearLogsUI() {
  document.getElementById('full-log-terminal').innerHTML = '';
}

// Session Reconnect & Logout
headerConnectBtn.addEventListener('click', () => {
  if (currentStatus !== 'READY') {
    switchTab('tab-qr');
    triggerConnect();
  }
});

btnReconnect.addEventListener('click', async () => {
  if (confirm('Generate a fresh WhatsApp QR Code?')) {
    try {
      await fetch('/api/v1/reset-session', { method: 'POST' });
    } catch (err) {
      console.error('Failed reset session:', err);
    }
  }
});
btnLogout.addEventListener('click', async () => {
  if (confirm('Are you sure you want to logout of WhatsApp Web?')) {
    await fetch('/api/v1/logout', { method: 'POST' });
  }
});

async function triggerConnect() {
  try {
    await fetch('/api/v1/connect', { method: 'POST' });
  } catch (err) {
    console.error('Failed trigger connect:', err);
  }
}

// --- LIVE CHAT INTERFACE LOGIC ---

async function loadChats() {
  const container = document.getElementById('chats-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/v1/chats');
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      if (result.data.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">No active chats found.</p>';
        return;
      }
      container.innerHTML = result.data
        .map(
          (c) => `
        <div class="chat-contact-item ${activeChatId === c.id ? 'active' : ''}" onclick="selectChat('${c.id}', '${c.name.replace(/'/g, "\\'")}')" style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-glass); cursor: pointer; transition: background 0.2s;">
          <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.9rem;">
            <span>${c.name}</span>
            ${c.unreadCount ? `<span class="brand-badge">${c.unreadCount}</span>` : ''}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${c.lastMessage || 'Click to view messages'}
          </div>
        </div>
      `
        )
        .join('');
    }
  } catch (err) {
    container.innerHTML = `<p style="padding:1rem; color:var(--accent-rose);">Error loading chats: ${err.message}</p>`;
  }
}

async function selectChat(chatId, name) {
  activeChatId = chatId;
  activeChatName = name;
  document.getElementById('chat-thread-title').textContent = name;
  document.getElementById('chat-thread-sub').textContent = chatId;
  document.getElementById('chat-input-msg').disabled = false;
  document.getElementById('btn-chat-send').disabled = false;

  loadChats(); // refresh list active state

  const container = document.getElementById('chat-messages-container');
  container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin: auto;">Loading chat messages...</p>';

  try {
    const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}/messages`);
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      container.innerHTML = '';
      result.data.forEach((m) => appendChatMessage(m));
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--accent-rose);">Failed to load messages: ${err.message}</p>`;
  }
}

function appendChatMessage(m) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const isMe = m.fromMe;
  const bubble = document.createElement('div');
  bubble.style.cssText = `
    max-width: 70%;
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius-md);
    font-size: 0.88rem;
    line-height: 1.4;
    align-self: ${isMe ? 'flex-end' : 'flex-start'};
    background: ${isMe ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(255,255,255,0.08)'};
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  bubble.innerHTML = `
    <div>${m.body || '[Media Attachment]'}</div>
    <div style="font-size: 0.68rem; opacity: 0.7; text-align: right; margin-top: 4px;">
      ${m.timestamp ? new Date(m.timestamp * 1000).toLocaleTimeString() : ''}
    </div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// Live Chat Send Form
const formChatSend = document.getElementById('form-chat-send');
if (formChatSend) {
  formChatSend.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeChatId) return;
    const input = document.getElementById('chat-input-msg');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    appendChatMessage({ fromMe: true, body: msg, timestamp: Date.now() / 1000 });

    try {
      await fetch(`/api/v1/chats/${encodeURIComponent(activeChatId)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
    } catch (err) {
      alert(`Failed to send message: ${err.message}`);
    }
  });
}

// --- API KEYS GENERATOR MANAGEMENT ---

async function loadApiKeys() {
  const tbody = document.getElementById('api-keys-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/v1/keys');
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      statKeyCount.textContent = result.data.length;
      tbody.innerHTML = result.data
        .map(
          (k) => `
        <tr>
          <td><strong>${k.label}</strong></td>
          <td><code style="background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; font-size:0.8rem; color:#a7f3d0;">${k.key}</code></td>
          <td>${new Date(k.createdAt).toLocaleDateString()}</td>
          <td><span class="log-tag ${k.active ? 'success' : 'error'}">${k.active ? 'ACTIVE' : 'REVOKED'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${k.key}')">📋 Copy</button>
            <button class="btn btn-danger btn-sm" onclick="deleteApiKey('${k.id}')">🗑️ Delete</button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--accent-rose);">Error loading API keys: ${err.message}</td></tr>`;
  }
}

async function showGenerateKeyModal() {
  const label = prompt('Enter a label for this new API key (e.g. Python Backend Service):');
  if (!label) return;

  try {
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    });
    const result = await res.json();
    if (result.success) {
      alert(`API Key Generated Successfully!\n\nKey: ${result.data.key}`);
      loadApiKeys();
    }
  } catch (err) {
    alert(`Failed generating key: ${err.message}`);
  }
}

async function deleteApiKey(id) {
  if (confirm('Delete this API Key? External applications using it will be denied access.')) {
    await fetch(`/api/v1/keys/${id}`, { method: 'DELETE' });
    loadApiKeys();
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert('API Key copied to clipboard!');
}

// --- SCHEDULED FUTURE MESSAGES LOGIC ---

async function loadScheduledJobs() {
  try {
    const res = await fetch('/api/v1/scheduled');
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      renderScheduledJobs(result.data);
    }
  } catch (err) {
    console.error('Failed loading scheduled jobs:', err);
  }
}

function renderScheduledJobs(jobs) {
  const container = document.getElementById('scheduled-queue-container');
  if (!container) return;

  statScheduleCount.textContent = jobs.filter((j) => j.status === 'PENDING').length;

  if (jobs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No scheduled messages in queue.</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Recipient</th>
          <th>Scheduled Time</th>
          <th>Message Preview</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${jobs
          .map(
            (j) => `
          <tr>
            <td><strong>${j.to}</strong></td>
            <td>${new Date(j.scheduledAt).toLocaleString()}</td>
            <td>${j.message.substring(0, 40)}...</td>
            <td><span class="log-tag ${j.status === 'PENDING' ? 'info' : j.status === 'COMPLETED' ? 'success' : 'error'}">${j.status}</span></td>
            <td>
              ${j.status === 'PENDING' ? `<button class="btn btn-danger btn-sm" onclick="cancelScheduledJob('${j.id}')">Cancel</button>` : '-'}
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

const formSchedule = document.getElementById('form-schedule');
if (formSchedule) {
  formSchedule.addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = document.getElementById('sched-phone').value;
    const scheduledAt = document.getElementById('sched-datetime').value;
    const message = document.getElementById('sched-message').value;

    try {
      const res = await fetch('/api/v1/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, scheduledAt, message })
      });
      const result = await res.json();
      if (result.success) {
        alert('Future WhatsApp message scheduled successfully!');
        document.getElementById('sched-phone').value = '';
        document.getElementById('sched-message').value = '';
        loadScheduledJobs();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert(`Failed to schedule message: ${err.message}`);
    }
  });
}

async function cancelScheduledJob(id) {
  if (confirm('Cancel this scheduled message?')) {
    await fetch(`/api/v1/scheduled/${id}`, { method: 'DELETE' });
    loadScheduledJobs();
  }
}

// --- DIRECT SEND FORM ---
const formSendDirect = document.getElementById('form-send-direct');
formSendDirect.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('send-phone').value;
  const message = document.getElementById('send-message').value;
  const fileInput = document.getElementById('send-file');
  const submitBtn = document.getElementById('btn-submit-direct');

  if (!phone) return alert('Please enter recipient phone number.');

  const formData = new FormData();
  formData.append('to', phone);
  formData.append('message', message);
  if (fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Sending Message...';

  try {
    const res = await fetch('/api/v1/send-message', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (result.success) {
      alert(`Message successfully sent to ${phone}!`);
      document.getElementById('send-message').value = '';
      fileInput.value = '';
    } else {
      alert(`Error sending message: ${result.error}`);
    }
  } catch (err) {
    alert(`Failed to send request: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Send Message Now';
  }
});

// --- BULK CAMPAIGN FORM ---
const formBulkCampaign = document.getElementById('form-bulk-campaign');
formBulkCampaign.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('bulk-name').value;
  const template = document.getElementById('bulk-template').value;
  const recipientsRaw = document.getElementById('bulk-recipients-text').value;
  const delayMin = document.getElementById('bulk-delay-min').value;
  const delayMax = document.getElementById('bulk-delay-max').value;

  if (!recipientsRaw) return alert('Please enter recipient numbers.');

  let recipients = [];
  const lines = recipientsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines[0].includes(',')) {
    const headers = lines[0].split(',').map((h) => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((r) => r.trim());
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] || '';
      });
      recipients.push(obj);
    }
  } else {
    recipients = lines;
  }

  try {
    const res = await fetch('/api/v1/bulk-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, template, recipients, delayMin, delayMax })
    });
    const result = await res.json();
    if (result.success) {
      alert(`Campaign "${name}" launched successfully!`);
      document.getElementById('bulk-name').value = '';
      document.getElementById('bulk-recipients-text').value = '';
    } else {
      alert(`Failed to create campaign: ${result.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
});

function renderCampaignProgress(campaign) {
  const container = document.getElementById('campaign-monitor-container');
  let card = document.getElementById(`campaign-card-${campaign.id}`);

  if (!card) {
    card = document.createElement('div');
    card.id = `campaign-card-${campaign.id}`;
    card.className = 'glass-panel';
    card.style.marginBottom = '1rem';
    container.prepend(card);
  }

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h4 style="font-size: 1rem; font-weight: 700;">${campaign.name}</h4>
      <span class="log-tag ${campaign.status === 'RUNNING' ? 'info' : campaign.status === 'COMPLETED' ? 'success' : 'warning'}">
        ${campaign.status}
      </span>
    </div>
    <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
      <span>Sent: <strong style="color:var(--accent-green);">${campaign.sent}</strong></span>
      <span>Failed: <strong style="color:var(--accent-rose);">${campaign.failed}</strong></span>
      <span>Total: <strong>${campaign.total}</strong></span>
    </div>
    <div class="progress-container">
      <div class="progress-bar" style="width: ${campaign.progressPercent}%;"></div>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
      <span style="font-size: 0.78rem; color: var(--text-dim);">${campaign.progressPercent}% Completed</span>
      <div style="display: flex; gap: 0.4rem;">
        ${campaign.status === 'RUNNING' ? `<button class="btn btn-secondary btn-sm" onclick="pauseCampaign('${campaign.id}')">Pause</button>` : ''}
        ${campaign.status === 'PAUSED' ? `<button class="btn btn-primary btn-sm" onclick="resumeCampaign('${campaign.id}')">Resume</button>` : ''}
        ${campaign.status !== 'COMPLETED' && campaign.status !== 'CANCELLED' ? `<button class="btn btn-danger btn-sm" onclick="cancelCampaign('${campaign.id}')">Cancel</button>` : ''}
      </div>
    </div>
  `;
}

async function pauseCampaign(id) { await fetch(`/api/v1/campaigns/${id}/pause`, { method: 'POST' }); }
async function resumeCampaign(id) { await fetch(`/api/v1/campaigns/${id}/resume`, { method: 'POST' }); }
async function cancelCampaign(id) { await fetch(`/api/v1/campaigns/${id}/cancel`, { method: 'POST' }); }

// --- TEMPLATES LOGIC ---
async function loadTemplates() {
  try {
    const res = await fetch('/api/v1/templates');
    const result = await res.json();
    if (result.success) {
      templatesList = result.data;
      renderTemplates();
      updateTemplateDropdowns();
    }
  } catch (e) {
    console.error('Failed to load templates:', e);
  }
}

function renderTemplates() {
  const container = document.getElementById('templates-grid');
  if (!container) return;

  container.innerHTML = templatesList
    .map(
      (t) => `
    <div class="stat-card" style="flex-direction: column; align-items: flex-start;">
      <div style="display: flex; justify-content: space-between; width: 100%; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.5rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700;">${t.title}</h4>
        <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${t.id}')">🗑️</button>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">${t.content}</p>
      <button class="btn btn-secondary btn-sm" style="margin-top: 0.75rem; width: 100%;" onclick="useTemplate('${t.id}')">Use in Direct Message</button>
    </div>
  `
    )
    .join('');
}

function updateTemplateDropdowns() {
  const select = document.getElementById('send-template-select');
  if (!select) return;
  select.innerHTML = '<option value="">Insert Template...</option>';
  templatesList.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.content;
    opt.textContent = t.title;
    select.appendChild(opt);
  });

  select.onchange = (e) => {
    if (e.target.value) {
      document.getElementById('send-message').value = e.target.value;
    }
  };
}

function useTemplate(id) {
  const tmpl = templatesList.find((t) => t.id === id);
  if (tmpl) {
    switchTab('tab-send');
    document.getElementById('send-message').value = tmpl.content;
  }
}

async function showCreateTemplateModal() {
  const title = prompt('Enter Template Title:');
  if (!title) return;
  const content = prompt('Enter Template Message Content (use placeholders like {name}):');
  if (!content) return;

  try {
    const res = await fetch('/api/v1/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    const result = await res.json();
    if (result.success) {
      loadTemplates();
    }
  } catch (err) {
    alert(`Failed to save template: ${err.message}`);
  }
}

async function deleteTemplate(id) {
  if (confirm('Delete this template?')) {
    await fetch(`/api/v1/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  }
}

// Initial Loads
loadTemplates();
loadApiKeys();

// ============================================================
// --- CHAT HISTORY PAGE ---
// ============================================================

let historyAllChats = [];
let activeHistoryChatId = null;

async function loadHistory() {
  try {
    // Load stats
    const statsRes = await fetch('/api/v1/history/stats');
    const statsData = await statsRes.json();
    if (statsData.success) {
      document.getElementById('hist-stat-chats').textContent = statsData.data.totalChats;
      document.getElementById('hist-stat-total').textContent = statsData.data.totalMessages;
      document.getElementById('hist-stat-sent').textContent = statsData.data.sentMessages;
      document.getElementById('hist-stat-recv').textContent = statsData.data.receivedMessages;
    }

    // Load chat list
    const res = await fetch('/api/v1/history');
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      historyAllChats = result.data;
      renderHistoryContacts(historyAllChats);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistoryContacts(chats) {
  const container = document.getElementById('hist-contacts-list');
  if (!container) return;

  if (chats.length === 0) {
    container.innerHTML = '<p style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">No chat history yet. Messages you send and receive will appear here automatically.</p>';
    return;
  }

  container.innerHTML = chats.map((c) => {
    const isActive = activeHistoryChatId === c.chatId;
    const lastTime = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `
      <div class="hist-contact-item ${isActive ? 'hist-active' : ''}" onclick="selectHistoryChat('${c.chatId}', '${(c.contactName || c.chatId).replace(/'/g, "\\'")}')"
        style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-glass); cursor: pointer; transition: background 0.18s; display: flex; align-items: center; gap: 0.75rem;
               background: ${isActive ? 'rgba(16,185,129,0.12)' : 'transparent'};"
        onmouseover="if('${c.chatId}'!==activeHistoryChatId)this.style.background='rgba(255,255,255,0.04)';"
        onmouseout="if('${c.chatId}'!==activeHistoryChatId)this.style.background='transparent';">
        <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #6366f1); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem; flex-shrink:0;">
          ${(c.contactName || c.chatId).charAt(0).toUpperCase()}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.contactName || c.chatId}</span>
            <span style="font-size:0.72rem; color:var(--text-dim); white-space:nowrap; margin-left:0.5rem;">${lastTime}</span>
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">
            ${c.lastMessageBody || 'No messages'}
          </div>
          <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">${c.messageCount} messages</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterHistoryChats(query) {
  const q = query.toLowerCase();
  const filtered = historyAllChats.filter(
    (c) => (c.contactName || '').toLowerCase().includes(q) || c.chatId.toLowerCase().includes(q)
  );
  renderHistoryContacts(filtered);
}

async function selectHistoryChat(chatId, name) {
  activeHistoryChatId = chatId;
  document.getElementById('hist-thread-name').textContent = name;
  document.getElementById('hist-thread-sub').textContent = `+${chatId}`;
  document.getElementById('hist-thread-actions').style.display = 'flex';

  // Re-render sidebar to highlight active
  renderHistoryContacts(historyAllChats);

  const area = document.getElementById('hist-messages-area');
  area.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin:auto;">Loading messages...</p>';

  try {
    const res = await fetch(`/api/v1/history/${encodeURIComponent(chatId)}/messages`);
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      renderHistoryMessages(result.data);
    }
  } catch (err) {
    area.innerHTML = `<p style="color:var(--accent-rose); text-align:center;">Failed to load: ${err.message}</p>`;
  }
}

function renderHistoryMessages(messages) {
  const area = document.getElementById('hist-messages-area');
  if (!messages || messages.length === 0) {
    area.innerHTML = '<div style="text-align:center; margin:auto; color:var(--text-muted);"><p>No messages in this chat yet.</p></div>';
    return;
  }

  // Group messages by date
  let lastDate = '';
  area.innerHTML = '';

  messages.forEach((m) => {
    const dateObj = new Date(m.timestamp * 1000);
    const dateLabel = dateObj.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Date separator
    if (dateLabel !== lastDate) {
      lastDate = dateLabel;
      const sep = document.createElement('div');
      sep.style.cssText = 'text-align:center; margin: 0.75rem 0;';
      sep.innerHTML = `<span style="background:rgba(255,255,255,0.07); color:var(--text-muted); font-size:0.72rem; padding:4px 14px; border-radius:12px;">${dateLabel}</span>`;
      area.appendChild(sep);
    }

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 68%;
      padding: 0.6rem 0.9rem 0.4rem;
      border-radius: ${m.fromMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
      font-size: 0.88rem;
      line-height: 1.45;
      align-self: ${m.fromMe ? 'flex-end' : 'flex-start'};
      background: ${m.fromMe ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(255,255,255,0.1)'};
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      word-break: break-word;
      position: relative;
    `;
    const mediaIcon = m.mediaType ? '<span style="font-size:0.8rem; opacity:0.8;"> 📎 [Media]</span>' : '';
    bubble.innerHTML = `
      <div>${m.body ? m.body.replace(/\n/g, '<br>') : ''}${mediaIcon}</div>
      <div style="font-size:0.65rem; opacity:0.7; text-align:right; margin-top:4px; display:flex; justify-content:flex-end; gap:4px; align-items:center;">
        ${timeStr}
        ${m.fromMe ? '<span style="color:#a7f3d0;">✓✓</span>' : ''}
      </div>
    `;
    area.appendChild(bubble);
  });

  area.scrollTop = area.scrollHeight;
}

async function clearHistoryChat() {
  if (!activeHistoryChatId) return;
  if (!confirm('Clear all messages in this chat from local history? This cannot be undone.')) return;

  try {
    await fetch(`/api/v1/history/${encodeURIComponent(activeHistoryChatId)}/clear`, { method: 'POST' });
    document.getElementById('hist-messages-area').innerHTML =
      '<div style="text-align:center; margin:auto; color:var(--text-muted);"><p>Chat cleared.</p></div>';
    loadHistory();
  } catch (err) {
    alert('Failed to clear chat: ' + err.message);
  }
}

async function deleteHistoryChat() {
  if (!activeHistoryChatId) return;
  if (!confirm('Permanently delete this entire chat from history?')) return;

  try {
    await fetch(`/api/v1/history/${encodeURIComponent(activeHistoryChatId)}`, { method: 'DELETE' });
    activeHistoryChatId = null;
    document.getElementById('hist-thread-name').textContent = 'Select a Conversation';
    document.getElementById('hist-thread-sub').textContent = 'Pick a contact from the left';
    document.getElementById('hist-thread-actions').style.display = 'none';
    document.getElementById('hist-messages-area').innerHTML =
      '<div style="text-align:center; margin:auto; color:var(--text-muted);"><div style="font-size:3rem;">💬</div><p>Select a chat to view history</p></div>';
    loadHistory();
  } catch (err) {
    alert('Failed to delete chat: ' + err.message);
  }
}

async function clearAllHistory() {
  if (!confirm('Clear ALL chat history? This will permanently delete all recorded messages.')) return;

  try {
    await fetch('/api/v1/history', { method: 'DELETE' });
    activeHistoryChatId = null;
    historyAllChats = [];
    document.getElementById('hist-thread-name').textContent = 'Select a Conversation';
    document.getElementById('hist-thread-sub').textContent = 'Pick a contact from the left';
    document.getElementById('hist-thread-actions').style.display = 'none';
    document.getElementById('hist-messages-area').innerHTML =
      '<div style="text-align:center; margin:auto; color:var(--text-muted);"><div style="font-size:3rem;">💬</div><p>All history cleared.</p></div>';
    loadHistory();
  } catch (err) {
    alert('Failed to clear all history: ' + err.message);
  }
}
