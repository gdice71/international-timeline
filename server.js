import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { decades } from './decades.js';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

const submissionsFile = path.join('/tmp', 'submissions.json');
const commentsFile = path.join('/tmp', 'comments.json');

async function initializeFile(filePath, defaultValue = []) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) await fs.writeFile(filePath, JSON.stringify(defaultValue));
    else JSON.parse(content);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue));
  }
}

app.get('/api/event/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    let foundEvent = null;

    for (const decade of decades) {
      const events = decade.data.events || [];
      foundEvent = events.find(event => event.id === eventId);
      if (foundEvent) {
        // Enhance with additional data (example for "Iraq War Begins")
        if (eventId === 'event-2000-002') {
          foundEvent = {
            ...foundEvent,
            summary: 'The U.S.-led coalition invaded Iraq on March 20, 2003, to remove Saddam Hussein from power.',
            keyPlayers: 'United States, United Kingdom, Iraq, Saddam Hussein',
            context: 'Post-9/11 tensions and alleged weapons of mass destruction led to the invasion.',
            outcomes: 'Saddam Hussein was deposed; Iraq faced insurgency and civil war.',
            reactions: 'Global protests; UN criticism; allied support from the UK and Australia.',
            shortEffects: 'Regime change and initial chaos in Iraq.',
            longSignificance: 'Rise of ISIS; shifted Middle East geopolitics.',
            impactData: { short: 75, long: 90 }, // Example impact scores (0-100)
            references: [
              { title: 'The Iraq War', url: 'https://www.britannica.com/event/Iraq-War' },
              { title: 'UN Reports', url: 'https://digitallibrary.un.org/search?ln=en&f1=subject%3AIraq' }
            ]
          };
        }
        break;
      }
    }

    if (!foundEvent) {
      await initializeFile(submissionsFile);
      const content = await fs.readFile(submissionsFile, 'utf8');
      const submissions = JSON.parse(content);
      foundEvent = submissions.find(event => event.id === eventId);
    }

    if (!foundEvent) return res.status(404).json({ message: 'Event not found' });
    res.json(foundEvent);
  } catch (error) {
    console.error('Error fetching event:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/comments', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    await initializeFile(commentsFile);
    const content = await fs.readFile(commentsFile, 'utf8');
    const comments = JSON.parse(content).filter(c => c.eventId === eventId);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/comments', async (req, res) => {
  try {
    const comment = req.body;
    await initializeFile(commentsFile);
    const content = await fs.readFile(commentsFile, 'utf8');
    const comments = JSON.parse(content);
    comments.push(comment);
    await fs.writeFile(commentsFile, JSON.stringify(comments, null, 2));
    res.json({ message: 'Comment added' });
  } catch (error) {
    console.error('Error adding comment:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Existing endpoints (submit-event, submissions, approve-event) remain unchanged

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});