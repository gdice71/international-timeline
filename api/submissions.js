// /Users/gracedice/Desktop/IR/Project/api/submissions.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { data, error } = await supabase
            .from('submissions')
            .select('*');
        if (error) throw error;
        return res.status(200).json(data || []);
    } catch (error) {
        console.error('Error reading submissions:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}