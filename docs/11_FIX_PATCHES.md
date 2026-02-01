# Patch Plan - MVP Broker Hardening + Tests

This file contains the exact diffs and commands to address all review findings (redaction, schema mount, start path, mTLS test gap, fixture hygiene). Apply in order.

## Patch 1 - Mount schema + redaction patterns in docker-compose.yml

```diff
*** Begin Patch
*** Update File: docker-compose.yml
@@
     volumes:
       - ./broker/config/actions.default.json:/config/actions.json:ro
+      - ./broker/config/actions.schema.json:/config/actions.schema.json:ro
+      - ./broker/config/log-redact.patterns.json:/config/log-redact.patterns.json:ro
       - ./broker/certs:/certs:ro
*** End Patch
```

## Patch 2 - Make redaction patterns robust (support inline (?i) and skip bad patterns)

```diff
*** Begin Patch
*** Update File: broker/src/redact.ts
@@
 export function loadRedactPatterns(path = "/config/log-redact.patterns.json"): RegExp[] {
   try {
     const raw = fs.readFileSync(path, "utf8");
     const json = JSON.parse(raw);
     const patterns: string[] = json.patterns ?? [];
-    return patterns.map((p) => new RegExp(p, "g"));
+    const compiled: RegExp[] = [];
+    for (const rawPattern of patterns) {
+      let source = rawPattern;
+      let flags = "g";
+      if (rawPattern.startsWith("(?i)")) {
+        source = rawPattern.slice(4);
+        flags = "gi";
+      }
+      try {
+        compiled.push(new RegExp(source, flags));
+      } catch {
+        // skip invalid pattern
+      }
+    }
+    return compiled;
   } catch {
     return [];
   }
 }
*** End Patch
```

## Patch 3 - Fix local start path to match build output

```diff
*** Begin Patch
*** Update File: broker/package.json
@@
-    "start": "node dist/server.js",
+    "start": "node dist/src/server.js",
*** End Patch
```

## Patch 4 - Add mTLS negative test for untrusted client cert

```diff
*** Begin Patch
*** Update File: broker/test/broker.mtls.test.ts
@@
 const ca = fs.readFileSync(path.join(fixturesDir, "ca.crt"));
 const clientCert = fs.readFileSync(path.join(fixturesDir, "client.crt"));
 const clientKey = fs.readFileSync(path.join(fixturesDir, "client.key"));
 const wrongCa = fs.readFileSync(path.join(fixturesDir, "wrong-ca.crt"));
+const wrongClientCert = fs.readFileSync(path.join(fixturesDir, "wrong-client.crt"));
+const wrongClientKey = fs.readFileSync(path.join(fixturesDir, "wrong-client.key"));
@@
 test("mTLS rejects wrong CA", async () => {
   await assert.rejects(() => httpsHealth({ ca: wrongCa, cert: clientCert, key: clientKey }));
 });
+
+test("mTLS rejects untrusted client cert", async () => {
+  await assert.rejects(() => httpsHealth({ ca, cert: wrongClientCert, key: wrongClientKey }));
+});
*** End Patch
```

## Patch 5 - Add wrong-client cert/key fixtures (test-only)

Run these commands from `broker/test/fixtures/`:

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout wrong-client.key \
  -out wrong-client.crt \
  -subj "/CN=wrong-client" \
  -days 365
```

Then add the generated files:
- `broker/test/fixtures/wrong-client.key`
- `broker/test/fixtures/wrong-client.crt`

## Patch 6 - Document fixture safety (test-only keys)

```diff
*** Begin Patch
*** Add File: broker/test/fixtures/README.md
+Test-only TLS fixtures for broker tests.
+Do NOT use these keys or certs in production.
*** End Patch
```

## Notes
- Package-lock.json: keep it if you want deterministic builds (recommended). No patch required.
- Re-run: `npm run build` and `npm test` inside `broker/` after applying patches.
