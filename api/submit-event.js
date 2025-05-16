// /Users/gracedice/Desktop/IR/Project/api/submit-event.js
import { decades } from '../decades-config.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { headline, description, date, region, category, imageUrl } = req.body;
        console.log('Received submission:', { headline, date, region, category, imageUrl });

        // Validate required fields
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

        // Note: Cannot write to submissions.json in Vercel
        // Return event as placeholder (replace with Supabase for persistence)
        return res.status(200).json({ message: 'Event submitted for review', event });
    } catch (error) {
        console.error('Submission error:', error.message);
        return res.status(500).json({ message: `Server error: ${error.message}` });
    }
}