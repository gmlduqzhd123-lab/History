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
                # 첫 화면에서 바로 보이는 정거장 지도와 시작 단추
                expect(page.locator('.landing-journey li')).to_have_count(10)
                expect(page.locator('.landing-resume')).to_have_count(0)
                start = page.get_by_role('button', name=NEW_EXPLORER, exact=True)
                self.assertLessEqual(start.evaluate('el => el.getBoundingClientRect().bottom'), 800)
                page.get_by_role('button', name=RESUME, exact=True).click()
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
        expect(page.get_by_role('heading', name='역사 탐험 사용법', exact=True)).to_be_visible()
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
        expect(page.locator('.landing-resume')).to_contain_text('새 탐험가')
        page.get_by_role('button', name='이어서 탐험하기', exact=True).click()
        expect(page.locator('.station')).to_have_count(10)
        expect(page.locator('#app.landing-page')).to_have_count(0)
        self.assertEqual(self.saved(page), before)

    def test_shared_tablet_lists_other_explorers_under_the_last_one(self):
        page = self.page(390)
        page.evaluate('''async key => {
            const {newProfile} = await import('./js/storage.js');
            const {avatars} = await import('./content/quests.js');
            const a = newProfile(3, avatars[0], '먼저 온 학생');
            const b = newProfile(9, avatars[1], '다음 학생');
            localStorage.setItem(key, JSON.stringify({current: 'a', profiles: {a, b}}));
        }''', KEY)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.landing-resume')).to_contain_text('먼저 온 학생')
        expect(page.get_by_role('heading', name='내가 아니라면 내 이름을 골라요', exact=True)).to_be_visible()
        others = page.locator('.explorer-list button')
        expect(others).to_have_count(1)
        others.filter(has_text='다음 학생').click()
        expect(page.locator('.station')).to_have_count(10)
        self.assertEqual(self.saved(page)['current'], 'b')
        page.get_by_role('button', name='홈으로', exact=True).click()
        expect(page.locator('.landing-resume')).to_contain_text('다음 학생')
        self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 390)

    def test_existing_single_student_reopens_map_and_keeps_notes_after_home_navigation(self):
        page = self.page()
        seeded = self.seed(page)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.station')).to_have_count(10)
        expect(page.locator('#app.landing-page')).to_have_count(0)
        page.get_by_role('button', name='홈으로', exact=True).click()
        expect(page.locator('#app.landing-page')).to_be_visible()
        # 마지막 탐험가의 진도와 다음 정거장을 첫 화면에서 바로 보여 줌
        resume = page.locator('.landing-resume')
        expect(resume).to_contain_text('기록 지킴이')
        expect(resume).to_contain_text('다음 정거장: 청동기 시대와 고조선')
        expect(resume.get_by_role('progressbar')).to_have_attribute('aria-valuenow', '1')
        expect(page.locator('.landing-journey .is-done')).to_have_count(1)
        expect(page.locator('.landing-journey .is-open')).to_have_count(1)
        expect(page.locator('.explorer-list')).to_have_count(0)
        page.get_by_role('button', name='이어서 탐험하기', exact=True).click()
        expect(page.locator('.station.done')).to_have_count(1)
        expect(page.locator('#app.landing-page')).to_have_count(0)
        self.assertEqual(self.saved(page), seeded['data'])
        expect(page.locator('.station.done')).to_have_count(1)
        self.assertEqual(self.saved(page), seeded['data'])

    def test_finished_explorer_fits_small_phone_and_marks_every_station(self):
        page = self.page(320)
        page.evaluate('''async key => {
            const {newProfile} = await import('./js/storage.js');
            const {avatars, questOrder} = await import('./content/quests.js');
            const a = newProfile(5, avatars[3], '다 마친 학생');
            questOrder.forEach(id => { a.quests[id] = {stage: 5, done: true, notes: [], mastery: {passed: true, score: 5}}; });
            const b = newProfile(6, avatars[4], '친구');
            localStorage.setItem(key, JSON.stringify({current: 'a', profiles: {a, b}}));
        }''', KEY)
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.landing-resume')).to_contain_text('10개 정거장을 모두 탐험했어요')
        expect(page.locator('.landing-journey .is-done')).to_have_count(10)
        self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 320)
        # 정거장 10곳이 스크롤 없이 모두 보임(키보드로 옆으로 넘길 일이 없게)
        self.assertTrue(page.locator('.landing-journey ol').evaluate('el => el.scrollWidth <= el.clientWidth'))
        expect(page.locator('.landing-journey li').last).to_be_in_viewport()

    def test_teacher_open_all_marks_only_one_next_station(self):
        page = self.page()
        self.seed(page)
        page.goto(BASE + '?open=all', wait_until='domcontentloaded')
        expect(page.locator('.station')).to_have_count(10)
        page.get_by_role('button', name='홈으로', exact=True).click()
        expect(page.locator('.landing-journey .is-done')).to_have_count(1)
        expect(page.locator('.landing-journey .is-open')).to_have_count(1)
        expect(page.locator('.landing-journey .is-open')).to_contain_text('고조선')

    def test_many_explorers_search_is_readable_and_landscape_phone_shows_start(self):
        page = self.page(390)
        page.evaluate('''async key => {
            const {newProfile} = await import('./js/storage.js');
            const {avatars} = await import('./content/quests.js');
            const profiles = {};
            for (let i = 1; i <= 10; i++) profiles['p' + i] = newProfile(i, avatars[i % 10], '학생' + i);
            localStorage.setItem(key, JSON.stringify({current: null, profiles}));
        }''', KEY)
        page.reload(wait_until='domcontentloaded')
        search = page.get_by_label('탐험가 찾기', exact=True)
        search.fill('학생7')
        expect(page.locator('.explorer-list button:visible')).to_have_count(1)
        # 짙은 바탕 위 흰 입력 칸: 입력한 글자가 배경과 충분히 달라야 함
        self.assertNotEqual(*search.evaluate('el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]'))
        self.assertEqual(search.evaluate('el => getComputedStyle(el).backgroundColor'), 'rgb(255, 255, 255)')
        # 가로로 눕힌 휴대폰(처음 방문): 시작 단추가 첫 화면 안에 보임
        page.evaluate('key => localStorage.removeItem(key)', KEY)
        page.set_viewport_size({'width': 844, 'height': 390})
        page.reload(wait_until='domcontentloaded')
        # 이 테스트는 서비스 워커를 막아 준비 실패 안내가 뜨므로, 준비를 마친 기기처럼 안내를 숨기고 잼
        page.add_style_tag(content='#offline-status { display: none !important; }')
        expect(page.locator('.landing-journey')).to_be_hidden()
        start = page.get_by_role('button', name=NEW_EXPLORER, exact=True)
        self.assertLessEqual(start.evaluate('el => el.getBoundingClientRect().bottom'), 390)

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
