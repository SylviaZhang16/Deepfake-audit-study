import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  const screenshotPath = path.resolve('./after_login.png');

  if (!fs.existsSync(screenshotPath)) {
    return res.status(404).json({ error: 'Screenshot not found' });
  }

  res.setHeader('Content-Type', 'image/png');
  fs.createReadStream(screenshotPath).pipe(res);
}