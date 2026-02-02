import fs from "node:fs";

function redactValue(value: unknown, patterns: RegExp[]): unknown {
  if (typeof value === "string") return redactText(value, patterns);
  if (value instanceof Error) return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, patterns));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactValue(v, patterns);
    return out;
  }
  return value;
}

export function makeLogger() {
  const patternsPath = process.env.BROKER_REDACT_PATTERNS_PATH ?? "/config/log-redact.patterns.json";
  const patterns = loadRedactPatterns(patternsPath);
  return {
    level: process.env.BROKER_LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.proxy-authorization",
        "req.headers.cookie",
        "req.headers.set-cookie",
        "res.headers.set-cookie",
        "req.body",
        "res.body"
      ],
      censor: "[REDACTED]"
    },
    hooks: {
      logMethod(args: unknown[], method: (...args: unknown[]) => void) {
        if (patterns.length === 0) return method.apply(this, args as []);
        const redactedArgs = args.map((arg) => redactValue(arg, patterns));
        return method.apply(this, redactedArgs as []);
      }
    }
  };
}

export function assertRedactPatterns(path = "/config/log-redact.patterns.json"): RegExp[] {
  const patterns = loadRedactPatterns(path);
  if (patterns.length === 0) {
    throw new Error(`Redaction patterns missing or empty: ${path}`);
  }
  return patterns;
}

export function loadRedactPatterns(path = "/config/log-redact.patterns.json"): RegExp[] {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const json = JSON.parse(raw);
    const patterns: string[] = json.patterns ?? [];
    const compiled: RegExp[] = [];
    for (const rawPattern of patterns) {
      let source = rawPattern;
      let flags = "g";
      if (rawPattern.startsWith("(?i)")) {
        source = rawPattern.slice(4);
        flags = "gi";
      }
      try {
        compiled.push(new RegExp(source, flags));
      } catch {
        // skip invalid pattern
      }
    }
    return compiled;
  } catch {
    return [];
  }
}

export function redactText(input: string, patterns: RegExp[]): string {
  let out = input;
  for (const re of patterns) out = out.replace(re, "[REDACTED]");
  return out;
}
