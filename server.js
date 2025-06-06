import express from 'express';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import { decades } from './decades.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
  console.error('Error: GITHUB_TOKEN or GITHUB_REPO not set in environment variables');
  process.exit(1);
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const githubRepo = {
  owner: process.env.GITHUB_REPO.split('/')[0],
  repo: process.env.GITHUB_REPO.split('/')[1]
};

app.use(express.json());
app.use(express.static('.'));

async function getSubmissions() {
  try {
    const response = await octokit.repos.getContent({
      ...githubRepo,
      path: 'submissions.json'
    });
    return JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
  } catch (error) {
    console.error('GitHub getSubmissions error:', error.message, error.status, error.response?.data);
    if (error.status === 404) {
      return [];
    }
    throw new Error(`GitHub API error: ${error.message}`);
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
    console.error('GitHub saveSubmissions error:', error.message, error.status, error.response?.data);
    throw new Error(`GitHub API error: ${error.message}`);
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
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const decade = `${Math.floor(year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig || !decadeConfig.file) {
      return res.status(400).json({ message: `Decade ${decade} configuration or file path is invalid` });
    }

    const [yearStr, monthStr, dayStr] = date.split('-');
    const event = {
      id: Date.now().toString(),
      text: { headline, text: description },
      start_date: { year: yearStr, month: monthStr, day: dayStr },
      group: region,
      category,
      summary: summary || ""
    };

    if (imageUrl) {
      event.media = { url: imageUrl };
    }

    // Handle primarySources as an array of objects
    if (primarySources && Array.isArray(primarySources)) {
      event.primarySources = primarySources.map(source => {
        if (typeof source === 'string') {
          // Backward compatibility: if a string is provided, convert to object
          return { url: source, title: "", summary: "", relevance: "" };
        } else if (source.url) {
          // Ensure the object has all required fields
          return {
            url: source.url,
            title: source.title || "",
            summary: source.summary || "",
            relevance: source.relevance || ""
          };
        }
        return null;
      }).filter(source => source !== null);
    } else {
      event.primarySources = [];
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
      const events = decade.data?.events || [];
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

    const decade = `${Math.floor(submission.start_date.year / 10) * 10}s`;
    const decadeConfig = decades.find(d => d.decade === decade);
    if (!decadeConfig || !decadeConfig.file) {
      return res.status(400).json({ message: `Invalid decade configuration for ${decade}` });
    }

    // Fetch the current decade file from GitHub
    const githubPath = decadeConfig.file;
    let events = [];
    let currentFile;
    try {
      currentFile = await octokit.repos.getContent({
        ...githubRepo,
        path: githubPath
      });
      const fileContent = Buffer.from(currentFile.data.content, 'base64').toString('utf8');

      // Extract the timelineData object
      const dataMatch = fileContent.match(/export\s+const\s+timelineData\s*=\s*(\{[\s\S]*?\})/);
      if (!dataMatch || !dataMatch[1]) {
        console.error('Failed to match timelineData in file content:', fileContent);
        throw new Error('Could not parse timelineData from decade file');
      }

      // Parse the timelineData object
      const timelineDataStr = dataMatch[1];
      let timelineData;
      try {
        try {
          timelineData = JSON.parse(timelineDataStr);
        } catch (jsonError) {
          timelineData = eval(`(${timelineDataStr})`);
        }
      } catch (evalError) {
        console.error('Failed to parse timelineData:', timelineDataStr, evalError.message);
        throw new Error(`Failed to parse timelineData: ${evalError.message}`);
      }
      if (!timelineData || !timelineData.title || !('events' in timelineData)) {
        throw new Error('Invalid timelineData structure');
      }
      events = timelineData.events || [];
    } catch (error) {
      if (error.status === 404) {
        console.log(`Decade file ${githubPath} not found, creating new one`);
        events = [];
      } else {
        console.error('Error fetching or parsing decade file from GitHub:', error.message, error.status, error.response?.data);
        throw new Error(`Failed to fetch or parse decade file: ${error.message}`);
      }
    }

    // Add the new event
    const newEvent = {
      id: submission.id,
      text: submission.text,
      start_date: submission.start_date,
      group: submission.group,
      category: submission.category,
      summary: submission.summary || ""
    };
    if (submission.media) {
      newEvent.media = submission.media;
    }
    // Ensure primarySources is handled as objects
    if (submission.primarySources && Array.isArray(submission.primarySources)) {
      newEvent.primarySources = submission.primarySources.map(source => {
        if (typeof source === 'string') {
          return { url: source, title: "", summary: "", relevance: "" };
        } else if (source.url) {
          return {
            url: source.url,
            title: source.title || "",
            summary: source.summary || "",
            relevance: source.relevance || ""
          };
        }
        return null;
      }).filter(source => source !== null);
    } else {
      newEvent.primarySources = [];
    }

    events.push(newEvent);

    // Update the decade file on GitHub
    const newContent = `export const timelineData = {
  title: { text: { headline: "International Relations Timeline", text: "" } },
  events: ${JSON.stringify(events, null, 2)}
};`;
    await octokit.repos.createOrUpdateFileContents({
      ...githubRepo,
      path: githubPath,
      message: `Add approved event ${submission.id} to ${decade}`,
      content: Buffer.from(newContent).toString('base64'),
      sha: currentFile ? currentFile.data.sha : undefined
    });

    // Remove the event from submissions
    const updatedSubmissions = submissions.filter(s => s.id !== id);
    await saveSubmissions(updatedSubmissions);

    res.status(200).json({ message: 'Event approved and added to timeline' });
  } catch (error) {
    console.error('Error processing approval:', error.message, error.response?.data);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    const submissions = await getSubmissions();
    if (!Array.isArray(submissions)) {
      throw new Error('Invalid submissions data format');
    }
    res.status(200).json(submissions);
  } catch (error) {
    console.error('Error reading submissions:', error.message, error.response?.data);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});