import { chromium } from 'playwright';
import { DateTime } from 'luxon';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
// import logToCloudWatch from '../utils/logToCloudWatch';

const credentialsFilePath = path.resolve('./data/twitter-credentials.json');

const readCredentials = () => {
  if (fs.existsSync(credentialsFilePath)) {
    const data = fs.readFileSync(credentialsFilePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
};

const saveCredentials = (newCredentials) => {
  let existingCredentials = [];
  if (fs.existsSync(credentialsFilePath)) {
    const data = fs.readFileSync(credentialsFilePath, 'utf8');
    existingCredentials = JSON.parse(data);
  }
  const updatedCredentials = [...existingCredentials, ...newCredentials.filter(newCred => 
    !existingCredentials.some(existingCred => existingCred.username === newCred.username)
  )];
  fs.writeFileSync(credentialsFilePath, JSON.stringify(updatedCredentials, null, 2));
};

const saveScrapedData = (username, data) => {
  const filePath = path.resolve(`./data/twitter/${username}.json`);
  let mergedMetrics = data;

  if (fs.existsSync(filePath)) {
    const existingData = fs.readFileSync(filePath, 'utf8');
    const existingMetrics = JSON.parse(existingData);

    const existingPostsMap = existingMetrics.reduce((map, post) => {
      map[post.tweetID] = post;
      return map;
    }, {});

    mergedMetrics = data.map((newPost) => {
      if (existingPostsMap[newPost.tweetID]) {
        delete existingPostsMap[newPost.tweetID];
        return newPost;
      }
      return newPost;
    });

    mergedMetrics = mergedMetrics.concat(Object.values(existingPostsMap));
  }

  fs.writeFileSync(filePath, JSON.stringify(mergedMetrics, null, 2));
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const getTwitterPostMetrics = async (email, username, password, postUrls) => {
  // logToCloudWatch('audit-study-log', 'audit-study-stream', `Starting getTwitterPostMetrics with email: ${email} and username: ${username}`);
  console.log('Starting getTwitterPostMetrics');
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  const browser = await chromium.launch({ headless: false, 
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-zygote',
      '--disable-software-rasterizer'
    ]
   });
  const context = await browser.newContext({ viewport: 
    { width: 1920, height: 1080 } , 
    userAgent:userAgent,
  });
  const page = await context.newPage();

  await page.goto('https://twitter.com/login', { waitUntil: 'networkidle' });

  const emailInputSelector = 'input[name="text"][type="text"]';
  const usernameInputSelector = 'input[name="text"][type="text"]';
  const passwordInputSelector = 'input[name="password"][type="password"]';

  try {
    await page.waitForSelector(emailInputSelector);
    const emailInput = await page.$(emailInputSelector);
    await emailInput.type(email);
    await emailInput.press('Enter');

    try {
      await page.waitForSelector(usernameInputSelector, { timeout: 5000 });
      const usernameInput = await page.$(usernameInputSelector);
      if (usernameInput) {
        await usernameInput.type(username);
        await usernameInput.press('Enter');
      }
    } catch (error) {
      console.log('No username prompt, skipping...');
      // logToCloudWatch('audit-study-log', 'audit-study-stream', 'No username prompt, skipping...');
    }

    await page.waitForSelector(passwordInputSelector);
    const passwordInput = await page.$(passwordInputSelector);
    await passwordInput.type(password);
    await passwordInput.press('Enter');
  } catch (error) {
    console.error('Error during login:', error);
    // logToCloudWatch('/your/log/group', 'your-log-stream', `Error during login: ${error.message}`);
    throw new Error('Failed to login to Twitter');
  }

  await delay(5000);

  const postMetricsList = [];
  for (const postUrl of postUrls) {
    try {
      console.log(`Navigating to post URL: ${postUrl}`);
      // logToCloudWatch('audit-study-log', 'audit-study-stream', `Navigating to post URL: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(5000);
      const user = postUrl.split("/")[3];
      const postId = postUrl.split("/")[5];

      const metricsSelector = 'div[role="group"][aria-label]';
      await page.waitForSelector(metricsSelector);
      const metricsElement = await page.$(metricsSelector);
      const ariaLabel = await metricsElement.evaluate(el => el.getAttribute('aria-label'));

      let isDeleted = false;
      try {
        await page.waitForSelector('div[role="group"][aria-label]', { timeout: 10000 });
      } catch (error) {
        isDeleted = true;
        console.log(`Post ${postId} has been deleted or is unavailable.`);
      }

      const metrics = {};
      ariaLabel.split(',').forEach(item => {
        const [key, value] = item.trim().split(' ').reverse();
        metrics[key] = value;
      });

      if (!isDeleted) {
        const metricsElement = await page.$('div[role="group"][aria-label]');
        const ariaLabel = await metricsElement.evaluate(el => el.getAttribute('aria-label'));

        console.log('Metrics:', ariaLabel);

        ariaLabel.split(',').forEach(item => {
          const [key, value] = item.trim().split(' ').reverse();
          metrics[key] = value;
        });
      }

      const viewCount = metrics['views'] || '0';
      const quotesNumber = metrics['replies'] || '0';
      const repostsNumber = metrics['reposts'] || '0';
      const likesNumber = metrics['likes'] || '0';
      const bookmarksNumber = metrics['bookmarks'] || '0';
      const currentTime = DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd HH:mm:ss');
      const postMetrics = {
        authorID: user,
        tweetID: postId,
        scrapeTime: currentTime,
        numViews: viewCount,
        numComments: quotesNumber,
        numRetweets: repostsNumber,
        numLikes: likesNumber,
        numBookmarks: bookmarksNumber,
        isDeleted,
      };

      postMetricsList.push(postMetrics);
    } catch (error) {
      console.error(`Error fetching metrics for URL ${postUrl}:`, error);
    }
  }
  await browser.close();
  return postMetricsList;
};

const scrapeData = () => {
  const credentials = readCredentials();
  credentials.forEach(({ email, username, password, urls }) => {
    getTwitterPostMetrics(email, username, password, urls, (err, metrics) => {
      if (!err) {
        saveScrapedData(username, metrics);
      } else {
        console.error('Error scraping data for user:', username, err);
      }
    });
  });
};

cron.schedule('*/30 * * * *', scrapeData);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { email, username, password, urls } = req.body;

  saveCredentials([{ email, username, password, urls }]);

  if (!email || !username || !password || !urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'All fields (email, username, password, urls) are required and urls should be a non-empty array' });
  }

  try {
    console.log('API called with:', { email, username, urls });

    // Fetch metrics
    const metrics = await getTwitterPostMetrics(email, username, password, urls);
    
    // Save scraped data
    saveScrapedData(username, metrics);

    res.status(200).json({ metrics });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
  }
}


