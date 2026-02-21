"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

const RECONNECT_DELAY = 2000;

export default function TerminalInstance() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!terminalRef.current || !mountedRef.current) return;

    const terminal = terminalRef.current;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      terminal.clear();
      // Send initial size
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      }
    };

    ws.onmessage = (e) => {
      terminal.write(e.data);
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        terminal.writeln("\r\n\x1b[33m[Disconnected — reconnecting...]\x1b[0m");
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#3f3f46",
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit after a short delay to ensure container is laid out
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // User input → WebSocket
    terminal.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      }
    });
    resizeObserver.observe(container);

    // Connect
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      resizeObserver.disconnect();
      wsRef.current?.close();
      terminal.dispose();
    };
  }, [connect]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 0 }}
    />
  );
}
