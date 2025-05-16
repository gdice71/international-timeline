// /Users/gracedice/Desktop/IR/Project/api/submissions.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const submissionsFile = path.join(process.cwd(), 'submissions.json');
        let submissions = [];
        try {
            const content = await fs.promises.readFile(submissionsFile, 'utf8');
            submissions = JSON.parse(content);
        } catch (error) {
            console.error('Error parsing submissions.json:', error.message);
            submissions = [];
        }
        return res.status(200).json(submissions);
    } catch (error) {
        console.error('Error reading submissions:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}