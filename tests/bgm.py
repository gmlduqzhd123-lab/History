"""Background music: off by default, remembered per device, paused on calm screens.

Run against a local static server; see tests/README.md for dependencies.
"""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
BGM = 'media/history-quest-bgm.mp3'

# 모듈 안의 Audio 객체를 확인할 수 있게 재생을 시도한 오디오를 기록한다.
TRACK = '''
const play = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (...args) {
    if (this instanceof HTMLAudioElement) window.__bgm = this;
    return play.apply(this, args);
};
'''


class BackgroundMusic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = sync_playwright().start()
        executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.runner.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()

    def open(self, width=1024):
        context = self.browser.new_context(
            viewport={'width': width, 'height': 800}, locale='ko-KR', service_workers='block'
        )
        self.addCleanup(context.close)
        context.add_init_script(TRACK)
        page = context.new_page()
        page.set_default_timeout(10000)
        errors = []
        requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        self.addCleanup(lambda: self.assertEqual(errors, []))
        page.goto(BASE, wait_until='domcontentloaded')
        expect(page.locator('#app.landing-page')).to_be_visible()
        return page, requests

    def playing(self, page):
        return page.evaluate('() => !!window.__bgm && !window.__bgm.paused')

    def wait_playing(self, page, value):
        page.wait_for_function(
            'value => (!!window.__bgm && !window.__bgm.paused) === value', arg=value, timeout=10000
        )

    def test_off_by_default_and_does_not_download_music(self):
        page, requests = self.open()
        toggle = page.get_by_role('button', name='배경음악', exact=True)
        expect(toggle).to_have_attribute('aria-pressed', 'false')
        page.locator('h1').click()
        page.wait_for_timeout(500)
        self.assertFalse(self.playing(page))
        self.assertFalse([url for url in requests if url.endswith(BGM)])

    def test_toggle_plays_remembers_and_turns_off(self):
        page, _ = self.open(390)
        toggle = page.get_by_role('button', name='배경음악', exact=True)
        toggle.click()
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        self.wait_playing(page, True)
        self.assertTrue(page.evaluate('() => window.__bgm.loop'))
        self.assertEqual(page.evaluate("() => localStorage.getItem('history-quest:bgm')"), 'on')
        self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 390)

        # 다시 열면 켜 둔 설정은 남지만, 브라우저 규칙대로 첫 입력 뒤에 재생한다.
        page.reload(wait_until='domcontentloaded')
        toggle = page.get_by_role('button', name='배경음악', exact=True)
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        page.locator('h1').click()
        self.wait_playing(page, True)

        toggle.click()
        expect(toggle).to_have_attribute('aria-pressed', 'false')
        self.wait_playing(page, False)
        self.assertEqual(page.evaluate("() => localStorage.getItem('history-quest:bgm')"), 'off')

    def test_calm_screens_pause_and_reading_aloud_lowers_volume(self):
        page, _ = self.open()
        page.get_by_role('button', name='배경음악', exact=True).click()
        self.wait_playing(page, True)
        page.wait_for_function('() => window.__bgm.volume > 0.9')
        page.evaluate("() => document.dispatchEvent(new CustomEvent('history:speaking', {detail: true}))")
        page.wait_for_function('() => window.__bgm.volume < 0.35')
        page.evaluate("() => document.dispatchEvent(new CustomEvent('history:speaking', {detail: false}))")
        page.wait_for_function('() => window.__bgm.volume > 0.9')
        page.evaluate("async () => (await import('./js/tone.js')).setCalm(true)")
        self.wait_playing(page, False)
        page.evaluate("async () => (await import('./js/tone.js')).setCalm(false)")
        self.wait_playing(page, True)

    def test_heavy_history_quest_pauses_music_and_map_has_toggle(self):
        page, _ = self.open()
        page.get_by_role('button', name='배경음악', exact=True).click()
        self.wait_playing(page, True)
        page.evaluate('''async () => {
            const {newProfile} = await import('./js/storage.js');
            const {avatars} = await import('./content/quests.js');
            const profile = newProfile(4, avatars[0], '음악 탐험가');
            localStorage.setItem('history-quest:v1', JSON.stringify({current: 'm', profiles: {m: profile}}));
        }''')
        page.goto(BASE + '?open=all', wait_until='domcontentloaded')
        expect(page.locator('.station')).to_have_count(10)
        if page.get_by_role('dialog').count():
            page.keyboard.press('Escape')
        toggle = page.locator('.topbar').get_by_role('button', name='배경음악', exact=True)
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        toggle.focus()
        page.keyboard.press('Space')
        expect(toggle).to_have_attribute('aria-pressed', 'false')
        page.keyboard.press('Space')
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        self.wait_playing(page, True)
        # 6·25 전쟁 정거장은 차분한 화면이라 음악을 멈춘다.
        page.locator('.station').last.click()
        expect(page.locator('body.calm')).to_have_count(1)
        self.wait_playing(page, False)
        page.locator('.topbar').get_by_role('button', name='홈으로', exact=True).click()
        expect(page.locator('#app.landing-page')).to_be_visible()
        self.wait_playing(page, True)


if __name__ == '__main__':
    unittest.main()
