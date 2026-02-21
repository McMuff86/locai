import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { attachTerminal } from './src/server/terminal-handler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const upgradeHandler = app.getUpgradeHandler();
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server for terminal — only accept connections on /ws/terminal
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/');

    if (pathname === '/ws/terminal') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      // Let Next.js handle other upgrades (HMR WebSocket etc.)
      upgradeHandler(req, socket, head);
    }
  });

  wss.on('connection', (ws) => {
    attachTerminal(ws);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Graceful shutdown — free the port when the process is stopped
  const shutdown = () => {
    console.log('\n> Shutting down…');
    // Close all WebSocket connections so terminal PTYs get cleaned up
    for (const client of wss.clients) {
      client.close();
    }
    wss.close();
    server.close(() => {
      process.exit(0);
    });
    // Force exit after 3 seconds if something hangs
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
});
