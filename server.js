import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { decades } from './decades.js';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub API client
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const githubRepo = {
  owner: process.env.GITHUB_REPO.split('/')[0],
  repo: process.env.GITHUB_REPO.split('/')[1]
};

// Middleware
app.use(express.json());
app.use(express.static('.'));

async function getSubmissions() {
  try {
    const { data } = await octokit.repos.getContent({
      ...githubRepo,
      path: 'submissions.json'
    });
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch (error) {
    console.error('GitHub getSubmissions error:', error.message);
    if (error.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch submissions: ${error.message}`);
  }
}

async function saveSubmissions(submissions) {
  try {
    const current = await octokit.repos.getContent({
      ...githubRepo,
      path: 'submissions.json'
    }).catch(() => null);

    await octokit.repos.createOrUpdateFileContents({
      ...githubRepo,
      path: 'submissions.json',
      message: 'Update submissions.json',
      content: Buffer.from(JSON.stringify(submissions, null, 2)).toString('base64'),
      sha: current ? current.data.sha : undefined
    });
  } catch (error) {
    console.error('GitHub saveSubmissions error:', error.message);
    throw new Error(`Failed to save submissions: ${error.message}`);
  }
}

app.post('/api/submit-event', async (req, res) => {
  try {
    const { headline, description, date, region, category, imageUrl, primarySources, summary } = req.body;
    console.log('Received submission:', { headline, date, region, category, imageUrl, summary });

    // Validate required fields
    if (!headline || !description || !date || !region || !category) {
      return res.status(400).json({ message: 'Headline, description, date, region, and category are required' });
    }

    // Validate date format
    const year = new Date(date).getFullYear();
    if (isNaN(year)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const decade = `${Math.floor(year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig) {
      return res.status(400).json({ message: `Decade ${decade} not found in config` });
    }

    const [yearStr, monthStr, dayStr] = date.split('-');
    const event = {
      id: Date.now().toString(),
      text: { headline, text: description },
      start_date: { year: yearStr, month: monthStr, day: dayStr },
      group: region,
      category,
      primarySources: primarySources || [],
      summary: summary || ""
    };

    if (imageUrl) {
      event.media = { url: imageUrl };
    }

    const submissions = await getSubmissions();
    submissions.push(event);
    await saveSubmissions(submissions);

    console.log('Submission saved:', event.id);
    res.status(200).json({ message: 'Event submitted for review' });
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
      const submissions = await getSubmissions();
      foundEvent = submissions.find(event => event.id === eventId);
    }

    if (!foundEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json(foundEvent);
  } catch (error) {
    console.error('Error fetching event:', error.message);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

app.post('/api/approve-event', async (req, res) => {
  try {
    const { id, action } = req.body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid request: id and action (approve/reject) are required' });
    }

    const submissions = await getSubmissions();
    const submission = submissions.find(s => s.id === id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (action === 'reject') {
      const updatedSubmissions = submissions.filter(s => s.id !== id);
      await saveSubmissions(updatedSubmissions);
      return res.status(200).json({ message: 'Submission rejected' });
    }

    // Approve: Add to decade file
    const decade = `${Math.floor(submission.start_date.year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig) {
      return res.status(400).json({ message: `Invalid decade: ${decade}` });
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
      summary: submission.summary || ""
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

    // Commit updated data file to GitHub
    const relativePath = decadeConfig.file;
    const githubPath = path.join('years', relativePath.split('/').pop());

    const currentFile = await octokit.repos.getContent({
      ...githubRepo,
      path: githubPath
    }).catch(() => null);

    await octokit.repos.createOrUpdateFileContents({
      ...githubRepo,
      path: githubPath,
      message: `Add approved event ${submission.id} to ${decade}`,
      content: Buffer.from(newContent).toString('base64'),
      sha: currentFile ? currentFile.data.sha : undefined
    });

    // Remove from submissions
    const updatedSubmissions = submissions.filter(s => s.id !== id);
    await saveSubmissions(updatedSubmissions);

    res.status(200).json({ message: 'Event approved and added to timeline' });
  } catch (error) {
    console.error('Error processing approval:', error.message);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    const submissions = await getSubmissions();
    res.status(200).json(submissions);
  } catch (error) {
    console.error('Error reading submissions:', error.message);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});