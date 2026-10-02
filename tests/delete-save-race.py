"""A failed deletion must recover the active student after a queued unrelated-tab update."""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/').rstrip('/') + '/'
KEY = 'history-quest:v1'


class DeleteSaveRaceTests(unittest.TestCase):
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

    def test_failed_delete_with_unrelated_remote_save_keeps_active_student(self):
        context = self.browser.new_context(locale='ko-KR', service_workers='block')
        try:
            first = context.new_page()
            first.set_default_timeout(10000)
            errors = []
            first.on('pageerror', lambda error: errors.append(str(error)))
            first.goto(BASE, wait_until='domcontentloaded')
            first.evaluate('''() => {
                localStorage.setItem('history-quest:v1', JSON.stringify({current:'one', profiles:{
                    one:{number:1,name:'하늘',avatar:'🦊',quests:{q1:{stage:1,notes:['하늘의 정리']}}},
                    two:{number:2,name:'바다',avatar:'🐼',quests:{q1:{stage:2,notes:['바다의 정리']}}}
                }}));
            }''')
            first.reload(wait_until='domcontentloaded')
            first.locator('.explorer-list button').filter(has_text='하늘').click()
            first.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')
            second = context.new_page()
            second.set_default_timeout(10000)
            second.goto(BASE, wait_until='domcontentloaded')
            second.locator('.explorer-list button').filter(has_text='바다').click()
            second.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')

            # Delay the first tab before acquiring the mutex; the other tab can save normally.
            # Once released, use a real IndexedDB transaction and its completion events.
            first.evaluate('''() => {
                const transaction = IDBDatabase.prototype.transaction;
                IDBDatabase.prototype.transaction = function(...args) {
                    if (args[0] !== 'save') return transaction.apply(this, args);
                    const db = this;
                    const deferred = {};
                    deferred.objectStore = () => ({get(key) {
                        const request = {};
                        window.deleteSaveWaiting = true;
                        window.releaseDeleteSave = () => {
                            IDBDatabase.prototype.transaction = transaction;
                            const actual = transaction.apply(db, args);
                            actual.oncomplete = () => deferred.oncomplete?.();
                            actual.onerror = () => deferred.onerror?.();
                            actual.onabort = () => deferred.onabort?.();
                            actual.objectStore('save').get(key).onsuccess = () => request.onsuccess?.();
                        };
                        return request;
                    }});
                    return deferred;
                };
                const setItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function(key, value) {
                    if (key === 'history-quest:v1') throw new DOMException('full', 'QuotaExceededError');
                    return setItem.call(this, key, value);
                };
                window.remoteStorageEvents = 0;
                addEventListener('storage', event => {
                    if (event.key === 'history-quest:v1') window.remoteStorageEvents++;
                });
            }''')
            first.on('dialog', lambda dialog: dialog.accept())
            first.get_by_label('탐험가 메뉴', exact=True).click()
            first.get_by_role('button', name='🗑️ 이 기기에서 내 기록 지우기', exact=True).click()
            first.wait_for_function('window.deleteSaveWaiting === true')
            expect(first.locator('#app')).to_have_attribute('aria-busy', 'true')

            second.get_by_label('탐험가 메뉴', exact=True).click()
            second.get_by_role('button', name='✏️ 이름 바꾸기', exact=True).click()
            second.get_by_label('이름', exact=True).fill('새바다')
            second.get_by_role('button', name='저장하기', exact=True).click()
            second.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')
            first.wait_for_function('window.remoteStorageEvents > 0')
            first.evaluate('window.releaseDeleteSave()')
            first.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')

            saved = first.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)
            self.assertEqual(saved['profiles']['one']['name'], '하늘')
            self.assertEqual(saved['profiles']['one']['quests']['q1']['notes'], ['하늘의 정리'])
            self.assertEqual(saved['profiles']['two']['name'], '새바다')
            self.assertEqual(first.get_by_text('🗑️ 기록을 지웠어요.', exact=True).count(), 0)
            expect(first.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('하늘')
            first.get_by_label('탐험가 메뉴', exact=True).click()
            self.assertEqual(errors, [], 'failed deletion left the UI without an active student')
            expect(first.get_by_role('dialog')).to_be_visible()
            first.get_by_role('button', name='💾 이어하기 코드 보기', exact=True).click()
            expect(first.locator('.code-box')).to_be_visible()
            self.assertEqual(errors, [], 'failed deletion left the UI without an active student')
        finally:
            context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
