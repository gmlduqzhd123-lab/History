"""Actual first-install failure, visible retry and a complete offline reload."""
import functools
import os
from pathlib import Path
import shutil
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parent.parent


class OfflineReadiness(unittest.TestCase):
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
