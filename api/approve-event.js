// /Users/gracedice/Desktop/IR/Project/api/approve-event.js
import { decades } from '../decades-config.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { id, action } = req.body;
        if (!id || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid request' });
        }

        // Note: Cannot update submissions.json or decade files in Vercel
        // Return placeholder response (replace with Supabase for persistence)
        if (action === 'reject') {
            return res.status(200).json({ message: 'Submission rejected' });
        }

        return res.status(200).json({ message: 'Event approved and added to timeline', id });
    } catch (error) {
        console.error('Error processing approval:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}