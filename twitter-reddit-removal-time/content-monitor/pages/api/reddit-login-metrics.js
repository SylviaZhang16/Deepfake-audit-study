import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';

const credentialsFilePath = path.resolve('./data/reddit-credentials.json');

const readCredentials = () => {
  if (fs.existsSync(credentialsFilePath)) {
    const data = fs.readFileSync(credentialsFilePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
};

const saveCredentials = (credentials) => {
  fs.writeFileSync(credentialsFilePath, JSON.stringify(credentials, null, 2));
};

const scrapeDataForUser = (username, password, callback) => {
  const scriptPath = path.resolve('./pages/api/scripts/reddit-scraper.py');
  console.log('Executing script at path:', scriptPath);

  const process = spawn('python3', [scriptPath, username, password]);

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
        if (callback) callback(null, metrics);
      } catch (err) {
        console.error('Error parsing JSON:', err);
        if (callback) callback(err);
      }
    } else {
      console.error('Script exited with code:', code);
      if (callback) callback(new Error('Script exited with code: ' + code));
    }
  });
};

const scrapeData = () => {
  const credentials = readCredentials();
  credentials.forEach(({ username, password }) => {
    scrapeDataForUser(username, password, (err, metrics) => {
      if (!err) {
        const filePath = path.resolve(`./data/reddit/${username}.json`);
        fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
      } else {
        console.error('Error scraping data for user:', username, err);
      }
    });
  });
};

cron.schedule('*/10 * * * *', scrapeData);

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const credentials = readCredentials();

  const existingIndex = credentials.findIndex((cred) => cred.username === username);
  if (existingIndex >= 0) {
    credentials[existingIndex] = { username, password };
  } else {
    credentials.push({ username, password });
  }

  saveCredentials(credentials);

  scrapeDataForUser(username, password, (err, metrics) => {
    if (err) {
      console.error('Failed to fetch metrics:', err);
      res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
    } else {
      const filePath = path.resolve(`./data/reddit/${username}.json`);
      fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
      res.status(200).json({ metrics });
    }
  });
}
