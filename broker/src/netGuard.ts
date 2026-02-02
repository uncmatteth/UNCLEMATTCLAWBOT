import dns from "node:dns";
import net from "node:net";

type LookupOptions = number | { all?: boolean; family?: number };

type GuardOptions = {
  cacheTtlMs?: number;
  allowPrivate?: boolean;
};

type CacheEntry = { expiresAt: number; ok: boolean };

function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) return null;
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function parseIPv6ToBigInt(ip: string): bigint | null {
  let addr = ip.toLowerCase();
  const zoneIndex = addr.indexOf("%");
  if (zoneIndex !== -1) addr = addr.slice(0, zoneIndex);

  if (addr.includes(".")) {
    const lastColon = addr.lastIndexOf(":");
    if (lastColon === -1) return null;
    const ipv4Part = addr.slice(lastColon + 1);
    const ipv4 = parseIPv4(ipv4Part);
    if (ipv4 === null) return null;
    const high = ((ipv4 >>> 16) & 0xffff).toString(16);
    const low = (ipv4 & 0xffff).toString(16);
    addr = addr.slice(0, lastColon) + ":" + high + ":" + low;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const tail = halves[1] ? halves[1].split(":").filter(Boolean) : [];
  if (head.length + tail.length > 8) return null;
  const zeros = new Array(8 - head.length - tail.length).fill("0");
  const groups = [...head, ...zeros, ...tail];
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const group of groups) {
    const v = parseInt(group, 16);
    if (!Number.isFinite(v) || v < 0 || v > 0xffff) return null;
    value = (value << 16n) + BigInt(v);
  }
  return value;
}

function inRange(n: number, start: number, end: number) {
  return n >= start && n <= end;
}

function inRangeBig(n: bigint, start: bigint, end: bigint) {
  return n >= start && n <= end;
}

function cidrToRange(addr: string, prefix: number): [bigint, bigint] {
  const base = parseIPv6ToBigInt(addr);
  if (base === null) throw new Error(`invalid IPv6 base: ${addr}`);
  const shift = 128n - BigInt(prefix);
  const mask = (1n << shift) - 1n;
  const start = base & ~mask;
  const end = start + mask;
  return [start, end];
}

const V4_BLOCKED_RANGES: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x64400000, 0x647fffff], // 100.64.0.0/10
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24
  [0xc0586300, 0xc05863ff], // 192.88.99.0/24
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24
  [0xe0000000, 0xefffffff], // 224.0.0.0/4
  [0xf0000000, 0xffffffff]  // 240.0.0.0/4 + 255.255.255.255
];

const V6_GLOBAL_START = parseIPv6ToBigInt("2000::")!;
const V6_GLOBAL_END = parseIPv6ToBigInt("3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")!;
const V6_BLOCKED_RANGES: Array<[bigint, bigint]> = [
  cidrToRange("::", 128),          // unspecified
  cidrToRange("::1", 128),         // loopback
  cidrToRange("fc00::", 7),        // unique local
  cidrToRange("fe80::", 10),       // link-local
  cidrToRange("ff00::", 8),        // multicast
  cidrToRange("2001:db8::", 32),   // documentation
  cidrToRange("2001:10::", 28),    // ORCHIDv2
  cidrToRange("2001::", 32),       // Teredo
  cidrToRange("2002::", 16),       // 6to4
  cidrToRange("64:ff9b::", 96),    // NAT64 well-known
  cidrToRange("64:ff9b:1::", 48),  // NAT64 (local)
  cidrToRange("100::", 64)         // discard prefix
];

function isPrivateIPv4(ip: string): boolean {
  const n = parseIPv4(ip);
  if (n === null) return true;
  return V4_BLOCKED_RANGES.some(([start, end]) => inRange(n, start, end));
}

function isPrivateIPv6(ip: string): boolean {
  const n = parseIPv6ToBigInt(ip);
  if (n === null) return true;
  if (!inRangeBig(n, V6_GLOBAL_START, V6_GLOBAL_END)) return true;
  return V6_BLOCKED_RANGES.some(([start, end]) => inRangeBig(n, start, end));
}

function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) {
    if (ip.includes(".")) {
      const v4 = ip.slice(ip.lastIndexOf(":") + 1);
      return isPrivateIPv4(v4);
    }
    return isPrivateIPv6(ip);
  }
  return true;
}

function normalizeLookupOptions(options?: LookupOptions) {
  if (typeof options === "number") return { all: false, family: options };
  return { all: options?.all ?? false, family: options?.family };
}

function errorPrivateAddress() {
  const err = new Error("private_address_blocked");
  (err as any).code = "EHOSTUNREACH";
  return err;
}

export function createPublicHostGuard(options: GuardOptions = {}) {
  const cache = new Map<string, CacheEntry>();
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const allowPrivate = options.allowPrivate ?? false;

  function normalizeHost(host: string): string {
    let h = host.trim();
    if (h.endsWith(".")) {
      while (h.endsWith(".")) h = h.slice(0, -1);
    }
    return h;
  }

  async function assertPublicHost(host: string): Promise<void> {
    if (allowPrivate) return;
    const norm = normalizeHost(host);
    if (!norm) throw errorPrivateAddress();
    const cached = cache.get(norm);
    if (cached && cached.ok && cached.expiresAt > Date.now()) return;
    const lower = norm.toLowerCase();
    if (lower === "localhost" || lower.endsWith(".localhost")) {
      throw errorPrivateAddress();
    }
    if (net.isIP(norm)) {
      if (isPrivateAddress(norm)) throw errorPrivateAddress();
      cache.set(norm, { ok: true, expiresAt: Date.now() + cacheTtlMs });
      return;
    }
    const addresses = await dns.promises.lookup(norm, { all: true });
    if (!addresses.length) throw errorPrivateAddress();
    for (const addr of addresses) {
      if (isPrivateAddress(addr.address)) throw errorPrivateAddress();
    }
    cache.set(norm, { ok: true, expiresAt: Date.now() + cacheTtlMs });
  }

  function lookup(hostname: string, optionsIn: LookupOptions, callback?: any) {
    if (allowPrivate) return (dns.lookup as any)(hostname, optionsIn as any, callback);
    const opts = normalizeLookupOptions(optionsIn);
    const cb = typeof optionsIn === "function" ? optionsIn : callback;
    const family = opts.family;
    const norm = normalizeHost(hostname);
    if (!norm) return cb(errorPrivateAddress());
    const lower = norm.toLowerCase();
    if (lower === "localhost" || lower.endsWith(".localhost")) {
      return cb(errorPrivateAddress());
    }
    if (net.isIP(norm)) {
      if (isPrivateAddress(norm)) return cb(errorPrivateAddress());
      if (opts.all) return cb(null, [{ address: norm, family: net.isIP(norm) }]);
      return cb(null, norm, net.isIP(norm));
    }
    dns.lookup(norm, { all: true }, (err, addresses) => {
      if (err) return cb(err);
      let addrs = addresses || [];
      if (family === 4 || family === 6) {
        addrs = addrs.filter((a) => a.family === family);
      }
      if (!addrs.length) return cb(errorPrivateAddress());
      for (const addr of addrs) {
        if (isPrivateAddress(addr.address)) return cb(errorPrivateAddress());
      }
      if (opts.all) return cb(null, addrs);
      return cb(null, addrs[0].address, addrs[0].family);
    });
  }

  return { assertPublicHost, lookup };
}
