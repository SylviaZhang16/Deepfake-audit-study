import { spawn } from 'child_process';
import path from 'path';


let monitorProcess;
let eventEmitter;

export default function handler(req, res) {
  if (req.method === 'GET') {
    const url = req.query.url;

    if (!monitorProcess) {
      const scriptPath = path.resolve('monitor.js');
      monitorProcess = spawn('node', [scriptPath, url]);

      monitorProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        monitorProcess = null;
        eventEmitter = null;
      });

      eventEmitter = require('../../monitor');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendStatusUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    eventEmitter.on('status', sendStatusUpdate);

    req.on('close', () => {
      eventEmitter.removeListener('status', sendStatusUpdate);
    });
  } else {
    res.status(405).end();// CODE: METHOD NOT ALLOWED
  }
}
