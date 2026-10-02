"""Landing-page navigation, classroom entry and preserved student records.

Run against a local static server; see tests/README.md for dependencies.
"""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
KEY = 'history-quest:v1'
NEW_EXPLORER = '🙋 새 탐험가로 시작하기'
RESUME = '💾 이어하기 코드로 계속하기'


class LandingPage(unittest.TestCase):
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

    def page(self, width=1024):
        context = self.browser.new_context(
            viewport={'width': width, 'height': 800}, locale='ko-KR', service_workers='block'
        )
        self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(10000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        self.addCleanup(lambda: self.assertEqual(errors, []))
        page.goto(BASE, wait_until='domcontentloaded')
        expect(page.locator('#app.landing-page')).to_be_visible()
        return page

    def saved(self, page):
        return page.evaluate('key => JSON.parse(localStorage.getItem(key))', KEY)

    def seed(self, page):
        return page.evaluate('''async key => {
            const {newProfile} = await import('./js/storage.js');
            const {encodeProgress} = await import('./js/code.js');
            const {questOrder, avatars} = await import('./content/quests.js');
            const profile = newProfile(7, avatars[2], '기록 지킴이');
            profile.quests.q1 = {
                stage: 5, done: true, notes: ['유물을 보고 옛사람들의 생활을 알 수 있어요.'],
                mastery: {passed: true, score: 5},
            };
            profile.extras.inquiries['landing-record'] = {
                answers: {observation: '자료에서 본 사실과 생각을 구별했어요.'},
                evidence: ['source-1'], checks: [true], savedAt: 1700000000000,
            };
            const data = {current: 'landing-test', profiles: {'landing-test': profile}};
            localStorage.setItem(key, JSON.stringify(data));
            return {data, code: encodeProgress(profile, questOrder, avatars)};
        }''', KEY)

    def test_first_visit_has_single_entry_buttons_responsive_sections_and_keyboard_skip(self):
        for width in (320, 390, 768, 1440):
            with self.subTest(width=width):
                page = self.page(width)
                expect(page.locator('#app h1')).to_have_count(1)
                expect(page.get_by_role('button', name=NEW_EXPLORER, exact=True)).to_have_count(1)
                expect(page.get_by_role('button', name=RESUME, exact=True)).to_have_count(1)
                nav = page.get_by_role('navigation', name='메인 메뉴', exact=True)
                expect(nav).to_be_visible()
                for target in ('learning', 'curriculum', 'classroom'):
                    link = nav.locator(f'a[href="#{target}"]')
                    expect(link).to_have_count(1)
                    link.click()
                    expect(page.locator(f'#{target}')).to_be_visible()
                    self.assertEqual(page.evaluate('location.hash'), f'#{target}')
                self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), width)
                page.goto(BASE, wait_until='domcontentloaded')
                page.keyboard.press('Tab')
                expect(page.get_by_role('link', name='본문으로 건너뛰기', exact=True)).to_be_focused()
                page.keyboard.press('Enter')
                expect(page.locator('#landing-content')).to_be_focused()
                expect(page.get_by_role('link', name='이 기기의 기록 찾기 →', exact=True)).to_have_count(0)
                page.get_by_role('button', name='코드로 이어하기 →', exact=True).click()
                expect(page.locator('#app.landing-page')).to_have_count(0)
                expect(page.get_by_label('이어하기 코드', exact=True)).to_be_visible()
                self.assertIsNone(self.saved(page), 'Opening the code form must not create a student record.')
                page.get_by_role('button', name='← 뒤로', exact=True).click()
                expect(page.locator('#app.landing-page')).to_be_visible()

    def test_classroom_qr_and_detailed_help_use_existing_interfaces(self):
        page = self.page(390)
        opener = page.get_by_role('button', name='교실 QR 코드 띄우기', exact=True)
        opener.click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_be_visible()
        expect(dialog.locator('img.qr-big')).to_have_attribute('src', 'icons/qr.svg')
        expect(dialog).to_contain_text('gmlduqzhd123-lab.github.io/History/')
        page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(opener).to_be_focused()
        page.get_by_role('button', name='자세한 사용법 보기', exact=True).click()
        expect(page.get_by_role('tab', name='📖 사용법', exact=True)).to_have_attribute('aria-selected', 'true')
        expect(page.get_by_role('heading', name='🙋 처음 시작할 때', exact=True)).to_be_visible()
        page.get_by_role('button', name='🚀 이제 시작하러 가기', exact=True).click()
        expect(page.locator('#app.landing-page')).to_be_visible()
        expect(page.get_by_role('button', name=NEW_EXPLORER, exact=True)).to_be_visible()

    def test_new_student_can_register_return_home_and_continue_their_record(self):
        page = self.page(390)
        page.get_by_role('button', name=NEW_EXPLORER, exact=True).click()
        expect(page.locator('#app.landing-page')).to_have_count(0)
        page.get_by_label('이름', exact=True).fill('새 탐험가')
        page.locator('.num-grid').get_by_role('button', name='3', exact=True).click()
        page.get_by_role('button', name='캐릭터 🦊', exact=True).click()
        page.get_by_role('button', name='🚀 탐험 시작!', exact=True).click()
        expect(page.locator('.station')).to_have_count(10)
        if page.get_by_role('dialog').count():
            page.keyboard.press('Escape')
        before = self.saved(page)
        self.assertEqual(len(before['profiles']), 1)
        profile = before['profiles'][before['current']]
        self.assertEqual((profile['number'], profile['name'], profile['avatar']), (3, '새 탐험가', '🦊'))
        page.get_by_role('button', name='홈으로', exact=True).click()
        expect(page.locator('#app.landing-page')).to_be_visible()
        page.locator('.explorer-list button').filter(has_text='새 탐험가').click()
        expect(page.locator('.station')).to_have_count(10)
        expect(page.locator('#app.landing-page')).to_have_count(0)
        self.assertEqual(self.saved(page), before)

    def test_existing_single_student_reopens_map_and_keeps_notes_after_home_navigation(self):
        page = self.page()
        seeded = self.seed(page)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.station')).to_have_count(10)
        expect(page.locator('#app.landing-page')).to_have_count(0)
        page.get_by_role('button', name='홈으로', exact=True).click()
        expect(page.locator('#app.landing-page')).to_be_visible()
        page.get_by_role('button', name='내 탐험 이어가기', exact=True).click()
        expect(page.locator('.station.done')).to_have_count(1)
        expect(page.locator('#app.landing-page')).to_have_count(0)
        self.assertEqual(self.saved(page), seeded['data'])
        page.get_by_role('button', name='홈으로', exact=True).click()
        records_link = page.get_by_role('link', name='이 기기의 기록 찾기 →', exact=True)
        expect(records_link).to_have_attribute('href', '#start')
        records_link.click()
        self.assertEqual(page.evaluate('location.hash'), '#start')
        page.locator('.explorer-list button').filter(has_text='기록 지킴이').click()
        expect(page.locator('.station.done')).to_have_count(1)
        self.assertEqual(self.saved(page), seeded['data'])

    def test_resume_code_opens_map_and_preserves_existing_written_work(self):
        page = self.page()
        seeded = self.seed(page)
        page.reload(wait_until='domcontentloaded')
        page.get_by_role('button', name='홈으로', exact=True).click()
        page.get_by_role('button', name=RESUME, exact=True).click()
        expect(page.locator('#app.landing-page')).to_have_count(0)
        page.get_by_label('이어하기 코드', exact=True).fill(seeded['code'])
        page.get_by_label('이름', exact=True).fill('기록 지킴이')
        page.get_by_role('button', name='계속하기', exact=True).click()
        expect(page.locator('.station')).to_have_count(10)
        expect(page.locator('.station.done')).to_have_count(1)
        self.assertEqual(self.saved(page), seeded['data'])


if __name__ == '__main__':
    unittest.main()
