// /Users/gracedice/Desktop/IR/Project/api/events.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { decade } = req.query;
        let query = supabase.from('events').select('*');

        if (decade && decade !== 'all') {
            query = query.eq('decade', decade);
        }

        const { data, error } = await query;
        if (error) throw error;

        const timelineData = {
            title: { text: { headline: 'International Relations Timeline', text: '' } },
            events: data || []
        };

        return res.status(200).json(timelineData);
    } catch (error) {
        console.error('Error fetching events:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}