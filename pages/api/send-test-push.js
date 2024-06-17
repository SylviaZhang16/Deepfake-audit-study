import sendPushNotification from '../utils/sendPushNotifications';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    await sendPushNotification('Test Notification', 'This is a test push notification from your application.');
    res.status(200).json({ message: 'Test push notification sent successfully' });
  } catch (error) {
    console.error('Error sending test push notification:', error);
    res.status(500).json({ error: 'Failed to send test push notification', details: error.message });
  }
}
