import type { WebSocket } from 'ws';
import * as pty from 'node-pty';

const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

export function attachTerminal(ws: WebSocket) {
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });

  // PTY output → WebSocket
  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  // PTY exit → close WebSocket
  ptyProcess.onExit(() => {
    if (ws.readyState === ws.OPEN) {
      ws.close();
    }
  });

  // WebSocket messages → PTY input or resize
  ws.on('message', (msg) => {
    const data = msg.toString();
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {
      // Not JSON — treat as terminal input
    }
    ptyProcess.write(data);
  });

  // WebSocket close → kill PTY
  ws.on('close', () => {
    ptyProcess.kill();
  });

  ws.on('error', () => {
    ptyProcess.kill();
  });
}
