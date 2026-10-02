"""UI regressions: keyboard dialogs, small screens, hidden answers and narration.

Run against a local static server; see tests/README.md for dependencies.
"""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')


class BrowserUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = sync_playwright().start()
        executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
        options = {'headless': True}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.runner.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()

    def page(self, width=1024, init=None):
        context = self.browser.new_context(viewport={'width': width, 'height': 800}, service_workers='block')
        self.addCleanup(context.close)
        if init:
            context.add_init_script(init)
        page = context.new_page()
        page.set_default_timeout(7000)
        page.goto(BASE, wait_until='domcontentloaded')
        return page

    def explorer(self, page, stage=0):
        page.evaluate('''async stage => {
            const {newProfile} = await import('./js/storage.js');
            const profile = newProfile(1, '🦊', '화면 점검');
            profile.quests.q1 = {stage, done: false, notes: [], mastery: null};
            localStorage.setItem('history-quest:v1', JSON.stringify({
                current: 'ui-test', profiles: {'ui-test': profile}
            }));
        }''', stage)
        page.reload(wait_until='domcontentloaded')

    def test_dialog_traps_focus_and_restores_opener_with_and_without_inert(self):
        for native_inert in (True, False):
            with self.subTest(native_inert=native_inert):
                init = None if native_inert else 'delete HTMLElement.prototype.inert;'
                page = self.page(init=init)
                self.explorer(page)
                opener = page.get_by_role('button', name='💾 이어하기 코드', exact=True)
                opener.click()
                dialog = page.get_by_role('dialog')
                expect(dialog).to_be_visible()
                self.assertEqual(page.locator('#app').get_attribute('aria-hidden'), 'true')
                for key in ('Tab', 'Tab', 'Shift+Tab'):
                    page.keyboard.press(key)
                    self.assertTrue(dialog.evaluate('(el) => el.contains(document.activeElement)'))
                page.locator('.home-btn').evaluate('(el) => el.focus()')
                self.assertTrue(dialog.evaluate('(el) => el.contains(document.activeElement)'))
                page.keyboard.press('Escape')
                expect(dialog).to_have_count(0)
                expect(opener).to_be_focused()
                self.assertIsNone(page.locator('#app').get_attribute('aria-hidden'))
                expect(page.locator('.station')).to_have_count(10)

    def test_nested_dialogs_close_safely_and_restore_background(self):
        page = self.page()
        page.evaluate('''async () => {
            const {h, modal} = await import('./js/dom.js');
            window.outerClose = modal(h('h2', {}, '바깥 안내'), h('button', {}, '바깥 버튼'));
            window.innerClose = modal(h('h2', {}, '안쪽 안내'), h('button', {}, '안쪽 버튼'));
        }''')
        self.assertEqual(page.locator('[role="dialog"]').count(), 2)
        page.keyboard.press('Escape')
        self.assertEqual(page.locator('[role="dialog"]').count(), 1)
        self.assertEqual(page.locator('#app').get_attribute('aria-hidden'), 'true')
        expect(page.get_by_role('button', name='바깥 버튼')).to_be_focused()
        page.evaluate('window.outerClose()')
        self.assertIsNone(page.locator('#app').get_attribute('aria-hidden'))
        page.evaluate('''async () => {
            const {h, modal} = await import('./js/dom.js');
            const outer = modal(h('h2', {}, '바깥'), h('button', {}, '닫기'));
            modal(h('h2', {}, '안쪽'), h('button', {}, '닫기'));
            outer();
            modal.closeAll();
        }''')
        expect(page.locator('[role="dialog"]')).to_have_count(0)
        self.assertIsNone(page.locator('#app').get_attribute('aria-hidden'))

    def test_registration_fits_narrow_screens(self):
        for width in (320, 360, 375, 768):
            with self.subTest(width=width):
                page = self.page(width=width)
                page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
                metrics = page.evaluate('''() => ({
                    width: innerWidth, document: document.documentElement.scrollWidth,
                    avatars: [...document.querySelectorAll('.avatar-grid button')].map(el => {
                        const rect = el.getBoundingClientRect();
                        return {left: rect.left, right: rect.right, width: rect.width};
                    })
                })''')
                self.assertLessEqual(metrics['document'], width)
                self.assertEqual(len(metrics['avatars']), 10)
                for rect in metrics['avatars']:
                    self.assertGreaterEqual(rect['left'], 0)
                    self.assertLessEqual(rect['right'], width)
                    self.assertGreaterEqual(rect['width'], 44)

    def test_artifact_accessible_name_is_revealed_only_after_solving(self):
        page = self.page()
        self.explorer(page)
        page.locator('.station.open').click()
        frame = page.locator('.artifact-frame')
        self.assertNotIn('주먹도끼', frame.aria_snapshot())
        expect(frame.get_by_role('img', name='단서를 보고 추리할 유물 그림')).to_be_visible()
        page.locator('button.choice:enabled').filter(has_text='동물을 사냥하고, 고기를 자르고, 땅을 파는 데 썼어요.').click()
        expect(frame.get_by_role('img', name='주먹도끼', exact=True)).to_be_visible()
        # A photo that fails after the answer was revealed must keep that name.
        page.evaluate('''async () => {
            const {photos} = await import('./content/photos.js');
            const {fillPicture} = await import('./js/picture.js');
            photos.handaxe = {src: 'data:image/png;base64,AAAA'};
            const box = document.createElement('div');
            box.id = 'late-photo';
            fillPicture(box, 'handaxe', '단서를 보고 추리할 유물 그림');
            box.dataset.pictureLabel = '주먹도끼';
            document.body.append(box);
        }''')
        expect(page.locator('#late-photo svg')).to_have_attribute('aria-label', '주먹도끼')
        expect(page.locator('#late-photo img')).to_have_count(0)

    def test_previous_narration_stops_on_card_and_scene_transitions(self):
        speech = '''(() => {
            window.speechLog = {queue: [], cancels: 0};
            Object.defineProperty(window, 'speechSynthesis', {value: {
                getVoices: () => [{lang: 'ko-KR'}], addEventListener() {},
                cancel() {speechLog.queue = []; speechLog.cancels++;},
                speak(utterance) {speechLog.queue.push(utterance.text);}
            }});
            window.SpeechSynthesisUtterance = function(text) {this.text = text;};
        })();'''
        for stage in (1, 2):
            with self.subTest(stage=stage):
                page = self.page(init=speech)
                self.explorer(page, stage)
                page.locator('.station.open').click()
                if stage == 1:
                    page.get_by_role('button', name='읽어 주기', exact=True).click()
                    before = page.evaluate('structuredClone(speechLog)')
                    page.get_by_role('button', name='✔ 다 읽었어요', exact=True).click()
                    page.locator('button.choice:enabled').filter(has_text='그들이 남긴 유물과 유적을 살펴본다.').click()
                    page.get_by_role('button', name='다음 카드 ▶', exact=True).click()
                    expect(page.get_by_role('heading', name='옮겨 다닌 구석기 사람들')).to_be_visible()
                else:
                    page.get_by_role('button', name='이야기 시작하기 ▶', exact=True).click()
                    page.get_by_role('button', name='장면 읽기', exact=True).click()
                    before = page.evaluate('structuredClone(speechLog)')
                    answer = page.evaluate('''async () => {
                        const {stations} = await import('./content/quests.js');
                        return stations[0].quest.stages[2].steps[0].choices.find(c => c.good || c.correct).t;
                    }''')
                    page.locator('button.choice:enabled').filter(has_text=answer).click()
                    page.get_by_role('button', name='다음 장면 ▶', exact=True).click()
                self.assertTrue(before['queue'])
                after = page.evaluate('speechLog')
                self.assertEqual(after['queue'], [])
                self.assertGreater(after['cancels'], before['cancels'])


if __name__ == '__main__':
    unittest.main()
