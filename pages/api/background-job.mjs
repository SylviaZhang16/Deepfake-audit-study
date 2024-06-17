import cron from 'node-cron';
import { scrapeData } from './scrape-reddit-data.mjs';
import { fetchPostDetails } from './fetch-post.js';

const fetchAllPosts = async () => {
  const credentials = await readCredentials();

  for (const { urls } of credentials) {
    for (const url of urls) {
      try {
        const postDetails = await fetchPostDetails(url);
        console.log(`Fetched details for ${url}:`, postDetails);
      } catch (error) {
        console.error(`Failed to fetch details for ${url}:`, error);
      }
    }
  }
};


cron.schedule('*/30 * * * *', async () => {
  console.log('Starting scheduled data scrape');
  try {
    await scrapeData();
    await fetchAllPosts();
    console.log('Data scrape completed successfully');
  } catch (error) {
    console.error('Error during scheduled data scrape:', error);
  }
});

console.log('Background job has been scheduled.');
