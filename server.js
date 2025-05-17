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

app.get('/api/event/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    let foundEvent = null;

    // Log search process
    console.log(`Searching for event ID: ${eventId}`);

    // Search decades
    for (const decade of decades) {
      const events = decade.data.events || [];
      foundEvent = events.find(event => event.id === eventId);
      if (foundEvent) {
        console.log(`Found event in decade ${decade.decade}`);
        break;
      }
    }

    // Check submissions
    if (!foundEvent) {
      await initializeSubmissions();
      const content = await fs.readFile(submissionsFile, 'utf8');
      const submissions = JSON.parse(content);
      foundEvent = submissions.find(event => event.id === eventId);
      if (foundEvent) console.log('Found event in submissions');
    }

    if (!foundEvent) {
      console.log('Event not found');
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(foundEvent);
  } catch (error) {
    console.error('Error fetching event:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Other endpoints (submit-event, submissions, approve-event) remain as previously provided

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});