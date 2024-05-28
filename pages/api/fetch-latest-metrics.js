import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const filePath = path.resolve(`./data/reddit/${username}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'No data found for this user' });
  }

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const metrics = JSON.parse(data);
    res.status(200).json({ metrics });
  } catch (error) {
    console.error('Error reading metrics file:', error);
    res.status(500).json({ error: 'Failed to read metrics file' });
  }
}
