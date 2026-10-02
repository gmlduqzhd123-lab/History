"""Browser regressions for map pin selection; run with a static server on port 8000.

Requires Python Playwright and Chromium. HISTORY_TEST_BASE_URL and
HISTORY_TEST_BROWSER may override the server URL and browser executable.
"""

import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
VIEWPORTS = ({'width': 390, 'height': 844}, {'width': 1280, 'height': 900})


class MapPinRegressions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
        options = {'headless': True}
        if binary:
            options['executable_path'] = binary
        cls.browser = cls.playwright.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def open_map(self, viewport, done_count=10):
        context = self.browser.new_context(viewport=viewport, service_workers='block')
        self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(5000)
        page.goto(BASE_URL)
        page.evaluate('''async doneCount => {
            const { newProfile } = await import('./js/storage.js');
            const profile = newProfile(1, '🐻', '지도 점검');
            for (let i = 1; i <= doneCount; i++) {
                profile.quests['q' + i] = { stage: 5, done: true, notes: [] };
            }
            localStorage.setItem('history-quest:v1', JSON.stringify({
                current: 'map-test', profiles: { 'map-test': profile },
            }));
        }''', done_count)
        page.reload()
        page.get_by_role('button', name='문화유산 지도', exact=False).click()
        return page

    def click_pin(self, page, place_id, offset=(0, 0)):
        dot = page.locator(f'[data-place="{place_id}"] .dot')
        dot.scroll_into_view_if_needed()
        point = dot.evaluate('''(dot, offset) => {
            const p = dot.ownerSVGElement.createSVGPoint();
            p.x = offset[0]; p.y = offset[1];
            const screen = p.matrixTransform(dot.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }''', list(offset))
        page.mouse.click(point['x'], point['y'])

    def assert_selected(self, page, place_id):
        page.locator(f'.pin.selected[data-place="{place_id}"]').wait_for()
        self.assertEqual(page.locator('.pin.selected').get_attribute('data-place'), place_id)
        visited = page.evaluate("""JSON.parse(localStorage.getItem('history-quest:v1'))
            .profiles['map-test'].extras.places.visited""")
        self.assertTrue(visited.get(place_id))
        # Selecting a place scrolls its explanation into view on phones.
        page.wait_for_timeout(350)

    def test_open_centers_are_not_intercepted_by_locked_neighbors(self):
        for viewport in VIEWPORTS:
            with self.subTest(viewport=viewport):
                page = self.open_map(viewport, done_count=5)
                for place_id in ('cheongju', 'gimhae'):
                    self.click_pin(page, place_id)
                    self.assert_selected(page, place_id)
                    self.assertEqual(page.locator('.toast').count(), 0)
                visited = page.evaluate("""JSON.parse(localStorage.getItem('history-quest:v1'))
                    .profiles['map-test'].extras.places.visited""")
                self.assertNotIn('cheonan', visited)
                self.assertNotIn('busan', visited)

    def test_nearby_pins_touch_areas_and_keyboard_list(self):
        for viewport in VIEWPORTS:
            with self.subTest(viewport=viewport):
                page = self.open_map(viewport)
                for place_id in ('cheongju', 'cheonan', 'gimhae', 'busan', 'seoul', 'incheon'):
                    self.click_pin(page, place_id)
                    self.assert_selected(page, place_id)
                # These taps fall outside the visible dot but within the touch area.
                for place_id, offset in (('cheongju', (12, 8)), ('gimhae', (-14, -6))):
                    self.click_pin(page, place_id, offset)
                    self.assert_selected(page, place_id)
                for place_id, name in (('cheongju', '청주'), ('gimhae', '김해')):
                    button = page.get_by_role('button', name=name, exact=True)
                    button.focus()
                    button.press('Enter')
                    self.assert_selected(page, place_id)

    def test_correct_dot_centers_keep_full_quiz_score(self):
        orders = (
            (0.35, ('hansando', 'yeoncheon', 'gimhae', 'hapcheon', 'seoul')),
            (0.4, ('wando', 'yeoncheon', 'busan', 'seoul', 'cheongju')),
        )
        for viewport in VIEWPORTS:
            for random_value, answers in orders:
                with self.subTest(viewport=viewport, random_value=random_value):
                    page = self.open_map(viewport)
                    page.evaluate('value => { Math.random = () => value; }', random_value)
                    page.get_by_role('button', name='🎯 지도에서 찾기', exact=False).click()
                    for index, place_id in enumerate(answers):
                        self.click_pin(page, place_id)
                        page.locator(f'.pin.selected[data-place="{place_id}"]').wait_for()
                        self.assertEqual(page.locator('.feedback.bad').count(), 0)
                        label = '결과 보기 ▶' if index == len(answers) - 1 else '다음 문제 ▶'
                        page.get_by_role('button', name=label, exact=True).click()
                    expect(page.locator('#app')).to_contain_text('5문제 가운데 5문제를 한 번에 찾았어요.')
                    score = page.evaluate("""JSON.parse(localStorage.getItem('history-quest:v1'))
                        .profiles['map-test'].extras.places""")
                    self.assertEqual((score['quizBest'], score['quizTotal']), (5, 5))


if __name__ == '__main__':
    unittest.main()
