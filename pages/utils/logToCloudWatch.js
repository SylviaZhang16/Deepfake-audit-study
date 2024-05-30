import AWS from 'aws-sdk';

AWS.config.update({ region: 'us-east-1' });  

const cloudwatchlogs = new AWS.CloudWatchLogs();

const logToCloudWatch = (logGroupName, logStreamName, message) => {
  const params = {
    logEvents: [
      {
        message,
        timestamp: Date.now(),
      },
    ],
    logGroupName,
    logStreamName,
  };

  cloudwatchlogs.putLogEvents(params, (err, data) => {
    if (err) {
      console.error('Error logging to CloudWatch:', err);
    } else {
      console.log('Successfully logged to CloudWatch:', data);
    }
  });
};

export default logToCloudWatch;
