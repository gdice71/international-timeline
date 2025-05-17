import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { decades } from './decades.js'; // Updated file name and import syntax

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.')); // Serve static files (HTML, CSS, JS)

// Submission storage in /tmp
const submissionsFile = path.join('/tmp', 'submissions.json');

// Initialize submissions file if it doesn't exist or is empty/malformed
async function initializeSubmissions() {
  try {
    const content = await fs.readFile(submissionsFile, 'utf8');
    if (!content.trim()) {
      console.log('submissions.json is empty, initializing with []');
      await fs.writeFile(submissionsFile, JSON.stringify([]));
    } else {
      // Verify JSON is valid
      JSON.parse(content);
    }
  } catch (error) {
    console.log('Initializing submissions.json due to:', error.message);
    await fs.writeFile(submissionsFile, JSON.stringify([]));
  }
}

// API to submit an event
app.post('/api/submit-event', async (req, res) => {
  try {
    const { headline, description, date, region, category, imageUrl } = req.body;
    console.log('Received submission:', { headline, date, region, category, imageUrl });
    if (!headline || !description || !date || !region || !category) {
      return res.status(400).json({ message: 'All fields are required except Image URL' });
    }

    // Parse date to determine decade
    const year = new Date(date).getFullYear();
    if (isNaN(year)) {
      throw new Error('Invalid date format');
    }
    const decade = `${Math.floor(year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig) {
      throw new Error(`Decade ${decade} not found in config`);
    }

    // Parse date for TimelineJS format
    const [yearStr, monthStr, dayStr] = date.split('-');
    const event = {
      id: Date.now().toString(),
      text: { headline, text: description },
      start_date: { year: yearStr, month: monthStr, day: dayStr },
      group: region,
      category
    };

    // Add media if imageUrl is provided
    if (imageUrl) {
      event.media = { url: imageUrl };
    }

    // Load existing submissions
    await initializeSubmissions();
    let submissions = [];
    try {
      const content = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(content);
    } catch (error) {
      console.error('Error parsing submissions.json:', error.message);
      submissions = [];
    }
    submissions.push(event);

    // Save submission
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    console.log('Submission saved successfully:', event.id);
    res.json({ message: 'Event submitted for review' });
  } catch (error) {
    console.error('Submission error:', error.message);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

// API to get pending submissions
app.get('/api/submissions', async (req, res) => {
  try {
    await initializeSubmissions();
    let submissions = [];
    try {
      const content = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(content);
    } catch (error) {
      console.error('Error reading submissions:', error.message);
      submissions = [];
    }
    res.json(submissions);
  } catch (error) {
    console.error('Error reading submissions:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// API to approve or reject submissions
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
    } catch (error) {
      console.error('Error parsing submissions.json:', error.message);
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

    // Approve: Add to the appropriate decade file in /tmp
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
      // Write to a temporary file to import as a module
      const tempFile = path.join('/tmp', `temp-${Date.now()}.js`);
      await fs.writeFile(tempFile, dataContent);
      const module = await import(tempFile);
      events = module.timelineData.events || [];
      await fs.unlink(tempFile); // Clean up
    } catch (e) {
      console.error('Error importing data file:', e);
      events = [];
    }

    const newEvent = {
      text: submission.text,
      start_date: submission.start_date,
      group: submission.group,
      category: submission.category
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

    // Remove from submissions
    submissions = submissions.filter(s => s.id !== id);
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    res.json({ message: 'Event approved and added to timeline' });
  } catch (error) {
    console.error('Error processing approval:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});