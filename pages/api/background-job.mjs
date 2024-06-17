import cron from 'node-cron';
import { scrapeData } from './scrape-reddit-data.mjs';

cron.schedule('*/1 * * * *', async () => {
  console.log('Starting scheduled data scrape');
  try {
    await scrapeData();
    console.log('Data scrape completed successfully');
  } catch (error) {
    console.error('Error during scheduled data scrape:', error);
  }
});

console.log('Background job has been scheduled.');
