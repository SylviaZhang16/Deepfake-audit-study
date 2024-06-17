const Pushover = require('node-pushover');

const push = new Pushover({
  token: process.env.PUSHOVER_API_TOKEN,
  user: process.env.PUSHOVER_USER_KEY,
});

const sendPushNotification = (title, message) => {
  return new Promise((resolve, reject) => {
    push.send(title, message, (error, response) => {
      if (error) {
        return reject(error);
      }
      resolve(response);
    });
  });
};

module.exports = sendPushNotification;
