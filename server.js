import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { decades } from './decades.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

const submissionsFile = path.join('/tmp', 'submissions.json');

async function initializeSubmissions() {
  try {
    const content = await fs.readFile(submissionsFile, 'utf8');
    if (!content.trim()) {
      await fs.writeFile(submissionsFile, JSON.stringify([]));
    } else {
      JSON.parse(content);
    }
  } catch {
    await fs.writeFile(submissionsFile, JSON.stringify([]));
  }
}

app.post('/api/submit-event', async (req, res) => {
  try {
    const { headline, description, date, region, category, imageUrl, primarySources, summary } = req.body;
    console.log('Received submission:', { headline, date, region, category, imageUrl, summary });
    if (!headline || !description || !date || !region || !category) {
      return res.status(400).json({ message: 'Headline, description, date, region, and category are required' });
    }

    const year = new Date(date).getFullYear();
    if (isNaN(year)) {
      throw new Error('Invalid date format');
    }
    const decade = `${Math.floor(year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig) {
      throw new Error(`Decade ${decade} not found in config`);
    }

    const [yearStr, monthStr, dayStr] = date.split('-');
    const event = {
      id: Date.now().toString(),
      text: { headline, text: description },
      start_date: { year: yearStr, month: monthStr, day: dayStr },
      group: region,
      category,
      primarySources: primarySources || [],
      summary: summary || "" // Include summary, default to empty string
    };

    if (imageUrl) {
      event.media = { url: imageUrl };
    }

    await initializeSubmissions();
    let submissions = [];
    try {
      const content = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(content);
    } catch {
      submissions = [];
    }
    submissions.push(event);

    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    console.log('Submission saved:', event.id);
    res.json({ message: 'Event submitted for review' });
  } catch (error) {
    console.error('Submission error:', error.message);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

app.get('/api/event/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    let foundEvent = null;

    for (const decade of decades) {
      const events = decade.data.events || [];
      foundEvent = events.find(event => event.id === eventId);
      if (foundEvent) break;
    }

    if (!foundEvent) {
      await initializeSubmissions();
      const content = await fs.readFile(submissionsFile, 'utf8');
      const submissions = JSON.parse(content);
      foundEvent = submissions.find(event => event.id === eventId);
    }

    if (!foundEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(foundEvent);
  } catch (error) {
    console.error('Error fetching event:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/approve-event', async (req, res) => {
  try {
    const { id, action } = req.body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    await initializeSubmissions();
    let submissions = [];
    try {
      const content = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(content);
    } catch {
      submissions = [];
    }
    const submission = submissions.find(s => s.id === id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (action === 'reject') {
      submissions = submissions.filter(s => s.id !== id);
      await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
      return res.json({ message: 'Submission rejected' });
    }

    const decade = `${Math.floor(submission.start_date.year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig) {
      return res.status(400).json({ message: 'Invalid decade' });
    }

    const filePath = path.join('/tmp', decadeConfig.file);
    let dataContent;
    try {
      dataContent = await fs.readFile(filePath, 'utf8');
    } catch {
      dataContent = 'export const timelineData = { title: { text: { headline: "International Relations Timeline", text: "" } }, events: [] };';
    }

    let events = [];
    try {
      const tempFile = path.join('/tmp', `temp-${Date.now()}.js`);
      await fs.writeFile(tempFile, dataContent);
      const module = await import(tempFile);
      events = module.timelineData.events || [];
      await fs.unlink(tempFile);
    } catch (e) {
      console.error('Error importing data file:', e);
      events = [];
    }

    const newEvent = {
      id: submission.id,
      text: submission.text,
      start_date: submission.start_date,
      group: submission.group,
      category: submission.category,
      primarySources: submission.primarySources || [],
      summary: submission.summary || "" // Include summary
    };
    if (submission.media) {
      newEvent.media = submission.media;
    }
    events.push(newEvent);

    const newContent = `export const timelineData = {
  title: { text: { headline: "International Relations Timeline", text: "" } },
  events: ${JSON.stringify(events, null, 2)}
};`;
    await fs.writeFile(filePath, newContent);

    submissions = submissions.filter(s => s.id !== id);
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    res.json({ message: 'Event approved and added to timeline' });
  } catch (error) {
    console.error('Error processing approval:', error.message);
    res.status(500). TALjson({ message: 'Server error' });
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    await initializeSubmissions();
    let submissions = [];
    try {
      const content = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(content);
    } catch {
      submissions = [];
    }
    res.json(submissions);
  } catch (error) {
    console.error('Error reading submissions:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});