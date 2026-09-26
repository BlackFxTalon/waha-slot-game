/**
 * Мост к MCP-серверу Timeweb Cloud (streamable HTTP).
 *
 * Использование:
 *   npx tsx tools/mcp.ts init                     — хендшейк + список инструментов
 *   npx tsx tools/mcp.ts call <tool> '<json-args>' — выполнить инструмент
 *
 * Токен: env TIMWEBCLOUD_API_TOKEN или файл .timeweb-token в корне (в .gitignore).
 * Каждый вызов делает полный хендшейк (initialize → initialized → tools/*).
 */
import { readFileSync, existsSync } from 'node:fs';

const ENDPOINT = 'https://api.timeweb.cloud/api/v1/mcp/search';
let JSONRPC_ID = 0;

function getToken(): string {
  if (process.env.TIMWEBCLOUD_API_TOKEN) return process.env.TIMWEBCLOUD_API_TOKEN;
  const f = '.timeweb-token';
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  console.error('Нет токена: env TIMWEBCLOUD_API_TOKEN или файл .timeweb-token');
  process.exit(1);
}

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { message: string };
}

async function rpc(token: string, session: string | null, method: string, params?: unknown): Promise<{ res: RpcResponse; session: string | null }> {
  const id = ++JSONRPC_ID;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
  });

  const newSession = res.headers.get('mcp-session-id') ?? session;
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  // Ответ может быть JSON или SSE (data: {...})
  let payload: RpcResponse;
  if (text.startsWith('event:') || text.includes('data:')) {
    const dataLine = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .pop();
    payload = dataLine ? JSON.parse(dataLine) : {};
  } else {
    payload = JSON.parse(text);
  }
  if (payload.error) throw new Error(`MCP error: ${payload.error.message}`);
  return { res: payload, session: newSession };
}

async function handshake(token: string): Promise<string> {
  const init = await rpc(token, null, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'grim-fortune-agent', version: '1.0' },
  });
  const session = init.session;
  await rpc(token, session, 'notifications/initialized');
  return session!;
}

async function main(): Promise<void> {
  const token = getToken();
  const [cmd, tool, argsJson] = process.argv.slice(2);
  const session = await handshake(token);

  if (cmd === 'init') {
    const { res } = await rpc(token, session, 'tools/list');
    console.log(JSON.stringify(res.result, null, 2));
    return;
  }

  if (cmd === 'call') {
    if (!tool) {
      console.error('Использование: npx tsx tools/mcp.ts call <tool> <json-args>');
      process.exit(1);
    }
    const args = argsJson ? JSON.parse(argsJson) : {};
    const { res } = await rpc(token, session, 'tools/call', { name: tool, arguments: args });
    console.log(JSON.stringify(res.result, null, 2));
    return;
  }

  console.error('Использование: npx tsx tools/mcp.ts init | call <tool> <json-args>');
  process.exit(1);
}

main().catch((e: Error) => {
  console.error('ОШИБКА:', e.message);
  process.exit(1);
});
