"""Keyboard screen transitions, welcome tabs and selection state regressions."""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')


class AccessibilityNavigation(unittest.TestCase):
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

    def page(self):
        context = self.browser.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(10000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        self.addCleanup(lambda: self.assertEqual(errors, []))
        page.goto(BASE, wait_until='domcontentloaded')
        return page

    def explorer(self, page, done=False):
        page.evaluate('''async done => {
            const {newProfile} = await import('./js/storage.js');
            const profile = newProfile(8, '🐼', '키보드 점검');
            if (done) for (let i = 1; i <= 10; i++) {
                profile.quests['q' + i] = {stage: 5, done: true, notes: []};
            }
            localStorage.setItem('history-quest:v1', JSON.stringify({
                current: 'accessibility-test', profiles: {'accessibility-test': profile},
            }));
        }''', done)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.station')).to_have_count(10)

    def test_keyboard_navigation_starts_at_new_screen_content(self):
        page = self.page()
        self.explorer(page)
        page.locator('.station.open').focus()
        page.keyboard.press('Enter')
        expect(page.locator('.stage-head h2')).to_be_focused()
        page.keyboard.press('Tab')
        self.assertTrue(page.locator('#app').evaluate('(el) => el.contains(document.activeElement)'))
        self.assertFalse(page.get_by_role('button', name='홈으로', exact=True).evaluate('(el) => el === document.activeElement'))
        page.get_by_role('button', name='🗺️ 지도', exact=True).focus()
        page.keyboard.press('Enter')
        expect(page.get_by_role('heading', name='안녕, 키보드 점검 탐험가! 🐼', exact=True)).to_be_focused()
        page.get_by_role('button', name='홈으로', exact=True).focus()
        page.keyboard.press('Enter')
        expect(page.locator('#landing-title')).to_be_focused()

    def test_welcome_tabs_use_arrow_keys_wrap_and_one_tab_stop(self):
        page = self.page()
        expect(page.locator('#tab-start')).to_have_attribute('tabindex', '0')
        expect(page.locator('#tab-help')).to_have_attribute('tabindex', '-1')
        page.locator('#tab-start').focus()
        for key, selected in (
            ('ArrowRight', 'help'), ('ArrowRight', 'start'),
            ('ArrowLeft', 'help'), ('Home', 'start'), ('End', 'help'),
        ):
            with self.subTest(key=key, selected=selected):
                page.keyboard.press(key)
                expect(page.locator(f'#tab-{selected}')).to_be_focused()
                expect(page.locator(f'#tab-{selected}')).to_have_attribute('aria-selected', 'true')
                expect(page.locator('#welcome-panel')).to_have_attribute('aria-labelledby', f'tab-{selected}')
                expect(page.locator('[role="tab"][tabindex="0"]')).to_have_count(1)
                self.assertTrue(page.locator(f'#tab-{selected}').evaluate('''el => {
                    const r = el.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1;
                }'''))
        page.keyboard.press('Tab')
        self.assertTrue(page.locator('#welcome-panel').evaluate('(el) => el.contains(document.activeElement)'))
        page.locator('#tab-start').click()
        expect(page.locator('#tab-start')).to_be_focused()
        page.keyboard.press('Tab')
        expect(page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True)).to_be_focused()

    def test_avatar_selection_has_one_pressed_state(self):
        page = self.page()
        page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
        expect(page.locator('.avatar-grid button[aria-pressed="true"]')).to_have_count(1)
        expect(page.locator('.avatar-grid button[aria-pressed="false"]')).to_have_count(9)
        panda = page.get_by_role('button', name='캐릭터 🐼', exact=True)
        panda.focus()
        page.keyboard.press('Space')
        expect(panda).to_be_focused()
        expect(panda).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('.avatar-grid button[aria-pressed="true"]')).to_have_count(1)
        expect(page.locator('.avatar-grid button.on')).to_have_attribute('aria-label', '캐릭터 🐼')

    def test_place_selection_keeps_keyboard_focus_and_modal_restores_it(self):
        page = self.page()
        self.explorer(page, done=True)
        page.get_by_role('button', name='문화유산 지도', exact=False).click()
        chip = page.locator('.place-chip').first
        label = chip.text_content()
        chip.focus()
        page.keyboard.press('Enter')
        selected = page.locator('.place-chip.selected')
        expect(selected).to_have_text(label)
        expect(selected).to_be_focused()
        opener = page.get_by_role('button', name='탐험가 메뉴', exact=True)
        opener.click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_be_visible()
        for _ in range(10):
            page.keyboard.press('Tab')
            self.assertTrue(dialog.evaluate('(el) => el.contains(document.activeElement)'))
        page.keyboard.press('Escape')
        expect(opener).to_be_focused()


if __name__ == '__main__':
    unittest.main()
