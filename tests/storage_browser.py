"""Browser regressions. Start the static server, then run python tests/storage_browser.py."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import threading
import unittest

from playwright.async_api import async_playwright
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/').rstrip('/') + '/'
KEY = 'history-quest:v1'


def profile(name, number=1, stage=1):
    return {'number': number, 'name': name, 'avatar': '🦊', 'quests': {'q1': {
        'stage': stage, 'done': stage == 5, 'notes': ['내 기록'],
        'mastery': {'passed': True, 'best': 5, 'total': 5} if stage >= 4 else None,
    }}}


class StorageBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = sync_playwright().start()
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
        if binary:
            options['executable_path'] = binary
        cls.browser = cls.runner.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()

    def setUp(self):
        self.context = self.browser.new_context(locale='ko-KR', service_workers='block')
        self.context.add_init_script('''
            window.addEventListener('storage', e => {
                if (window.ignoreStorageEvents) e.stopImmediatePropagation();
            }, true);
        ''')
        self.errors = []
        self.page = self.new_page()

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
        finally:
            self.context.close()

    def new_page(self):
        page = self.context.new_page()
        page.set_default_timeout(10000)
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.goto(BASE, wait_until='domcontentloaded')
        return page

    def seed(self, profiles, current=None):
        self.page.evaluate('(v) => localStorage.setItem(v.key, JSON.stringify(v.data))', {
            'key': KEY, 'data': {'current': current, 'profiles': profiles},
        })
        self.page.reload(wait_until='domcontentloaded')

    def read(self):
        self.page.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')
        return self.page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)

    def menu(self, page=None):
        (page or self.page).get_by_label('탐험가 메뉴', exact=True).click()

    def rename(self, name, page=None):
        page = page or self.page
        self.menu(page)
        page.get_by_role('button', name='✏️ 이름 바꾸기', exact=True).click()
        page.get_by_label('이름', exact=True).fill(name)
        page.get_by_role('button', name='저장하기', exact=True).click()
        page.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')

    def code_entry(self, code, name=None, page=None):
        page = page or self.page
        home = page.get_by_label('홈으로', exact=True)
        if home.count():
            home.click()
        page.get_by_role('button', name='💾 이어하기 코드로 계속하기', exact=True).click()
        page.get_by_label('이어하기 코드', exact=True).fill(code)
        if name is not None:
            page.get_by_label('이름', exact=True).fill(name)
        page.get_by_role('button', name='계속하기', exact=True).click()
        page.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')

    def test_blank_name_is_rejected_and_different_student_is_separate(self):
        self.seed({'1:하늘': profile('하늘')})
        before = self.read()
        self.code_entry('04600-0006M')
        expect(self.page.get_by_text('내 이름도 써 주세요.', exact=True)).to_be_visible()
        self.assertEqual(self.read(), before)
        self.page.get_by_label('이름', exact=True).fill('바다')
        self.page.get_by_role('button', name='계속하기', exact=True).click()
        saved = self.read()
        self.assertEqual(len(saved['profiles']), 2)
        self.assertEqual(saved['profiles']['1:하늘']['quests']['q1']['stage'], 1)
        self.assertTrue(saved['profiles']['1:바다']['quests']['q1']['done'])

    def test_stage_four_import_and_valid_merge_preserve_local_work(self):
        existing = profile('하늘', stage=3)
        existing['quests']['q1']['mastery'] = {'passed': True, 'best': 5, 'total': 5}
        self.seed({'1:하늘': existing})
        self.code_entry('04400-0004M', '하늘')
        saved = self.read()['profiles']['1:하늘']['quests']['q1']
        self.assertEqual(saved['stage'], 4)
        self.assertTrue(saved['mastery']['passed'])
        self.assertEqual(saved['mastery']['best'], 5)
        self.assertEqual(saved['notes'], ['내 기록'])
        self.menu()
        self.page.get_by_role('dialog').get_by_role('button', name='📒 나의 역사 노트', exact=True).click()
        expect(self.page.locator('.ps-item').filter(has_text='개념 도전 통과')).to_contain_text('1 / 10')
        self.code_entry('04600-0006M', '하늘')
        self.code_entry('04400-0004M', '하늘')
        saved = self.read()['profiles']['1:하늘']['quests']['q1']
        self.assertTrue(saved['done'])
        self.assertEqual(saved['notes'], ['내 기록'])

    def test_rename_rejects_collision_but_allows_unique_name(self):
        self.seed({'1:하늘': profile('하늘'), '1:바다': profile('바다', stage=2)})
        self.page.locator('.explorer-list button').filter(has_text='바다').click()
        self.rename('하늘')
        expect(self.page.get_by_role('dialog')).to_be_visible()
        expect(self.page.get_by_text('이 번호에 같은 이름의 탐험가가 있어요. 구별할 수 있는 이름을 써 주세요.', exact=True)).to_be_visible()
        self.assertEqual(self.read()['profiles']['1:바다']['name'], '바다')
        self.page.get_by_label('이름', exact=True).fill('새바다')
        self.page.get_by_role('button', name='저장하기', exact=True).click()
        self.assertEqual(self.read()['profiles']['1:바다']['name'], '새바다')
        self.assertEqual(self.read()['profiles']['1:바다']['quests']['q1']['stage'], 2)

    def test_stale_tab_save_keeps_new_student(self):
        self.seed({'1:하늘': profile('하늘')}, '1:하늘')
        stale = self.new_page()
        stale.evaluate('window.ignoreStorageEvents = true')
        self.page.get_by_label('홈으로', exact=True).click()
        self.page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
        self.page.get_by_label('이름', exact=True).fill('바다')
        self.page.locator('.num-grid').get_by_role('button', name='2', exact=True).click()
        self.page.get_by_role('button', name='🚀 탐험 시작!', exact=True).click()
        self.page.get_by_role('button', name='알겠어요!', exact=True).click()
        self.rename('새하늘', stale)
        self.assertEqual(len(self.read()['profiles']), 2)
        self.assertEqual(self.read()['profiles']['2:바다']['name'], '바다')
        self.assertEqual(self.read()['profiles']['1:하늘']['name'], '새하늘')

    def test_stale_same_student_conflict_refreshes_and_closes_modal(self):
        self.seed({'1:하늘': profile('하늘')}, '1:하늘')
        stale = self.new_page()
        stale.evaluate('window.ignoreStorageEvents = true')
        self.menu(stale)
        stale.get_by_role('button', name='✏️ 이름 바꾸기', exact=True).click()
        stale.get_by_label('이름', exact=True).fill('오래된창')
        self.code_entry('04600-0006M', '하늘')
        stale.get_by_role('button', name='저장하기', exact=True).click()
        expect(stale.get_by_role('dialog')).to_have_count(0)
        expect(stale.get_by_text('다른 창에서 바뀐 최신 기록을 불러왔어요. 열린 앱 창을 하나만 사용해 주세요.', exact=True)).to_be_visible()
        self.assertEqual(self.read()['profiles']['1:하늘']['name'], '하늘')
        self.assertTrue(self.read()['profiles']['1:하늘']['quests']['q1']['done'])

    def test_external_switch_and_unrelated_save_preserve_activity(self):
        self.seed({'1:하늘': profile('하늘', stage=0), '2:바다': profile('바다', 2)})
        self.page.locator('.explorer-list button').filter(has_text='하늘').click()
        self.page.locator('.station').first.click()
        self.page.get_by_role('button', name='🔎 단서 더 보기', exact=False).click()
        expect(self.page.locator('.clues li')).to_have_count(2)
        other = self.new_page()
        other.locator('.explorer-list button').filter(has_text='바다').click()
        self.rename('새바다', other)
        expect(self.page.locator('.clues li')).to_have_count(2)
        expect(self.page.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('하늘')
        self.assertEqual(self.read()['profiles']['2:바다']['name'], '새바다')

    def test_external_delete_closes_modal_and_cannot_be_resurrected(self):
        self.seed({'1:하늘': profile('하늘')}, '1:하늘')
        other = self.new_page()
        self.menu()
        self.page.get_by_role('button', name='✏️ 이름 바꾸기', exact=True).click()
        other.on('dialog', lambda dialog: dialog.accept())
        self.menu(other)
        other.get_by_role('button', name='🗑️ 이 기기에서 내 기록 지우기', exact=True).click()
        expect(self.page.get_by_role('dialog')).to_have_count(0)
        expect(self.page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True)).to_be_visible()
        self.assertEqual(self.read()['profiles'], {})
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.read()['profiles'], {})

    def test_delete_storage_failure_retains_profile_until_successful_retry(self):
        self.seed({'1:하늘': profile('하늘')}, '1:하늘')
        before = self.read()
        self.page.evaluate('''() => {
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function(...args) {
                if (window.failSave) throw new DOMException('full', 'QuotaExceededError');
                return set.apply(this, args);
            };
            window.failSave = true;
        }''')
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.menu()
        self.page.get_by_role('button', name='🗑️ 이 기기에서 내 기록 지우기', exact=True).click()
        expect(self.page.get_by_text('⚠️ 기록을 지우지 못했어요. 기록은 그대로 남아 있어요. 다시 시도해 주세요.', exact=True)).to_be_visible()
        self.assertEqual(self.read(), before)
        self.assertEqual(self.page.get_by_text('🗑️ 기록을 지웠어요.', exact=True).count(), 0)
        expect(self.page.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('하늘')
        self.page.reload(wait_until='domcontentloaded')
        expect(self.page.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('하늘')
        self.menu()
        self.page.get_by_role('button', name='🗑️ 이 기기에서 내 기록 지우기', exact=True).click()
        expect(self.page.get_by_text('🗑️ 기록을 지웠어요.', exact=True)).to_be_visible()
        self.assertEqual(self.read()['profiles'], {})
        self.page.reload(wait_until='domcontentloaded')
        expect(self.page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True)).to_be_visible()
        self.assertEqual(self.read()['profiles'], {})

    def test_conflicting_delete_keeps_newer_student_record(self):
        self.seed({'1:하늘': profile('하늘')}, '1:하늘')
        stale = self.new_page()
        stale.evaluate('window.ignoreStorageEvents = true')
        self.rename('새하늘')
        stale.on('dialog', lambda dialog: dialog.accept())
        self.menu(stale)
        stale.get_by_role('button', name='🗑️ 이 기기에서 내 기록 지우기', exact=True).click()
        expect(stale.get_by_text('다른 창에서 바뀐 최신 기록을 불러왔어요. 열린 앱 창을 하나만 사용해 주세요.', exact=True)).to_be_visible()
        self.assertEqual(self.read()['profiles']['1:하늘']['name'], '새하늘')
        self.assertEqual(stale.get_by_text('🗑️ 기록을 지웠어요.', exact=True).count(), 0)
        stale.reload(wait_until='domcontentloaded')
        expect(stale.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('새하늘')

    def test_quota_failure_allows_registration_learning_and_code_export(self):
        self.context.add_init_script('Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }')
        self.page.reload(wait_until='domcontentloaded')
        self.page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
        self.page.get_by_label('이름', exact=True).fill('하늘')
        self.page.locator('.num-grid').get_by_role('button', name='1', exact=True).click()
        self.page.get_by_role('button', name='🚀 탐험 시작!', exact=True).click()
        self.page.get_by_role('button', name='알겠어요!', exact=True).click()
        self.page.locator('.station').first.click()
        answers = [
            ('동물을 사냥하고, 고기를 자르고, 땅을 파는 데 썼어요.', '구석기 시대'),
            ('음식을 담거나 저장하고, 끓이는 데 썼어요.', '신석기 시대'),
            ('곡식이나 열매를 갈아서 껍질을 벗기거나 가루로 만들었어요.', '신석기 시대'),
        ]
        for index, (use, era) in enumerate(answers):
            self.page.locator('button.choice').filter(has_text=use).click()
            self.page.locator('button.choice').filter(has_text=era).click()
            label = '다음 유물 조사하기 ▶' if index < 2 else '유물 탐정 완료! 다음 단계로 ▶'
            self.page.get_by_role('button', name=label, exact=True).click()
        expect(self.page.locator('.stage-head h2')).to_have_text('이야기 카드')
        self.menu()
        self.page.get_by_role('button', name='💾 이어하기 코드 보기', exact=True).click()
        code = self.page.locator('.code-box').inner_text()
        decoded = self.page.evaluate('''async code => {
            const { decodeProgress } = await import('./js/code.js');
            const { questOrder, avatars } = await import('./content/quests.js');
            return decodeProgress(code, questOrder, avatars);
        }''', code)
        self.assertEqual(decoded['quests']['q1']['stage'], 1)
        self.assertIsNone(self.read())

    def test_coordination_unavailable_keeps_registration_and_code_export(self):
        self.context.add_init_script('indexedDB.open = () => { throw new DOMException("blocked", "SecurityError"); }')
        self.page.reload(wait_until='domcontentloaded')
        self.page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
        self.page.get_by_label('이름', exact=True).fill('하늘')
        self.page.locator('.num-grid').get_by_role('button', name='1', exact=True).click()
        self.page.get_by_role('button', name='🚀 탐험 시작!', exact=True).click()
        self.page.get_by_role('button', name='알겠어요!', exact=True).click()
        self.menu()
        self.page.get_by_role('button', name='💾 이어하기 코드 보기', exact=True).click()
        expect(self.page.locator('.code-box')).to_contain_text('-')
        self.assertIsNone(self.read(), 'coordination failure must not perform an unprotected write')


class AtomicStorageBrowserTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.arrived = threading.Event()
        self.release = threading.Event()
        arrived, release = self.arrived, self.release

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/__pause__':
                    arrived.set()
                    ready = release.wait(20)
                    self.send_response(200 if ready else 504)
                    self.end_headers()
                    self.wfile.write(b'released')
                else:
                    super().do_GET()

            def log_message(self, *args):
                pass

        handler = partial(Handler, directory=str(Path(__file__).resolve().parents[1]))
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}/'
        self.runner = await async_playwright().start()
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
        if binary:
            options['executable_path'] = binary
        self.browser = await self.runner.chromium.launch(**options)
        self.context = await self.browser.new_context(service_workers='block')

    async def asyncTearDown(self):
        self.release.set()
        await self.context.close()
        await self.browser.close()
        await self.runner.stop()
        await asyncio.to_thread(self.server.shutdown)
        self.server.server_close()

    async def concurrent_save(self, same_student):
        first = await self.context.new_page()
        second = await self.context.new_page()
        await first.goto(self.base)
        await first.evaluate('(data) => localStorage.setItem("history-quest:v1", JSON.stringify(data))', {
            'current': '1:하늘', 'profiles': {'1:하늘': profile('하늘')},
        })
        await second.goto(self.base)
        for page in (first, second):
            await page.evaluate('''async () => {
                window.store = await import('./js/storage.js');
                window.snapshot = store.loadData();
            }''')
        await first.evaluate('''same => {
            if (same) snapshot.profiles['1:하늘'].quests.q1.stage = 4;
            else snapshot.profiles['2:바다'] = store.newProfile(2, '🦊', '바다');
            const original = Storage.prototype.getItem;
            let pause = true;
            Storage.prototype.getItem = function(key) {
                const value = original.call(this, key);
                if (pause && key === 'history-quest:v1') {
                    pause = false;
                    const request = new XMLHttpRequest();
                    request.open('GET', '/__pause__', false);
                    request.send();
                }
                return value;
            };
        }''', same_student)
        await second.evaluate('''() => {
            snapshot.profiles['1:하늘'].name = '새하늘';
            const original = IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction = function(...args) {
                window.lockQueued = true;
                return original.apply(this, args);
            };
        }''')
        saving_first = asyncio.create_task(first.evaluate('() => store.saveData(snapshot)'))
        self.assertTrue(await asyncio.to_thread(self.arrived.wait, 10), 'first save did not reach the read barrier')
        try:
            await second.evaluate('''() => {
                Promise.resolve(store.saveData(snapshot)).then(result => { window.saveResult = result; });
            }''')
            await second.wait_for_function('window.lockQueued || window.saveResult !== undefined')
            self.assertIsNone(await second.evaluate('window.saveResult ?? null'), 'second save wrote while first save held the lock')
        finally:
            self.release.set()
        self.assertTrue(await saving_first)
        await second.wait_for_function('window.saveResult !== undefined')
        result = await second.evaluate('window.saveResult')
        saved = await second.evaluate('JSON.parse(localStorage.getItem("history-quest:v1"))')
        if same_student:
            self.assertEqual(result, 'conflict')
            self.assertEqual(saved['profiles']['1:하늘']['quests']['q1']['stage'], 4)
            self.assertEqual(saved['profiles']['1:하늘']['name'], '하늘')
        else:
            self.assertTrue(result)
            self.assertEqual(saved['profiles']['1:하늘']['name'], '새하늘')
            self.assertEqual(saved['profiles']['2:바다']['name'], '바다')

    async def test_simultaneous_different_student_saves_are_atomic(self):
        await self.concurrent_save(False)

    async def test_simultaneous_same_student_saves_conflict(self):
        await self.concurrent_save(True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
