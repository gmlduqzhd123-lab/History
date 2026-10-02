"""Actual first-install failure, visible retry and a complete offline reload."""
import functools
from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parent.parent


class OfflineReadiness(unittest.TestCase):
    @contextmanager
    def app_fixture(self):
        worker = (ROOT / 'sw.js').read_text()
        version = int(re.search(r"const CACHE = 'history-quest-v(\d+)'", worker)[1])
        state = {'version': version, 'current': version}

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                target = self.path.split('?')[0]
                if target.endswith('/sw.js'):
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/javascript')
                    self.end_headers()
                    self.wfile.write(worker.replace(f'history-quest-v{version}', f"history-quest-v{state['version']}").encode())
                elif target in ('/', '/index.html'):
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.end_headers()
                    body = (ROOT / 'index.html').read_bytes() + f"<!-- snapshot-v{state['version']} -->".encode()
                    self.wfile.write(body)
                else:
                    super().do_GET()

            def end_headers(self):
                self.send_header('Cache-Control', 'no-store')
                super().end_headers()

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://localhost:{server.server_port}/'
        try:
            with sync_playwright() as runner:
                options = {'headless': True}
                binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
                if binary:
                    options['executable_path'] = binary
                browser = runner.chromium.launch(**options)
                try:
                    context = browser.new_context(locale='ko-KR', service_workers='allow')
                    page = context.new_page()
                    page.set_default_timeout(20000)
                    page.goto(url, wait_until='domcontentloaded')
                    expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
                    page.reload(wait_until='domcontentloaded')
                    expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
                    yield context, page, state, url
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def erase_cached_file(self, page, version, file):
        self.assertTrue(page.evaluate('''async ({version, file}) => {
            const cache = await caches.open(`history-quest-v${version}`);
            return cache.delete(new URL(file, location.href));
        }''', {'version': version, 'file': file}))

    def test_missing_required_image_has_retry_and_complete_atomic_repair(self):
        with self.app_fixture() as (context, page, state, _url):
            self.erase_cached_file(page, state['current'], 'img/inquiries/tenant-farmers.svg')
            page.reload(wait_until='domcontentloaded')
            status = page.locator('#offline-status')
            expect(status).to_have_attribute('data-state', 'failed')
            expect(status).to_contain_text('파일을 모두 확인하지 못했어요')
            status.get_by_role('button', name='다시 준비하기').click()
            expect(status).to_have_attribute('data-state', 'ready')
            self.assertTrue(page.evaluate('async () => (await fetch("img/inquiries/tenant-farmers.svg")).ok'))
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('.landing-hero h1')).to_be_visible()
            expect(status).to_have_attribute('data-state', 'ready')

    def test_corrupt_old_snapshot_waits_for_new_version_without_mixing_files(self):
        with self.app_fixture() as (context, page, state, url):
            version = state['current']
            self.erase_cached_file(page, version, 'img/inquiries/tenant-farmers.svg')
            page.reload(wait_until='domcontentloaded')
            status = page.locator('#offline-status')
            expect(status).to_have_attribute('data-state', 'failed')
            state['version'] += 1
            status.get_by_role('button', name='다시 준비하기').click()
            expect(status).to_have_attribute('data-state', 'restart')
            expect(status).to_contain_text('열린 앱 창을 모두 닫고')
            old_snapshot = page.evaluate('''async version => {
                const cache = await caches.open(`history-quest-v${version}`);
                return (await cache.match(new URL('index.html', location.href))).text();
            }''', version)
            self.assertIn(f'snapshot-v{version}', old_snapshot)
            self.assertNotIn(f'snapshot-v{version + 1}', old_snapshot)
            self.assertTrue(page.evaluate('async () => !!(await navigator.serviceWorker.getRegistration()).waiting'))
            page.close()
            context.set_offline(True)
            page = context.new_page()
            page.goto(url, wait_until='domcontentloaded')
            expect(page.locator('.landing-hero h1')).to_be_visible()
            expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
            self.assertEqual(page.evaluate('async () => caches.keys()'), [f'history-quest-v{version + 1}'])

    def test_healthy_active_worker_keeps_ready_when_registration_check_rejects(self):
        with self.app_fixture() as (context, page, _state, _url):
            context.add_init_script('''
                navigator.serviceWorker.register = () => Promise.reject(new TypeError('Synthetic network failure'));
            ''')
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
            self.assertTrue(page.evaluate('navigator.serviceWorker.controller !== null'))

    def test_missing_app_module_has_repair_guidance_and_recovers(self):
        with self.app_fixture() as (_context, page, state, _url):
            self.erase_cached_file(page, state['current'], 'js/app.js')
            page.reload(wait_until='domcontentloaded')
            expect(page.get_by_role('heading', name='앱이 열리지 않고 있어요 😢')).to_be_visible(timeout=25000)
            expect(page.get_by_text('앱 파일을 읽지 못했어요.', exact=False)).to_be_visible()
            status = page.locator('#offline-status')
            expect(status).to_have_attribute('data-state', 'failed')
            status.get_by_role('button', name='다시 준비하기').click()
            expect(status).to_have_attribute('data-state', 'ready')
            page.get_by_role('button', name='새로고침', exact=True).click()
            expect(page.locator('.landing-hero h1')).to_be_visible()
            expect(status).to_have_attribute('data-state', 'ready')

    def check_failure_and_retry(self, failed_path):
        state = {'fail': True}

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                if state['fail'] and self.path.split('?')[0].endswith(failed_path):
                    self.send_error(503, 'Synthetic first-install failure')
                    return
                try:
                    super().do_GET()
                except (BrokenPipeError, ConnectionResetError):
                    # Atomic addAll cancels outstanding asset requests when one fails.
                    pass

            def end_headers(self):
                self.send_header('Cache-Control', 'no-store')
                super().end_headers()

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://localhost:{server.server_port}/'
        try:
            with sync_playwright() as runner:
                options = {'headless': True}
                binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
                if binary:
                    options['executable_path'] = binary
                browser = runner.chromium.launch(**options)
                try:
                    context = browser.new_context(locale='ko-KR', service_workers='allow', viewport={'width': 375, 'height': 812})
                    page = context.new_page()
                    page.set_default_timeout(20000)
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(url, wait_until='domcontentloaded')
                    status = page.locator('#offline-status')
                    expect(status).to_have_attribute('data-state', 'failed')
                    expect(status).to_contain_text('오프라인 준비를 마치지 못했어요')
                    expect(status.get_by_role('button', name='다시 준비하기')).to_be_visible()
                    self.assertTrue(status.evaluate('(element) => element.getBoundingClientRect().bottom < innerHeight'))
                    self.assertFalse(page.evaluate('navigator.serviceWorker.controller !== null'))
                    self.assertFalse(page.evaluate('''async () => {
                        const registration = await navigator.serviceWorker.getRegistration();
                        return !!registration?.active;
                    }'''))
                    expect(page.locator('.landing-hero h1')).to_be_visible()
                    page.keyboard.press('Tab')
                    expect(page.get_by_role('link', name='본문으로 건너뛰기', exact=True)).to_be_focused()
                    page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
                    expect(status).to_have_attribute('data-state', 'failed')
                    page.get_by_role('button', name='← 뒤로', exact=True).click()
                    expect(status).to_have_attribute('data-state', 'failed')
                    state['fail'] = False
                    status.get_by_role('button', name='다시 준비하기').click()
                    expect(status).to_have_attribute('data-state', 'ready')
                    expect(status).to_contain_text('오프라인 준비 완료')
                    expect(status.get_by_role('button', name='다시 준비하기')).to_be_hidden()
                    self.assertTrue(page.evaluate(r'''async () => {
                        const name = (await caches.keys()).find(key => /^history-quest-v\d+$/.test(key));
                        const cache = await caches.open(name);
                        return !!await cache.match(new URL('img/inquiries/tenant-farmers.svg', location.href));
                    }'''))
                    context.set_offline(True)
                    page.reload(wait_until='domcontentloaded')
                    expect(page.locator('.landing-hero h1')).to_be_visible()
                    expect(status).to_have_attribute('data-state', 'ready')
                    self.assertTrue(page.evaluate('navigator.serviceWorker.controller !== null'))
                    self.assertEqual(errors, [])
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_failed_required_asset_has_visible_retry_and_recovers_offline(self):
        self.check_failure_and_retry('img/inquiries/tenant-farmers.svg')

    def test_failed_worker_registration_has_visible_retry_and_recovers_offline(self):
        self.check_failure_and_retry('sw.js')


if __name__ == '__main__':
    unittest.main(verbosity=2)
