const whatsappService = require('./whatsappService');
const { v4: uuidv4 } = require('uuid');

class CampaignService {
  constructor() {
    this.activeCampaigns = new Map();
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  emitCampaignUpdate(campaign) {
    if (this.io) {
      this.io.emit('campaign_progress', {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status, // PENDING, RUNNING, PAUSED, COMPLETED, CANCELLED
        total: campaign.total,
        sent: campaign.sent,
        failed: campaign.failed,
        progressPercent: Math.round(((campaign.sent + campaign.failed) / campaign.total) * 100),
        logs: campaign.logs.slice(-20)
      });
    }
  }

  interpolateTemplate(template, data) {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  async createAndStartCampaign({ name, template, recipients, delayMin = 3000, delayMax = 7000, mediaFile = null }) {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipient list cannot be empty.');
    }

    if (whatsappService.getStatus().status !== 'READY') {
      throw new Error('WhatsApp client is not ready. Scan QR code first.');
    }

    const campaignId = uuidv4();
    const campaign = {
      id: campaignId,
      name: name || `Campaign ${new Date().toLocaleTimeString()}`,
      template,
      recipients, // Array of objects e.g. [{ phone: '12345', name: 'John' }] or string phone numbers
      delayMin: Number(delayMin) || 3000,
      delayMax: Number(delayMax) || 7000,
      mediaFile,
      status: 'RUNNING',
      total: recipients.length,
      sent: 0,
      failed: 0,
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      logs: []
    };

    this.activeCampaigns.set(campaignId, campaign);
    this.emitCampaignUpdate(campaign);

    // Run execution asynchronously
    this.executeCampaign(campaignId);

    return {
      success: true,
      campaignId,
      total: campaign.total,
      status: campaign.status
    };
  }

  async executeCampaign(campaignId) {
    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign) return;

    while (campaign.currentIndex < campaign.total && campaign.status === 'RUNNING') {
      const recipientItem = campaign.recipients[campaign.currentIndex];
      
      let phone = typeof recipientItem === 'string' ? recipientItem : recipientItem.phone || recipientItem.number || recipientItem.mobile;
      let data = typeof recipientItem === 'object' ? recipientItem : { phone };

      if (!phone) {
        campaign.failed++;
        campaign.logs.push({
          timestamp: new Date().toISOString(),
          status: 'FAILED',
          phone: 'N/A',
          error: 'No phone number provided in record'
        });
        campaign.currentIndex++;
        this.emitCampaignUpdate(campaign);
        continue;
      }

      const messageContent = this.interpolateTemplate(campaign.template, data);

      try {
        await whatsappService.sendMessage(phone, messageContent, campaign.mediaFile);
        campaign.sent++;
        campaign.logs.push({
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          phone,
          messagePreview: messageContent.substring(0, 60)
        });
      } catch (error) {
        campaign.failed++;
        campaign.logs.push({
          timestamp: new Date().toISOString(),
          status: 'FAILED',
          phone,
          error: error.message
        });
      }

      campaign.currentIndex++;
      this.emitCampaignUpdate(campaign);

      // Random throttle delay to prevent ban
      if (campaign.currentIndex < campaign.total && campaign.status === 'RUNNING') {
        const randomDelay = Math.floor(
          Math.random() * (campaign.delayMax - campaign.delayMin + 1) + campaign.delayMin
        );
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }
    }

    if (campaign.status === 'RUNNING') {
      campaign.status = 'COMPLETED';
      this.emitCampaignUpdate(campaign);
      whatsappService.addLog({
        level: 'success',
        type: 'campaign',
        message: `Campaign "${campaign.name}" completed! Sent: ${campaign.sent}, Failed: ${campaign.failed}`
      });
    }
  }

  pauseCampaign(campaignId) {
    const campaign = this.activeCampaigns.get(campaignId);
    if (campaign && campaign.status === 'RUNNING') {
      campaign.status = 'PAUSED';
      this.emitCampaignUpdate(campaign);
      return true;
    }
    return false;
  }

  resumeCampaign(campaignId) {
    const campaign = this.activeCampaigns.get(campaignId);
    if (campaign && campaign.status === 'PAUSED') {
      campaign.status = 'RUNNING';
      this.emitCampaignUpdate(campaign);
      this.executeCampaign(campaignId);
      return true;
    }
    return false;
  }

  cancelCampaign(campaignId) {
    const campaign = this.activeCampaigns.get(campaignId);
    if (campaign) {
      campaign.status = 'CANCELLED';
      this.emitCampaignUpdate(campaign);
      return true;
    }
    return false;
  }

  getCampaign(campaignId) {
    return this.activeCampaigns.get(campaignId);
  }

  getAllCampaigns() {
    return Array.from(this.activeCampaigns.values()).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      total: c.total,
      sent: c.sent,
      failed: c.failed,
      progressPercent: Math.round(((c.sent + c.failed) / c.total) * 100),
      createdAt: c.createdAt
    }));
  }
}

module.exports = new CampaignService();
