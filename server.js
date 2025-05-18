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
        // Enhance with additional data for "Iraq War Begins"
        if (eventId === 'event-2000-002') {
          foundEvent = {
            ...foundEvent,
            summary: 'The U.S.-led coalition invaded Iraq on March 20, 2003, to remove Saddam Hussein from power.',
            context: 'Post-9/11 tensions, allegations of weapons of mass destruction, and failure of UN inspections led to the invasion.',
            developments: [
              'Initial "shock and awe" bombing campaign targeted Baghdad.',
              'Saddam Hussein was captured in December 2003.',
              'Coalition Provisional Authority established to govern Iraq.'
            ],
            reactions: 'Massive global protests; UN Secretary-General Kofi Annan called the invasion illegal; UK and Australia supported the U.S.',
            keyPlayers: ['United States', 'United Kingdom', 'Iraq', 'Saddam Hussein', 'George W. Bush', 'Tony Blair'],
            impactData: { short: 75, long: 90 },
            quickFacts: [
              'Operation named "Iraqi Freedom."',
              'Over 150,000 coalition troops involved.',
              'Saddam executed in 2006.'
            ],
            additionalMedia: [
              'https://example.com/iraq-war-map.jpg',
              'https://example.com/baghdad-airstrike.jpg'
            ],
            references: [
              { title: 'The Iraq War', url: 'https://www.britannica.com/event/Iraq-War' },
              { title: 'UN Reports on Iraq', url: 'https://digitallibrary.un.org/search?ln=en&f1=subject%3AIraq' }
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

// Existing endpoints (submit-event, submissions, approve-event) remain unchanged

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});