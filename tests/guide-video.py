"""Usage-video entry, accessible instructions, real playback and responsive layout.

Run against a local static server; see tests/README.md for dependencies.
"""
import os
import re
import shutil
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
MEDIA = 'media/history-quest-guide.mp4'


class RangeHandler(SimpleHTTPRequestHandler):
    """Pages exposes byte ranges; Python's stock static server does not."""

    def log_message(self, *args):
        pass

    def do_GET(self):
        if urlsplit(self.path).path != '/' + MEDIA:
            return super().do_GET()
        body = (Path(self.directory) / MEDIA).read_bytes()
        length = len(body)
        match = re.fullmatch(r'bytes=(\d+)-(\d*)', self.headers.get('Range', ''))
        start, end = 0, length - 1
        if match:
            start = int(match[1])
            end = min(int(match[2]) if match[2] else end, end)
            if start > end:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{length}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
        self.send_response(206 if match else 200)
        self.send_header('Content-Type', 'video/mp4')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end - start + 1))
        if match:
            self.send_header('Content-Range', f'bytes {start}-{end}/{length}')
        self.end_headers()
        self.wfile.write(body[start:end + 1])


class GuideVideo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = sync_playwright().start()
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.runner.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()

    def page(self, width=1280, base=BASE):
        context = self.browser.new_context(
            viewport={'width': width, 'height': 900}, locale='ko-KR', service_workers='block'
        )
        self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(10000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        self.addCleanup(lambda: self.assertEqual(errors, []))
        requests = []
        page.on('request', lambda request: requests.append(request.url))
        page.goto(base, wait_until='domcontentloaded')
        expect(page.locator('#app.landing-page')).to_be_visible()
        return page, requests

    def test_player_has_native_controls_captions_and_complete_written_instructions(self):
        page, _ = self.page()
        guide = page.get_by_role('region', name='역사 탐험, 이렇게 시작해요.', exact=True)
        expect(guide).to_be_visible()
        video = guide.locator('video')
        for attribute in ('controls', 'playsinline'):
            self.assertTrue(video.evaluate('(el, key) => el.hasAttribute(key)', attribute))
        self.assertFalse(video.evaluate('el => el.hasAttribute("autoplay")'))
        expect(video).to_have_attribute('preload', 'none')
        expect(video).to_have_attribute('poster', 'media/history-quest-guide-poster.jpg')
        expect(video).to_have_attribute('width', '1280')
        expect(video).to_have_attribute('height', '720')
        expect(video).to_have_attribute('tabindex', '-1')
        expect(video).to_have_attribute('aria-hidden', 'true')
        expect(guide.get_by_role('button', name='45초 사용법 영상 재생하기', exact=True)).to_be_visible()
        expect(video).to_have_attribute('aria-describedby', 'landing-video-note')
        expect(video.locator('source')).to_have_attribute('src', MEDIA)
        expect(video.locator('source')).to_have_attribute('type', 'video/mp4')
        track = video.locator('track')
        expect(track).to_have_attribute('kind', 'captions')
        expect(track).to_have_attribute('srclang', 'ko')
        expect(track).to_have_attribute('src', 'media/history-quest-guide.ko.vtt')
        self.assertTrue(track.evaluate('el => el.hasAttribute("default")'))
        expect(guide.locator('ol li')).to_have_count(5)
        expect(guide.locator('ol')).to_contain_text('이름·번호·캐릭터')
        expect(guide.locator('ol')).to_contain_text('다섯 단계')
        expect(guide.locator('ol')).to_contain_text('자료 탐구와 역사 일기')
        expect(guide.locator('ol')).to_contain_text('PDF로 보관')
        expect(guide.locator('ol')).to_contain_text('진도만 옮겨요')
        expect(guide.locator('figcaption')).to_contain_text('처음 영상을 볼 때는 인터넷 연결이 필요해요.')

    def test_movie_waits_for_user_playback_and_does_not_create_student_records(self):
        page, requests = self.page()
        page.evaluate('document.fonts.ready')
        video = page.locator('#video-guide video')
        self.assertTrue(video.evaluate('el => el.paused'))
        self.assertEqual(video.evaluate('el => el.currentTime'), 0)
        self.assertFalse(any(url.endswith(MEDIA) for url in requests),
                         'The introductory movie must not download during an ordinary first visit.')
        self.assertIsNone(page.evaluate('localStorage.getItem("history-quest:v1")'))

    def test_failed_video_shows_connection_guidance_and_user_can_retry(self):
        page, _ = self.page(390)
        page.route('**/' + MEDIA, lambda route: route.abort())
        video = page.locator('#video-guide video')
        cover = page.get_by_role('button', name='45초 사용법 영상 재생하기', exact=True)
        cover.focus()
        page.keyboard.press('Enter')
        status = page.locator('#video-guide [role="status"]')
        expect(status).to_contain_text('인터넷 연결을 확인')
        expect(cover).to_be_hidden()
        direct = page.get_by_role('link', name='영상 파일 열기', exact=True)
        expect(direct).to_have_attribute('href', MEDIA)
        expect(direct).to_have_attribute('target', '_blank')
        retry = page.get_by_role('button', name='다시 재생하기', exact=True)
        expect(retry).to_be_visible()
        page.unroute('**/' + MEDIA)
        retry.focus()
        page.keyboard.press('Enter')
        page.wait_for_function('''() => {
            const video = document.querySelector('#video-guide video');
            return video.readyState >= 2 && !video.paused && video.currentTime > 0;
        }''', timeout=20000)
        expect(status).to_have_text('')
        expect(retry).to_be_hidden()
        expect(page.locator('#video-guide ol li')).to_have_count(5)
        self.assertIsNone(page.evaluate('localStorage.getItem("history-quest:v1")'))

    def test_cover_button_keyboard_play_exposes_native_controls_and_moves_focus(self):
        page, _ = self.page(390)
        cover = page.get_by_role('button', name='45초 사용법 영상 재생하기', exact=True)
        video = page.locator('#video-guide video')
        expect(cover).to_be_visible()
        expect(video).to_have_attribute('tabindex', '-1')
        cover.focus()
        page.keyboard.press('Tab')
        expect(video).not_to_be_focused()
        page.keyboard.press('Shift+Tab')
        expect(cover).to_be_focused()
        page.keyboard.press('Enter')
        page.wait_for_function('''() => {
            const video = document.querySelector('#video-guide video');
            return video.readyState >= 2 && !video.paused && video.currentTime > 0;
        }''', timeout=20000)
        expect(cover).to_be_hidden()
        expect(video).to_have_attribute('tabindex', '0')
        self.assertIsNone(video.get_attribute('aria-hidden'))
        expect(video).to_be_focused()
        self.assertTrue(video.evaluate('el => el.controls'))
        page.keyboard.press('Space')
        page.wait_for_function('document.querySelector("#video-guide video").paused')
        expect(cover).to_be_hidden()
        expect(video).to_be_focused()

    def test_video_links_keyboard_focus_and_font_loaded_layout_fit_small_and_large_screens(self):
        for width in (320, 390, 768, 840, 1024, 1440):
            with self.subTest(width=width):
                page, _ = self.page(width)
                page.evaluate('document.fonts.ready')
                navigation = page.get_by_role('navigation', name='메인 메뉴', exact=True)
                link = navigation.get_by_role('link', name='사용법 영상', exact=True)
                link.focus()
                expect(link).to_be_focused()
                page.keyboard.press('Enter')
                self.assertEqual(page.evaluate('location.hash'), '#video-guide')
                expect(page.locator('#video-guide')).to_be_visible()
                video = page.locator('#video-guide video')
                video.focus()
                expect(video).to_be_focused()
                self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), width)
                box = video.bounding_box()
                self.assertGreater(box['width'], 250)
                self.assertGreaterEqual(box['x'], 0)
                self.assertLessEqual(box['x'] + box['width'], width)
                expect(page.get_by_role('link', name='사용법 영상 보기 →', exact=True)).to_have_attribute('href', '#video-guide')

    def test_real_mp4_plays_pauses_seeks_and_loads_korean_cues(self):
        # Test the real file against the HTTP feature that native seeking needs.
        # All other checks retain the developer's configured static origin.
        handler = partial(RangeHandler, directory=str(Path(__file__).resolve().parent.parent))
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def close_server():
            server.shutdown()
            server.server_close()
            thread.join()

        self.addCleanup(close_server)
        page, _ = self.page(base=f'http://127.0.0.1:{server.server_port}/')
        video = page.locator('#video-guide video')
        video.focus()
        page.keyboard.press('Space')
        page.wait_for_function('''() => {
            const video = document.querySelector('#video-guide video');
            return video.readyState >= 2 && !video.paused && video.currentTime > 0;
        }''', timeout=20000)
        metadata = video.evaluate('el => ({duration: el.duration, width: el.videoWidth, height: el.videoHeight})')
        self.assertGreater(metadata['duration'], 10)
        self.assertLess(metadata['duration'], 120)
        self.assertGreaterEqual(metadata['width'], 640)
        self.assertGreaterEqual(metadata['height'], 360)
        video.focus()
        page.keyboard.press('Space')
        page.wait_for_function('document.querySelector("#video-guide video").paused')
        target = min(20, metadata['duration'] / 2)
        video.evaluate('(el, time) => { el.currentTime = time; }', target)
        page.wait_for_function('''time => {
            const video = document.querySelector('#video-guide video');
            return !video.seeking && Math.abs(video.currentTime - time) < .25;
        }''', arg=target)
        page.wait_for_function('''() => {
            const video = document.querySelector('#video-guide video');
            return video.textTracks.length === 1 && video.textTracks[0].cues?.length > 0;
        }''')
        captions = video.evaluate('''el => ({
            language: el.textTracks[0].language,
            mode: el.textTracks[0].mode,
            cues: Array.from(el.textTracks[0].cues, cue => cue.text),
        })''')
        self.assertEqual(captions['language'], 'ko')
        self.assertEqual(captions['mode'], 'showing')
        self.assertTrue(any('탐험' in text for text in captions['cues']))
        self.assertIsNone(page.evaluate('localStorage.getItem("history-quest:v1")'))


if __name__ == '__main__':
    unittest.main()
