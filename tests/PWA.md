Service worker regression tests use Node's test runner and Playwright Chromium:

```sh
npm install --no-save --no-package-lock playwright@1.62.0
npx playwright install chromium
node --test tests/pwa.test.cjs
```

In the managed cloud workspace, Playwright and `/usr/bin/chromium` are already
available. Set `HISTORY_TEST_CHROMIUM` to use another existing Chromium binary.

The four browser tests use isolated localhost origins, the historical v30 worker,
the shipped worker, and a simulated next version that adds a new module. The
current and next versions are derived from `sw.js`. They verify:

- A complete cached app stays on one version online and offline.
- v30 can successfully transition to the shipped version after the previous page closes.
- Interrupted installation of a new dependency preserves the healthy current app;
  retrying later installs a complete, working offline next version.
- New workers wait while another old tab is open, preserving its late module loads
  and old cache until activation is safe.

Updates apply after every tab/window using the previous app closes. A refresh
alone can keep the new worker waiting. First visits are not taken over mid-load;
the next navigation uses the installed worker.

An already installed v30 worker retains its historical network-first behavior
until a new version activates. Shipping a new worker cannot repair that old worker's behavior in
place. Protection against interrupted future updates starts with active v31.

For each future app release, increase the cache version in `sw.js` and include
every new local dependency in `FILES`. Core assets are immutable for that worker
version; photos and fonts use a separate runtime cache.
