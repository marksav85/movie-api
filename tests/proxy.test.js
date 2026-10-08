const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const run = (value, script) => spawnSync(process.execPath, ["-e", script], {
  cwd: path.resolve(__dirname, ".."),
  env: {
    ...process.env,
    JWT_SECRET: "isolated-proxy-test-secret-at-least-32-bytes",
    NODE_ENV: "test",
    TRUST_PROXY_HOPS: value,
    LOGIN_RATE_LIMIT_MAX: "2",
    API_RATE_LIMIT_MAX: "1000",
  },
  encoding: "utf8",
});

test("proxy hop configuration defaults to zero and rejects unsafe or malformed values", () => {
  for (const value of [undefined, "0", "1"]) {
    const result = run(value, `require('node:assert/strict').equal(require('./config').trustProxyHops, ${value === "1" ? 1 : 0})`);
    assert.equal(result.status, 0, result.stderr);
  }
  for (const value of ["", "true", "2", "-1", "1junk", "1.0", " 1", "Infinity"]) {
    const result = run(value, "require('./config')");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TRUST_PROXY_HOPS must be/);
  }
});

for (const hops of ["0", "1"]) {
  test(`forwarded IPs and login rate limiting with TRUST_PROXY_HOPS=${hops}`, () => {
    const result = run(hops, `
      const assert = require('node:assert/strict');
      const request = require('supertest');
      const app = require('./app');
      const trusted = ${hops === "1"};
      // Observe Express IP resolution without adding any application route.
      let observed;
      const original = app.handle;
      app.handle = function (req, res, next) {
        res.on('finish', () => { observed = req.ip; });
        return original.call(this, req, res, next);
      };
      (async () => {
        const send = (xff) => {
          const req = request(app).post('/login').send({});
          return xff ? req.set('X-Forwarded-For', xff) : req;
        };
        assert.equal((await send()).status, 400);
        const socketIp = observed;
        app.locals.loginLimiterStore.resetAll();
        assert.equal((await send('198.51.100.10')).status, 400);
        assert.equal(observed, trusted ? '198.51.100.10' : socketIp);
        assert.equal((await send('203.0.113.99, 198.51.100.10')).status, 400);
        assert.equal(observed, trusted ? '198.51.100.10' : socketIp);
        assert.equal((await send('203.0.113.88, 198.51.100.10')).status, 429);
        // A spoofed leftmost address cannot evade either limiter configuration.
        assert.equal((await send('198.51.100.11')).status, trusted ? 400 : 429);
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}
