import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { DateTime } from 'luxon'; 

puppeteer.use(StealthPlugin());
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
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.goto('https://www.reddit.com/login/', { waitUntil: 'networkidle2' });

    const usernameInputSelector = '#login-username';
    const passwordInputSelector = '#login-password';
  
    await page.waitForSelector(usernameInputSelector);
    await page.type(usernameInputSelector, username);
  
    await page.waitForSelector(passwordInputSelector);
    await page.type(passwordInputSelector, password);
  
    await page.keyboard.press('Enter');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.goto(`https://www.reddit.com/user/${username}/submitted/`, { waitUntil: 'networkidle2' });

    const trackersXpath = '//*[@id="main-content"]//faceplate-tracker[@source="post_insights" and @action="view" and @noun="aggregate_stats"]';

    const trackerElements = await page.$x(trackersXpath);
    
    const postsData = [];

    for (const trackerElement of trackerElements) {
      try {
        const dataFaceplateContext = await page.evaluate(el => el.getAttribute('data-faceplate-tracking-context'), trackerElement);
        const dataContextJson = JSON.parse(dataFaceplateContext.replace(/&quot;/g, '"'));
        const postID = dataContextJson['action_info']['post_id'].split('_').pop();
        const subredditID = dataContextJson['action_info']['subreddit_id'].split('_').pop();

        const viewsXpath = './div[1]/div/faceplate-tooltip[1]/div/div';
        const upvoteRateXpath = './div[1]/div/faceplate-tooltip[2]/div/div';
        const commentsXpath = './div[1]/div/faceplate-tooltip[3]/div/div';
        const sharesXpath = './div[1]/div/faceplate-tooltip[4]/div/div';

        const [viewsElement] = await trackerElement.$x(viewsXpath);
        const [upvoteRateElement] = await trackerElement.$x(upvoteRateXpath);
        const [commentsElement] = await trackerElement.$x(commentsXpath);
        const [sharesElement] = await trackerElement.$x(sharesXpath);

        const views = await page.evaluate(el => el.textContent, viewsElement);
        const upvoteRate = await page.evaluate(el => el.textContent, upvoteRateElement);
        const comments = await page.evaluate(el => el.textContent, commentsElement);
        const shares = await page.evaluate(el => el.textContent, sharesElement);

        const tz = 'America/New_York';
        const currentTime = DateTime.now().setZone(tz).toFormat('yyyy-MM-dd HH:mm:ss');

        const postData = {
          postID,
          subredditID,
          scrapeTime: currentTime,
          numViews: views,
          numUpvotes: upvoteRate,
          numComments: comments,
          numXPosts: shares
        };
        postsData.push(postData);
    } catch (e) {
      console.error(`An error occurred while processing a post: ${e}`);
    }
  }



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
