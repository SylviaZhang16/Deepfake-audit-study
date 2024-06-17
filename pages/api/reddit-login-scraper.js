import { triggerScrapeDataForUser } from './scrape-reddit-data.mjs';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const credentialsFilePath = path.resolve('./data/reddit-credentials.json');

const saveCredentials = async (newCredentials) => {
  let existingCredentials = [];

  if (await fs.access(credentialsFilePath).then(() => true).catch(() => false)) {
    try {
      const data = await fs.readFile(credentialsFilePath, 'utf8');
      existingCredentials = JSON.parse(data);
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  }

  newCredentials.forEach((newCred) => {
    const existingCred = existingCredentials.find((cred) => cred.username === newCred.username);
    if (existingCred) {
      if (existingCred.password !== newCred.password) {
        existingCred.password = newCred.password;
      }
      if (!existingCred.urls) {
        existingCred.urls = [];
      }
      newCred.urls.forEach((url) => {
        if (!existingCred.urls.includes(url)) {
          existingCred.urls.push(url);
        }
      });
    } else {
      existingCredentials.push(newCred);
    }
  });

  await fs.writeFile(credentialsFilePath, JSON.stringify(existingCredentials, null, 2));
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // console.log('Request body:', req.body);

  const credentials = req.body;

  if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
    return res.status(400).json({ error: 'Credentials are required' });
  }

  await saveCredentials(credentials);

  try {
    const results = await Promise.all(
      credentials.map(({ username, password}) =>
        triggerScrapeDataForUser(username, password).then((metrics) => ({
          username,
          metrics,
        }))
      )
    );
    res.status(200).json({ metrics: results });

    exec('node ./pages/api/background-job.mjs', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting background job: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Background job stderr: ${stderr}`);
        return;
      }
      console.log(`Background job stdout: ${stdout}`);
    });

  } catch (err) {
    console.error('Failed to fetch metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
  }
}
