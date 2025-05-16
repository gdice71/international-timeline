// /Users/gracedice/Desktop/IR/Project/api/approve-event.js
import { createClient } from '@supabase/supabase-js';
import { decades } from '../decades-config.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { id, action } = req.body;
        if (!id || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid request' });
        }

        // Fetch submission
        const { data: submission, error: fetchError } = await supabase
            .from('submissions')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        if (action === 'reject') {
            const { error } = await supabase
                .from('submissions')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return res.status(200).json({ message: 'Submission rejected' });
        }

        // Approve: Validate decade and add to events
        const decade = submission.decade;
        const decadeConfig = decades.find(d => d.decade === decade);
        if (!decadeConfig) {
            return res.status(400).json({ message: 'Invalid decade' });
        }

        const newEvent = {
            text: submission.text,
            start_date: submission.start_date,
            group: submission.group,
            category: submission.category,
            media: submission.media,
            decade
        };

        const { error: insertError } = await supabase
            .from('events')
            .insert([newEvent]);
        if (insertError) throw insertError;

        // Remove from submissions
        const { error: deleteError } = await supabase
            .from('submissions')
            .delete()
            .eq('id', id);
        if (deleteError) throw deleteError;

        return res.status(200).json({ message: 'Event approved and added to timeline' });
    } catch (error) {
        console.error('Error processing approval:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}