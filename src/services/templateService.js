const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TemplateService {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'templates.json');
    this.templates = [];
    this.loadTemplates();
  }

  loadTemplates() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.templates = JSON.parse(data);
      } else {
        // Seed initial default templates
        this.templates = [
          {
            id: 'tmpl-welcome',
            title: 'Welcome Greetings',
            content: 'Hello {name}! 👋 Welcome to our platform. Let us know if you have any questions.',
            createdAt: new Date().toISOString()
          },
          {
            id: 'tmpl-order-update',
            title: 'Order Status Update',
            content: 'Hi {name}, your order #{order_id} has been processed and shipped! Track here: {tracking_link}',
            createdAt: new Date().toISOString()
          },
          {
            id: 'tmpl-reminder',
            title: 'Appointment Reminder',
            content: 'Reminder: Hi {name}, your appointment is scheduled for {date} at {time}. Reply YES to confirm.',
            createdAt: new Date().toISOString()
          }
        ];
        this.saveTemplates();
      }
    } catch (err) {
      console.error('Failed loading templates:', err);
      this.templates = [];
    }
  }

  saveTemplates() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.templates, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed saving templates:', err);
    }
  }

  getAll() {
    return this.templates;
  }

  getById(id) {
    return this.templates.find((t) => t.id === id);
  }

  create({ title, content }) {
    if (!title || !content) {
      throw new Error('Title and content are required for a template.');
    }
    const template = {
      id: `tmpl-${uuidv4().substring(0, 8)}`,
      title,
      content,
      createdAt: new Date().toISOString()
    };
    this.templates.unshift(template);
    this.saveTemplates();
    return template;
  }

  update(id, { title, content }) {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error('Template not found.');
    }
    if (title) this.templates[index].title = title;
    if (content) this.templates[index].content = content;
    this.templates[index].updatedAt = new Date().toISOString();
    this.saveTemplates();
    return this.templates[index];
  }

  delete(id) {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.templates.splice(index, 1);
    this.saveTemplates();
    return true;
  }
}

module.exports = new TemplateService();
