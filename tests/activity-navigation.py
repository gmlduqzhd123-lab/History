"""Keyboard focus through cards, questions and extra activity results."""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')


class ActivityNavigation(unittest.TestCase):
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

    def page(self, stage=None, review=False, done=False):
        context = self.browser.new_context(service_workers='block')
        self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(10000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        self.addCleanup(lambda: self.assertEqual(errors, []))
        page.goto(BASE, wait_until='domcontentloaded')
        page.evaluate('''async ({stage, review, done}) => {
            const {newProfile} = await import('./js/storage.js');
            const p = newProfile(8, '🐼', '활동 초점');
            if (stage !== null) p.quests.q1 = {stage, done: false, notes: []};
            if (done) for (let i = 1; i <= 10; i++) {
                p.quests['q' + i] = {stage: 5, done: true, notes: []};
            }
            if (review) {
                const yesterday = new Date(); yesterday.setHours(0, 0, 0, 0);
                for (const c of ['prehistory', 'paleoTool']) {
                    p.extras.review['q1|' + c] = {q: 'q1', c, at: yesterday.getTime() - 1};
                }
            }
            localStorage.setItem('history-quest:v1', JSON.stringify({
                current: 'activity-focus', profiles: {'activity-focus': p},
            }));
        }''', {'stage': stage, 'review': review, 'done': done})
        page.reload(wait_until='domcontentloaded')
        page.evaluate('Math.random = () => 0')
        return page

    def enter(self, page, name):
        button = page.get_by_role('button', name=name, exact=True)
        expect(button).to_be_enabled()
        button.focus()
        page.keyboard.press('Enter')

    def solve_mastery(self, page):
        question = page.evaluate(r'''async () => {
            const {stations} = await import('./content/quests.js');
            const text = document.querySelector('#app h3').textContent;
            return stations[0].quest.stages.find(s => s.type === 'mastery').questions
                .find(q => q.q.replace(/\*\*/g, '') === text);
        }''')
        self.assertIsNotNone(question)
        if question['type'] == 'sort':
            for row in page.locator('.sort-item').all():
                text = row.locator('.label').inner_text()
                item = next(item for item in question['items'] if item['t'] == text)
                group = row.get_by_role('group', name=text + ' 분류', exact=True)
                expect(group).to_have_count(1)
                group.get_by_role('button', name=question['buckets'][item['b']], exact=True).click()
            self.enter(page, '확인하기')
        elif question['type'] == 'ox':
            self.enter(page, '⭕ 맞아요' if question['answer'] else '❌ 틀려요')
        else:
            page.get_by_role('button', name=question['choices'][question['answer']], exact=False).click()

    def test_reading_card_keeps_focus_and_narration_in_keyboard_order(self):
        page = self.page(stage=1)
        page.locator('.station.open').first.click()
        self.enter(page, '✔ 다 읽었어요')
        answer = page.evaluate('''async () => {
            const {stations} = await import('./content/quests.js');
            return stations[0].quest.stages[1].cards[0].check.choices.find(c => c.correct || c.good).t;
        }''')
        page.get_by_role('button', name=answer, exact=False).click()
        self.enter(page, '다음 카드 ▶')
        expect(page.locator('.counter')).to_have_text('카드 2 / 4')
        title = page.locator('#app .card h2').inner_text()
        expect(page.get_by_role('group', name=title, exact=True)).to_be_focused()
        page.keyboard.press('Tab')
        expect(page.get_by_role('button', name='읽어 주기', exact=True)).to_be_focused()

    def test_mastery_questions_and_result_receive_focus(self):
        page = self.page(stage=3)
        page.locator('.station.open').first.click()
        for index in range(5):
            self.solve_mastery(page)
            self.enter(page, '다음 문제 ▶' if index < 4 else '결과 보기 ▶')
            if index < 4:
                expect(page.locator('#app h3')).to_be_focused()
        expect(page.locator('.score-big')).to_have_text('5 / 5')
        expect(page.locator('.score-big')).to_be_focused()

    def test_review_questions_and_result_receive_focus(self):
        page = self.page(review=True, done=True)
        self.enter(page, '복습 시작하기 ▶')
        for index in range(2):
            self.solve_mastery(page)
            self.enter(page, '다음 복습 ▶' if index == 0 else '복습 마치기 ▶')
            if index == 0:
                expect(page.locator('#app h3')).to_be_focused()
        expect(page.locator('.stamp')).to_contain_text('복습 완료')
        expect(page.locator('.stamp')).to_be_focused()

    def test_timeline_completion_and_map_quiz_keep_focus(self):
        page = self.page(done=True)
        events = page.evaluate('''async () =>
            (await import('./content/timeline.js')).timelines.find(t => t.key === 'u1').events.map(e => e.t)
        ''')
        page.get_by_role('button', name='연표 잇기', exact=False).first.click()
        for event in events:
            self.enter(page, event)
        expect(page.locator('.stamp')).to_be_focused()
        self.enter(page, '🗺️ 지도로 돌아가기')
        page.get_by_role('button', name='문화유산 지도', exact=False).click()
        page.get_by_role('button', name='🎯 지도에서 찾기', exact=False).click()
        for index in range(5):
            name = page.evaluate('''async () => {
                const {places} = await import('./content/places.js');
                const question = document.querySelector('.quiz-q h2').textContent;
                return places.find(p => p.items.some(item => question.includes(item.ask))).name;
            }''')
            self.enter(page, name)
            self.enter(page, '다음 문제 ▶' if index < 4 else '결과 보기 ▶')
            if index < 4:
                expect(page.locator('.quiz-q h2')).to_be_focused()
        expect(page.locator('.stamp')).to_be_focused()


if __name__ == '__main__':
    unittest.main()
