"""The optional introduction video must play/seek offline without blocking the app."""
import base64
from contextlib import contextmanager
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
from threading import Thread
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parent.parent
VIDEO = 'media/history-quest-guide.mp4'


class GuideVideoOffline(unittest.TestCase):
    @contextmanager
    def app_fixture(self, fail_video=False):
        state = {'fail_video': fail_video, 'video_requests': []}

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                if self.path.split('?')[0].endswith('/' + VIDEO):
                    state['video_requests'].append(self.headers.get('Range'))
                    if state['fail_video']:
                        self.send_error(503, 'Synthetic optional-video failure')
                        return
                try:
                    super().do_GET()
                except (BrokenPipeError, ConnectionResetError):
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
                options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
                binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
                if binary:
                    options['executable_path'] = binary
                browser = runner.chromium.launch(**options)
                try:
                    context = browser.new_context(locale='ko-KR', service_workers='allow')
                    page = context.new_page()
                    page.set_default_timeout(30000)
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(url, wait_until='domcontentloaded')
                    expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
                    self.assertEqual(state['video_requests'], [], 'Core installation must not download the MP4.')
                    page.reload(wait_until='domcontentloaded')
                    expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
                    self.assertTrue(page.evaluate('!!navigator.serviceWorker.controller'))
                    yield context, page, state
                    self.assertEqual(errors, [])
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def fetch_video(self, page, byte_range=None):
        return page.evaluate('''async ({file, range}) => {
            const response = await fetch(file, range ? {headers: {Range: range}} : {});
            const bytes = new Uint8Array(await response.arrayBuffer());
            let encoded = '';
            // The requested fragments are small; whole-file checks only need their size.
            if (bytes.length <= 1024) encoded = btoa(String.fromCharCode(...bytes));
            return {
                status: response.status, length: bytes.length, encoded,
                contentRange: response.headers.get('Content-Range'),
                acceptRanges: response.headers.get('Accept-Ranges'),
                contentLength: response.headers.get('Content-Length'),
            };
        }''', {'file': VIDEO, 'range': byte_range})

    def test_unavailable_optional_video_does_not_block_install_or_learning(self):
        with self.app_fixture(fail_video=True) as (context, page, state):
            result = self.fetch_video(page, 'bytes=0-127')
            self.assertEqual(result['status'], 503)
            self.assertEqual(state['video_requests'], [None])
            expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
            page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
            page.get_by_label('이름', exact=True).fill('영상 없이 탐험')
            page.locator('.num-grid').get_by_role('button', name='3', exact=True).click()
            page.get_by_role('button', name='캐릭터 🦊', exact=True).click()
            page.get_by_role('button', name='🚀 탐험 시작!', exact=True).click()
            expect(page.locator('.station')).to_have_count(10)

    def test_ranges_match_the_whole_file_and_remain_available_offline(self):
        source = (ROOT / VIDEO).read_bytes()
        size = len(source)
        with self.app_fixture() as (context, page, state):
            for byte_range, start, end in (
                ('bytes=0-127', 0, 127),
                ('bytes=-64', size - 64, size - 1),
                (f'bytes={size - 80}-', size - 80, size - 1),
                (f'bytes={size - 32}-{size + 100}', size - 32, size - 1),
            ):
                with self.subTest(range=byte_range):
                    result = self.fetch_video(page, byte_range)
                    self.assertEqual(result['status'], 206)
                    self.assertEqual(result['contentRange'], f'bytes {start}-{end}/{size}')
                    self.assertEqual(result['acceptRanges'], 'bytes')
                    self.assertEqual(result['contentLength'], str(end - start + 1))
                    self.assertEqual(base64.b64decode(result['encoded']), source[start:end + 1])
            for invalid in (f'bytes={size}-', 'bytes=10-2', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=word'):
                with self.subTest(range=invalid):
                    result = self.fetch_video(page, invalid)
                    self.assertEqual(result['status'], 416)
                    self.assertEqual(result['contentRange'], f'bytes */{size}')
                    self.assertEqual(result['length'], 0)
            full = self.fetch_video(page)
            self.assertEqual((full['status'], full['length']), (200, size))
            self.assertEqual(state['video_requests'], [None], 'Range requests must share one complete download.')
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
            result = self.fetch_video(page, 'bytes=16-47')
            self.assertEqual(result['status'], 206)
            self.assertEqual(base64.b64decode(result['encoded']), source[16:48])
            self.assertEqual(state['video_requests'], [None])

    def play_and_seek(self, page):
        video = page.locator('video')
        expect(video).to_have_count(1)
        page.evaluate('''async () => {
            const video = document.querySelector('video');
            video.muted = true;
            await video.play();
        }''')
        page.wait_for_function('''() => {
            const video = document.querySelector('video');
            return video.duration > 20 && video.currentTime > .2 && !video.paused && !video.error;
        }''')
        page.evaluate('''() => {
            const video = document.querySelector('video');
            video.currentTime = video.duration - 4;
        }''')
        page.wait_for_function('''() => {
            const video = document.querySelector('video');
            return !video.seeking && video.currentTime > video.duration - 3.8 && !video.error;
        }''')
        page.evaluate('document.querySelector("video").pause()')

    def test_native_player_plays_and_seeks_after_an_offline_reload(self):
        with self.app_fixture() as (context, page, state):
            self.play_and_seek(page)
            self.assertEqual(state['video_requests'], [None])
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('#offline-status')).to_have_attribute('data-state', 'ready')
            self.play_and_seek(page)
            self.assertEqual(state['video_requests'], [None])


if __name__ == '__main__':
    unittest.main(verbosity=2)
