import fs from 'fs';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const logStream = fs.createReadStream('public/content_status_log.txt', { encoding: 'utf8' });

  logStream.on('data', (chunk) => {
    res.write(`data: ${chunk.replace(/\n/g, '\ndata: ')}\n\n`);
  });

  logStream.on('end', () => {
    res.end();
  });

  req.on('close', () => {
    logStream.destroy();
  });
}
