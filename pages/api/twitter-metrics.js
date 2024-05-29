import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { DateTime } from 'luxon';

puppeteer.use(StealthPlugin());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const getTwitterPostMetrics = async (email, username, password, postUrls) => {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

  const browser = await puppeteer.launch({ headless: false,
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1, 
    }
  });

  const page = await browser.newPage();
  await page.setUserAgent(userAgent);
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('https://twitter.com/login', { waitUntil: 'networkidle2' });

  // const emailInputXpath = '//*[@id="layers"]/div[2]/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div/div/div/div[4]/label/div/div[2]/div/input';
  // const usernameInputXpath = '//*[@id="layers"]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div[1]/div/div[2]/label/div/div[2]/div/input';
  // const passwordInputXpath = '//*[@id="layers"]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div[1]/div/div/div[3]/div/label/div/div[2]/div[1]/input';

  const emailInputSelector = 'input[name="text"][type="text"]';
  const usernameInputSelector = 'input[name="text"][type="text"]';
  const passwordInputSelector = 'input[name="password"][type="password"]';
  
  const usernameInputXpath = '//*[@id="layers"]/div[2]/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div[1]/div/div[2]/label/div/div[2]/div/input';


  await page.waitForSelector(emailInputSelector);
  const emailInput = await page.$(emailInputSelector);
  await emailInput.type(email);
  await emailInput.press('Enter');

  try {
    await page.waitForSelector(usernameInputSelector);
    const [usernameInput] = await page.$(usernameInputSelector);

    if (usernameInput) {
      await usernameInput.type(username);
      await usernameInput.press('Enter');
    }
  } catch (error) {
    console.log('No username prompt, skipping...');
  }

  
  await page.waitForSelector(passwordInputSelector);
  const passwordInput = await page.$(passwordInputSelector);
  await passwordInput.type(password);
  await passwordInput.press('Enter');

  await delay(5000);

  const postMetricsList = [];

  for (const postUrl of postUrls) {
    console.log(`Navigating to post URL: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle2' });
    await delay(5000);

    const user = postUrl.split("/")[3];
    const postId = postUrl.split("/")[5];

    const metricsXpath = '//div[@role="group" and @aria-label]';
    const [metricsElement] = await page.$x(metricsXpath);
    const ariaLabel = await metricsElement.evaluate(el => el.getAttribute('aria-label'));

    const metrics = {};
    ariaLabel.split(',').forEach(item => {
      const [key, value] = item.trim().split(' ').reverse();
      metrics[value] = key;
    });

    const viewCount = metrics['views'] || '0';
    const quotesNumber = metrics['replies'] || '0';
    const repostsNumber = metrics['retweets'] || '0';
    const likesNumber = metrics['likes'] || '0';

    const currentTime = DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd HH:mm:ss');

    const postMetrics = {
      authorID: user,
      tweetID: postId,
      scrapeTime: currentTime,
      numViews: viewCount,
      numComments: quotesNumber,
      numRetweets: repostsNumber,
      numLikes: likesNumber
    };

    postMetricsList.push(postMetrics);
  }

  await browser.close();
  return postMetricsList;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { email, username, password, urls } = req.body;

  try {
    const metrics = await getTwitterPostMetrics(email, username, password, urls);
    res.status(200).json({ metrics });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
  }
}
