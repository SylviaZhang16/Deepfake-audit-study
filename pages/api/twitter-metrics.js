import { spawn } from 'child_process';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const { email, username, password, urls } = req.body;
  const scriptPath = path.resolve('./pages/api/scripts//twitter-scraper.py');
  console.log('Executing script at path:', scriptPath);

  const process = spawn('python3', [scriptPath, email, username, password, ...urls]);

  let output = '';
  let errorOutput = '';

  process.stdout.on('data', (data) => {
    console.log('Script Output:', data.toString());
    output += data.toString();
  });

  process.stderr.on('data', (data) => {
    console.error('Script Error Output:', data.toString());
    errorOutput += data.toString();
  });

  process.on('close', (code) => {
    if (code === 0) {
      try {
        const metrics = JSON.parse(output);
        res.status(200).json({ metrics });
      } catch (err) {
        console.error('Error parsing JSON:', err);
        res.status(500).json({ error: 'Failed to parse metrics' });
      }
    } else {
      console.error('Error executing script:', errorOutput);
      res.status(500).json({ error: 'Failed to fetch metrics', details: errorOutput });
    }
  });
}
