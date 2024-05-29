import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import puppeteer from 'puppeteer';

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

const scrapeDataForUser = async (username, password, callback) => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.goto('https://www.reddit.com/login/', { waitUntil: 'networkidle2' });

    await page.type('#loginUsername', username);
    await page.type('#loginPassword', password);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.goto(`https://www.reddit.com/user/${username}/submitted/`, { waitUntil: 'networkidle2' });

    const postsData = await page.evaluate(() => {
      const posts = [];
      document.querySelectorAll('div.Post').forEach(postElement => {
        const postID = postElement.getAttribute('data-post-id');
        const subredditID = postElement.getAttribute('data-subreddit-id');
        const numViews = postElement.querySelector('span.view-count')?.textContent || '0';
        const numUpvotes = postElement.querySelector('span.upvote-count')?.textContent || '0';
        const numComments = postElement.querySelector('span.comment-count')?.textContent || '0';
        const numXPosts = postElement.querySelector('span.share-count')?.textContent || '0';
        const scrapeTime = new Date().toISOString();

        posts.push({
          postID,
          subredditID,
          scrapeTime,
          numViews,
          numUpvotes,
          numComments,
          numXPosts
        });
      });
      return posts;
    });

    await browser.close();

    const filePath = path.resolve(`./data/reddit/${username}.json`);
    let mergedMetrics = postsData;

    if (fs.existsSync(filePath)) {
      const existingData = fs.readFileSync(filePath, 'utf8');
      const existingMetrics = JSON.parse(existingData);

      const existingPostsMap = existingMetrics.reduce((map, post) => {
        map[post.postID] = post;
        return map;
      }, {});

      mergedMetrics = postsData.map((newPost) => {
        if (existingPostsMap[newPost.postID]) {
          delete existingPostsMap[newPost.postID];
          return newPost;
        }
        return newPost;
      });

      mergedMetrics = mergedMetrics.concat(Object.values(existingPostsMap));
    }

    fs.writeFileSync(filePath, JSON.stringify(mergedMetrics, null, 2));
    if (callback) callback(null, mergedMetrics);
  } catch (err) {
    console.error('Error scraping data for user:', err);
    if (callback) callback(err);
  }
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
      res.status(200).json({ metrics });
    }
  });
}
