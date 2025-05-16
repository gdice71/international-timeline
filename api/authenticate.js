// /Users/gracedice/Desktop/IR/Project/api/authenticate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { password } = req.body;
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

        if (!password || password !== ADMIN_PASSWORD) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        return res.status(200).json({ message: 'Authenticated' });
    } catch (error) {
        console.error('Authentication error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}