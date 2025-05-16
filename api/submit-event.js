// /Users/gracedice/Desktop/IR/Project/api/submit-event.js
import { createClient } from '@supabase/supabase-js';
import { decades } from '../decades-config.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { headline, description, date, region, category, imageUrl } = req.body;
        console.log('Received submission:', { headline, date, region, category, imageUrl });

        if (!headline || !description || !date || !region || !category) {
            return res.status(400).json({ message: 'All fields are required except Image URL' });
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
            media: imageUrl ? { url: imageUrl } : null,
            decade
        };

        const { data, error } = await supabase
            .from('submissions')
            .insert([event])
            .select();
        if (error) throw error;

        return res.status(200).json({ message: 'Event submitted for review', event: data[0] });
    } catch (error) {
        console.error('Submission error:', error.message);
        return res.status(500).json({ message: `Server error: ${error.message}` });
    }
}