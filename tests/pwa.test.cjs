const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const workerCurrent = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const CURRENT = Number(workerCurrent.match(/const CACHE = 'history-quest-v(\d+)'/)[1]);
const NEXT = CURRENT + 1;
const CURRENT_CACHE = `history-quest-v${CURRENT}`;
const NEXT_CACHE = `history-quest-v${NEXT}`;
const worker30 = fs.readFileSync(path.join(__dirname, 'fixtures/sw-v30.js'), 'utf8');
const workerNext = workerCurrent.replace(`'${CURRENT_CACHE}'`, `'${NEXT_CACHE}'`)
    .replace("    './',", "    './',\n    'js/update-addon.js',");
let browser;

before(async () => {
    const executablePath = process.env.HISTORY_TEST_CHROMIUM
        || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath());
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); });

// Each fixture has an isolated origin. Only the test app changes; the workers are
// the actual historical v30 and shipped worker, plus its simulated next version.
async function fixture(t, version = CURRENT) {
    const state = { version, interruptAddon: false, requests: [] };
    const server = http.createServer((request, response) => {
        const requestUrl = new URL(request.url, 'http://localhost');
        const file = requestUrl.pathname.replace(/^\/History\//, '') || 'index.html';
        state.requests.push(file);
        if (file === 'js/update-addon.js' && state.interruptAddon) {
            request.socket.destroy();
            return;
        }
        response.setHeader('Cache-Control', 'no-store');
        const currentVersion = `v${state.version}`;
        if (file === 'sw.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(state.version === 30 ? worker30 : state.version === CURRENT ? workerCurrent : workerNext);
        } else if (file === 'index.html') {
            response.setHeader('Content-Type', 'text/html');
            response.end('<!doctype html><html><body><script type="module" src="js/app.js"></script></body></html>');
        } else if (file === 'js/app.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`import { version } from './dom.js';
                ${state.version === NEXT ? "import { addon } from './update-addon.js';" : ''}
                if (version !== '${currentVersion}') throw new Error('Mixed app modules: ' + version);
                ${state.version === NEXT ? "if (addon !== version) throw new Error('Mixed new dependency');" : ''}
                window.snapshot = '${currentVersion}';
                document.body.append('${currentVersion}');
                navigator.serviceWorker.register('sw.js');`);
        } else if (file === 'js/dom.js' || file === 'js/update-addon.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`export const ${file === 'js/dom.js' ? 'version' : 'addon'} = '${currentVersion}';`);
        } else if (fs.existsSync(path.join(root, file))) {
            // Require all real precache paths to exist. Their contents are not
            // needed by the small sentinel app that detects mixed modules.
            response.end('fixture asset');
        } else {
            response.writeHead(404);
            response.end('Missing precache asset');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://localhost:${server.address().port}/History/`;
    const context = await browser.newContext();
    t.after(async () => {
        await context.close();
        await new Promise(resolve => server.close(resolve));
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(expected => window.snapshot === expected, `v${version}`);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    return { state, context, page, url };
}

async function controlledReload(page, version) {
    await page.reload();
    await page.waitForFunction(expected => window.snapshot === expected && !!navigator.serviceWorker.controller, `v${version}`);
}

async function update(page) {
    return page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration.update();
        const worker = registration.installing;
        if (!worker) return registration.waiting ? 'installed' : 'none';
        if (worker.state === 'installed' || worker.state === 'redundant') return worker.state;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Worker install did not finish')), 10000);
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' || worker.state === 'redundant') {
                    clearTimeout(timeout);
                    resolve(worker.state);
                }
            });
        });
    });
}

async function reopen(context, page, url, version) {
    await page.close();
    const next = await context.newPage();
    // Closing the final old client permits activation before the next navigation.
    await next.goto(url);
    await next.waitForFunction(expected => window.snapshot === expected, `v${version}`);
    return next;
}

test(`a complete v${CURRENT} snapshot stays coherent online and offline, including query URLs`, async t => {
    const { state, context, page } = await fixture(t);
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), false,
        'First installation must not take over a page that has already begun loading');
    await controlledReload(page, CURRENT);
    state.version = NEXT;
    const start = state.requests.length;
    assert.equal(await page.evaluate(async () => (await import('./js/dom.js?late-read')).version), `v${CURRENT}`);
    assert.equal(state.requests.slice(start).includes('js/dom.js'), false, 'Core assets must not fetch the new server version');
    await context.setOffline(true);
    await controlledReload(page, CURRENT);
});

test(`the shipped v30 worker upgrades to v${CURRENT} only after its controlled page closes`, async t => {
    const { state, context, url } = await fixture(t, 30);
    let page = context.pages()[0];
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    state.version = CURRENT;
    assert.equal(await update(page), 'installed');
    assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true);
    assert.deepEqual((await page.evaluate(() => caches.keys())).sort(), ['history-quest-v30', CURRENT_CACHE]);
    page = await reopen(context, page, url, CURRENT);
    assert.deepEqual(await page.evaluate(() => caches.keys()), [CURRENT_CACHE]);
    await context.setOffline(true);
    await controlledReload(page, CURRENT);
    // v30's network-first behavior before activation is historical and cannot
    // be changed retroactively by shipping a new worker.
});

test(`an interrupted v${NEXT} install preserves v${CURRENT}, then retries into a complete offline v${NEXT}`, async t => {
    const { state, context, url } = await fixture(t);
    let page = context.pages()[0];
    await controlledReload(page, CURRENT);
    state.version = NEXT;
    state.interruptAddon = true;
    assert.notEqual(await update(page), 'installed');
    assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), false);
    await controlledReload(page, CURRENT);
    assert.equal(await page.evaluate(async version => {
        const cache = await caches.open(`history-quest-v${version}`);
        return (await (await cache.match(new URL('js/app.js', location.href))).text()).includes(`'v${version}'`);
    }, CURRENT), true, 'The healthy active app must not be overwritten by partial new files');
    await context.setOffline(true);
    await controlledReload(page, CURRENT);
    await context.setOffline(false);
    state.interruptAddon = false;
    assert.equal(await update(page), 'installed');
    await controlledReload(page, CURRENT);
    page = await reopen(context, page, url, NEXT);
    assert.deepEqual(await page.evaluate(() => caches.keys()), [NEXT_CACHE]);
    await context.setOffline(true);
    await controlledReload(page, NEXT);
    assert.equal(await page.evaluate(async () => (await import('./js/update-addon.js?offline-check')).addon), `v${NEXT}`);
});

test('a waiting update keeps every old tab and late module load on the old snapshot', async t => {
    const { state, context, page, url } = await fixture(t);
    await controlledReload(page, CURRENT);
    const second = await context.newPage();
    await second.goto(url);
    await second.waitForFunction(expected => window.snapshot === expected, `v${CURRENT}`);
    state.version = NEXT;
    assert.equal(await update(page), 'installed');
    await page.close();
    assert.equal(await second.evaluate(async () => (await import('./js/dom.js?other-tab')).version), `v${CURRENT}`);
    assert.equal(await second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true);
    assert.equal(await second.evaluate(async cache => (await caches.keys()).includes(cache), CURRENT_CACHE), true);
    const next = await reopen(context, second, url, NEXT);
    assert.equal(await next.evaluate(() => window.snapshot), `v${NEXT}`);
});
