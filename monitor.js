const axios = require('axios');
const cron = require('node-cron');
const { EventEmitter } = require('events');

const url = process.argv[2];
const eventEmitter = new EventEmitter();

function logStatus(status) {
  const timestamp = new Date().toISOString();
  const message = `${timestamp} - ${status}`;
  eventEmitter.emit('status', { timestamp, status });
  console.log(message);
}

async function checkContentStatus(url) {
  try {
    const response = await axios.get(url);
    return response.status === 200 ? 'VIEWABLE' : 'REMOVED';
  } catch (error) {
    return 'REMOVED';
  }
}

cron.schedule('* * * * * *', async () => {
  const status = await checkContentStatus(url);
  logStatus(status);
});

module.exports = eventEmitter;
