import { chromium, firefox, webkit } from 'playwright';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { DateTime } from 'luxon';
import randomUseragent from 'random-useragent';

const credentialsFilePath = path.resolve('./data/reddit-credentials.json');

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


const scrapeDataForUser = async (username, password, callback) => {
  try {
    const useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const browser = await webkit.launch({
      headless: true,
      args: [
        // '--no-sandbox',
        // '--disable-setuid-sandbox',
        // '--disable-dev-shm-usage',
        // '--disable-accelerated-2d-canvas',
        // '--disable-gpu',
        // '--no-zygote',
        // '--disable-software-rasterizer'
      ]
    });

    const randomUserAgent = randomUseragent.getRandom();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: useragent,
      javaScriptEnabled: true,
      extensions: []
    });
    await context.clearCookies();
    await context.clearPermissions();

    const page = await context.newPage();

    await page.goto('https://old.reddit.com/r/help/login/', { waitUntil: 'networkidle' });

    // await page.screenshot({ path: 'before_login.png' });

    const usernameInputSelector = '#login-username';
    const passwordInputSelector = '#login-password';

    await page.waitForSelector(usernameInputSelector);
    await page.type(usernameInputSelector, username);

    await page.waitForSelector(passwordInputSelector);
    await page.type(passwordInputSelector, password);

    // console.log('Submitting login form');
    await page.keyboard.press('Enter');

    // await page.screenshot({ path: 'beforenavigation_login.png' });

    await page.waitForTimeout(3000);
    console.log('Navigating to user profile');

    await page.screenshot({ path: 'after_login.png' });
 
    await page.goto(`https://www.reddit.com/user/${username}/submitted/`, { waitUntil: 'networkidle',timeout: 120000 });

    // await page.screenshot({ path: 'profile.png' });

    const trackersSelector = '#main-content faceplate-tracker[source="post_insights"][action="view"][noun="aggregate_stats"]';

    const trackerElements = await page.$$(trackersSelector);

    const postsData = [];

      for (const trackerElement of trackerElements) {
        try {
          const dataFaceplateContext = await page.evaluate(el => el.getAttribute('data-faceplate-tracking-context'), trackerElement);
          console.log('Data Faceplate Context:', dataFaceplateContext);

          const dataContextJson = JSON.parse(dataFaceplateContext.replace(/&quot;/g, '"'));
          const postID = dataContextJson['action_info']['post_id'].split('_').pop();
          const subredditID = dataContextJson['action_info']['subreddit_id'].split('_').pop();

          const viewsSelector = 'div.mt-s faceplate-tooltip:nth-of-type(1) > div[slot="trigger"] > div';
          const upvoteRateSelector = 'div.mt-s faceplate-tooltip:nth-of-type(2) > div[slot="trigger"] > div';
          const commentsSelector = 'div.mt-s faceplate-tooltip:nth-of-type(3) > div[slot="trigger"] > div';
          const sharesSelector = 'div.mt-s faceplate-tooltip:nth-of-type(4) > div[slot="trigger"] > div';

          const viewsElement = await trackerElement.$(viewsSelector);
          const upvoteRateElement = await trackerElement.$(upvoteRateSelector);
          const commentsElement = await trackerElement.$(commentsSelector);
          const sharesElement = await trackerElement.$(sharesSelector);

          const views = await page.evaluate(el => el.textContent.trim(), viewsElement);
          const upvoteRate = await page.evaluate(el => el.textContent.trim(), upvoteRateElement);
          const comments = await page.evaluate(el => el.textContent.trim(), commentsElement);
          const shares = await page.evaluate(el => el.textContent.trim(), sharesElement);

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

          console.log('Post Data:', postData);

          postsData.push(postData);
        } catch (e) {
          console.error(`An error occurred while processing a post: ${e}`);
        }
      }

      const filePath = path.resolve(`./data/reddit/${username}.json`);
      let mergedMetrics = postsData;

      // console.log('Posts Data:', postsData);

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

    await browser.close();
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

cron.schedule('*/30 * * * *', scrapeData);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const credentials = req.body;

  if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
    return res.status(400).json({ error: 'Credentials are required' });
  }

  saveCredentials(credentials);

  try {
    const results = await Promise.all(
      credentials.map(({ username, password }) =>
        new Promise((resolve, reject) => {
          scrapeDataForUser(username, password, (err, metrics) => {
            if (err) {
              return reject(err);
            }
            resolve({ username, metrics });
          });
        })
      )
    );
    res.status(200).json({ metrics: results });
  } catch (err) {
    console.error('Failed to fetch metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
  }
}

