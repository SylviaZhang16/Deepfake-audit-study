import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const directoryPath = path.resolve('./data/reddit-deleted');

  if (!fs.existsSync(directoryPath)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const zipFilename = 'all_reddit-data-backup.zip';
  const output = fs.createWriteStream(zipFilename);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  output.on('close', () => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${zipFilename}`);
    fs.createReadStream(zipFilename).pipe(res);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(directoryPath, false);
  archive.finalize();
}
