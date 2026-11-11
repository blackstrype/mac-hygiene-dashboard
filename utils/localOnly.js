// Guard for endpoints that move or remove the user's files.
//
// ZenMac is a single-user local tool, so these endpoints only answer:
//   1. connections that come from this machine (not the LAN),
//   2. requests addressed to a localhost name (blocks DNS-rebinding),
//   3. requests whose Origin, when the browser sends one, is the dashboard
//      itself (blocks other websites from driving the API in the background).

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(hostHeader) {
  if (typeof hostHeader !== 'string') return null;
  // Strip the port, keeping bracketed IPv6 literals intact
  const match = hostHeader.match(/^(\[[^\]]+\]|[^:]+)(:\d+)?$/);
  return match ? match[1].toLowerCase() : null;
}

export function localOnly(req, res, next) {
  const deny = (reason) => res.status(403).json({ error: `Access Denied: ${reason}` });

  if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress)) {
    return deny('this action is only available from the Mac running ZenMac.');
  }

  const host = req.headers.host;
  if (!LOCAL_HOSTNAMES.has(hostnameOf(host))) {
    return deny('unexpected Host header.');
  }

  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) {
    return deny('cross-site requests are not allowed.');
  }

  if (req.method !== 'GET' && !req.is('application/json')) {
    return deny('requests must be JSON.');
  }

  next();
}
