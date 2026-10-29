'use strict';
// A tiny Redis (RESP2) server that logs every command it gets: enough for a session store (GET, SET with EX/PX,
// DEL, EXPIRE, SCAN, MGET, SELECT, AUTH, INFO, ...). Not a real Redis: it lets the tests see what the store sends.

const net = require('net');

exports.start = function start(port = 0) {
  const data = new Map(), expiry = new Map(), log = [], sockets = new Set();
  let connections = 0, selected = new Map();

  const alive = k => { if (expiry.has(k) && expiry.get(k) <= Date.now()) { data.delete(k); expiry.delete(k); } return data.has(k); };
  const bulk = s => (s === null || s === undefined ? '$-1\r\n' : `$${Buffer.byteLength(s)}\r\n${s}\r\n`);
  const arr = items => `*${items.length}\r\n${items.join('')}`;

  const server = net.createServer(socket => {
    connections++;
    sockets.add(socket);
    selected.set(socket, 0);
    let buf = Buffer.alloc(0);

    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const parsed = parse(buf);

        if (!parsed) break;
        buf = buf.subarray(parsed.length);
        socket.write(handle(parsed.args, socket));
      }
    });
  });

  function parse(b) {
    if (b[0] !== 0x2a) { // inline command
      const i = b.indexOf('\r\n');

      return i < 0 ? null : { length: i + 2, args: b.subarray(0, i).toString().split(' ') };
    }

    let pos = b.indexOf('\r\n');

    if (pos < 0) return null;
    const n = Number(b.subarray(1, pos).toString()), args = [];

    pos += 2;
    for (let i = 0; i < n; i++) {
      const e = b.indexOf('\r\n', pos);

      if (e < 0) return null;
      const len = Number(b.subarray(pos + 1, e).toString());

      if (b.length < e + 2 + len + 2) return null;
      args.push(b.subarray(e + 2, e + 2 + len).toString());
      pos = e + 2 + len + 2;
    }
    return { length: pos, args };
  }

  function handle(args, socket) {
    const cmd = args[0].toUpperCase(), a = args.slice(1), db = selected.get(socket);
    const key = k => `${db}:${k}`;

    if (!['INFO', 'CLIENT', 'PING', 'COMMAND'].includes(cmd)) log.push([cmd, ...args.slice(1)].map(String));
    switch (cmd) {
      case 'PING': return '+PONG\r\n';
      case 'AUTH': return '+OK\r\n';
      case 'SELECT': selected.set(socket, Number(a[0])); return '+OK\r\n';
      case 'CLIENT': return '+OK\r\n';
      case 'HELLO': return '-ERR unknown command \'HELLO\'\r\n';
      case 'COMMAND': return arr([]);
      case 'INFO': return bulk('# Server\r\nredis_version:7.2.0\r\nloading:0\r\n');
      case 'GET': return bulk(alive(key(a[0])) ? data.get(key(a[0])) : null);
      case 'SET': {
        data.set(key(a[0]), a[1]);
        expiry.delete(key(a[0]));
        for (let i = 2; i < a.length; i++) {
          const o = a[i].toUpperCase();

          if (o === 'EX') expiry.set(key(a[0]), Date.now() + Number(a[++i]) * 1000);
          else if (o === 'PX') expiry.set(key(a[0]), Date.now() + Number(a[++i]));
        }
        return '+OK\r\n';
      }
      case 'SETEX': data.set(key(a[0]), a[2]); expiry.set(key(a[0]), Date.now() + Number(a[1]) * 1000); return '+OK\r\n';
      case 'DEL': { let n = 0; for (const k of a) { if (alive(key(k))) { data.delete(key(k)); expiry.delete(key(k)); n++; } } return `:${n}\r\n`; }
      case 'EXPIRE': if (!alive(key(a[0]))) return ':0\r\n'; expiry.set(key(a[0]), Date.now() + Number(a[1]) * 1000); return ':1\r\n';
      case 'PEXPIRE': if (!alive(key(a[0]))) return ':0\r\n'; expiry.set(key(a[0]), Date.now() + Number(a[1])); return ':1\r\n';
      case 'TTL': return `:${alive(key(a[0])) ? (expiry.has(key(a[0])) ? Math.round((expiry.get(key(a[0])) - Date.now()) / 1000) : -1) : -2}\r\n`;
      case 'PTTL': return `:${alive(key(a[0])) ? (expiry.has(key(a[0])) ? expiry.get(key(a[0])) - Date.now() : -1) : -2}\r\n`;
      case 'EXISTS': return `:${a.filter(k => alive(key(k))).length}\r\n`;
      case 'MGET': return arr(a.map(k => bulk(alive(key(k)) ? data.get(key(k)) : null)));
      case 'SCAN': {
        const match = a[a.indexOf('MATCH') + 1] || '*', re = new RegExp(`^${match.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
        const keys = [...data.keys()].filter(k => k.startsWith(`${db}:`) && alive(k)).map(k => k.slice(String(db).length + 1)).filter(k => re.test(k));

        return arr([bulk('0'), arr(keys.map(bulk))]);
      }
      case 'QUIT': return '+OK\r\n';
      default: return `-ERR unknown command '${cmd}'\r\n`;
    }
  }

  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({
    port: server.address().port,
    url: `redis://127.0.0.1:${server.address().port}`,
    log, data, expiry,
    connections: () => connections,
    ttlOf: k => (expiry.has(k) ? Math.round((expiry.get(k) - Date.now()) / 1000) : null),
    dropConnections: () => { for (const s of sockets) s.destroy(); },
    close: () => new Promise(r => { for (const s of sockets) s.destroy(); server.close(r); }),
    listening: () => server.listening,
    restart: async function () { /* listen again on the same port */ await new Promise(r => server.listen(server.address()?.port || port, '127.0.0.1', r)); }
  })));
};
