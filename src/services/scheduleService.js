const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const whatsappService = require('./whatsappService');

class ScheduleService {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'scheduled.json');
    this.jobs = [];
    this.timer = null;
    this.io = null;
    this.loadJobs();
    this.startWorker();
  }

  setSocketIO(io) {
    this.io = io;
  }

  loadJobs() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.jobs = JSON.parse(data);
      } else {
        this.jobs = [];
        this.saveJobs();
      }
    } catch (err) {
      console.error('Failed to load scheduled jobs:', err);
      this.jobs = [];
    }
  }

  saveJobs() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.jobs, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save scheduled jobs:', err);
    }
  }

  emitUpdate() {
    if (this.io) {
      this.io.emit('scheduled_jobs_update', this.getAll());
    }
  }

  getAll() {
    return this.jobs;
  }

  createSchedule({ to, message, scheduledAt }) {
    if (!to || !message || !scheduledAt) {
      throw new Error('Recipient, message, and scheduled date/time are required.');
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduled date/time format.');
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw new Error('Scheduled time must be in the future.');
    }

    const job = {
      id: `sched-${uuidv4().substring(0, 8)}`,
      to,
      message,
      scheduledAt: scheduledDate.toISOString(),
      status: 'PENDING', // PENDING, COMPLETED, FAILED, CANCELLED
      createdAt: new Date().toISOString()
    };

    this.jobs.unshift(job);
    this.saveJobs();
    this.emitUpdate();

    whatsappService.addLog({
      level: 'info',
      type: 'schedule',
      message: `Scheduled future WhatsApp message to ${to} for ${scheduledDate.toLocaleString()}`
    });

    return job;
  }

  cancelSchedule(id) {
    const job = this.jobs.find((j) => j.id === id);
    if (job && job.status === 'PENDING') {
      job.status = 'CANCELLED';
      this.saveJobs();
      this.emitUpdate();
      return true;
    }
    return false;
  }

  startWorker() {
    if (this.timer) clearInterval(this.timer);
    // Check every 10 seconds
    this.timer = setInterval(() => {
      this.processDueJobs();
    }, 10000);
  }

  async processDueJobs() {
    if (whatsappService.getStatus().status !== 'READY') return;

    const now = Date.now();
    const pendingJobs = this.jobs.filter((j) => j.status === 'PENDING' && new Date(j.scheduledAt).getTime() <= now);

    for (const job of pendingJobs) {
      try {
        console.log(`⏰ Executing scheduled message to ${job.to}`);
        await whatsappService.sendMessage(job.to, job.message);
        job.status = 'COMPLETED';
        job.executedAt = new Date().toISOString();
        this.saveJobs();
        this.emitUpdate();

        whatsappService.addLog({
          level: 'success',
          type: 'schedule',
          recipient: job.to,
          message: `Scheduled message sent to ${job.to}`
        });
      } catch (err) {
        console.error(`Failed executing scheduled message to ${job.to}:`, err);
        job.status = 'FAILED';
        job.error = err.message;
        job.executedAt = new Date().toISOString();
        this.saveJobs();
        this.emitUpdate();
      }
    }
  }
}

module.exports = new ScheduleService();
