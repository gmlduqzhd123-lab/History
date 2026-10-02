"""Exercise persisted extra activities through the real app UI."""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')


class ExtraActivities(unittest.TestCase):
    def test_review_timeline_people_and_writing_persist_before_continuing(self):
        with sync_playwright() as runner:
            options = {'headless': True}
            executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
            if executable:
                options['executable_path'] = executable
            browser = runner.chromium.launch(**options)
            context = browser.new_context(service_workers='block')
            page = context.new_page()
            page.set_default_timeout(7000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE, wait_until='domcontentloaded')
            page.evaluate('''async () => {
                const {newProfile} = await import('./js/storage.js');
                const p = newProfile(1, '🐻', '추가 활동 점검');
                for (let i = 1; i <= 10; i++) p.quests['q' + i] = {stage: 5, done: true, notes: []};
                const today = new Date(); today.setHours(0, 0, 0, 0);
                for (const c of ['prehistory', 'paleoTool', 'paleoLife'])
                    p.extras.review['q1|' + c] = {q: 'q1', c, at: today.getTime() - 60000};
                p.extras.review['q1|neoTool'] = {q: 'q1', c: 'neoTool', at: Date.now()};
                localStorage.setItem('history-quest:v1', JSON.stringify({current: 'extras-test', profiles: {'extras-test': p}}));
            }''')
            page.reload(wait_until='domcontentloaded')

            def saved():
                return page.evaluate("JSON.parse(localStorage.getItem('history-quest:v1')).profiles['extras-test'].extras")

            def back():
                page.get_by_role('button', name='🗺️ 지도로 돌아가기', exact=True).click()

            page.evaluate('Math.random = () => 0')
            page.get_by_role('button', name='복습 시작하기 ▶', exact=True).click()
            for i, answer in enumerate(['선사 시대', '뗀석기', '사냥과 채집을 하며 옮겨 다녔다.']):
                page.get_by_role('button', name=answer, exact=False).click()
                page.get_by_role('button', name='다음 복습 ▶' if i < 2 else '복습 마치기 ▶', exact=True).click()
            self.assertEqual(list(saved()['review']), ['q1|neoTool'])
            back()
            expect(page.locator('.review-card')).to_have_count(0)

            events = page.evaluate("async () => (await import('./content/timeline.js')).timelines.find(t => t.key === 'u1').events.map(e => e.t)")
            page.get_by_role('button', name='연표 잇기', exact=False).first.click()
            page.get_by_role('button', name=events[-1], exact=True).click()
            for event in events:
                page.get_by_role('button', name=event, exact=True).click()
            page.get_by_role('button', name='🔁 다시 해 보기', exact=True).wait_for()
            self.assertEqual(saved()['timeline']['u1']['best'], 1)
            page.get_by_role('button', name='🔁 다시 해 보기', exact=True).click()
            for event in events:
                page.get_by_role('button', name=event, exact=True).click()
            page.get_by_role('button', name='🔁 다시 해 보기', exact=True).wait_for()
            self.assertEqual(saved()['timeline']['u1']['best'], 0)
            back()

            page.get_by_role('button', name='인물 도감', exact=False).click()
            page.locator('.person-card.open').first.click()
            page.get_by_role('button', name='주몽', exact=False).click()
            page.get_by_role('button', name='단군왕검', exact=False).click()
            page.get_by_role('button', name='🧑‍🤝‍🧑 인물 도감으로', exact=True).click()
            expect(page.locator('.person-card.collected')).to_have_count(1)
            self.assertEqual(sum(saved()['people'].values()), 1)
            page.get_by_role('button', name='🗺️ 지도', exact=True).click()

            page.get_by_role('button', name='역사 신문 · 편지', exact=False).first.click()
            page.get_by_role('button', name='속보! 신라, 삼국 통일을 이루다', exact=False).click()
            for i, value in enumerate(['당', '백제와 고구려를', '새로운 나라가 기대돼요']):
                page.locator('input.blank').nth(i).fill(value)
            page.get_by_role('button', name='✔ 확인하기', exact=True).click()
            page.get_by_role('button', name='💾 저장하고 퀘스트 마치기', exact=True).click()
            page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True).wait_for()
            self.assertEqual(saved()['writings']['u1']['id'], 'u1-unify')
            page.reload(wait_until='domcontentloaded')
            page.get_by_role('button', name='📒 나의 역사 노트', exact=True).click()
            expect(page.locator('.newspaper')).to_contain_text('백제와 고구려를')
            self.assertEqual(errors, [])
            browser.close()


if __name__ == '__main__':
    unittest.main()
