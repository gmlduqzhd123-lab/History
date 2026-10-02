"""A failed rename must preserve the saved identity and allow a durable retry."""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
KEY = 'history-quest:v1'


class RenameRegressions(unittest.TestCase):
    def test_failed_rename_keeps_identity_and_retries_without_losing_progress(self):
        with sync_playwright() as runner:
            options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
            executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
            if executable:
                options['executable_path'] = executable
            browser = runner.chromium.launch(**options)
            context = browser.new_context(locale='ko-KR', service_workers='block')
            page = context.new_page()
            page.set_default_timeout(10000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE, wait_until='domcontentloaded')
            page.evaluate('''async () => {
                const {newProfile} = await import('./js/storage.js');
                const p = newProfile(1, '🦊', '하늘');
                p.quests.q1 = {stage:2, done:false, notes:['소중한 학습 기록']};
                localStorage.setItem('history-quest:v1', JSON.stringify({
                    current:null, profiles:{'rename-student':p}
                }));
            }''')
            page.reload(wait_until='domcontentloaded')
            page.locator('.explorer-list button').filter(has_text='하늘').click()
            expect(page.locator('.station')).to_have_count(10)
            before = page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)
            page.evaluate('''() => {
                const original = Storage.prototype.setItem;
                window.failRename = true;
                Storage.prototype.setItem = function(key, value) {
                    if (key === 'history-quest:v1' && window.failRename)
                        throw new DOMException('Test storage full', 'QuotaExceededError');
                    return original.call(this, key, value);
                };
            }''')
            page.get_by_label('탐험가 메뉴', exact=True).click()
            page.get_by_role('button', name='✏️ 이름 바꾸기', exact=True).click()
            page.get_by_label('이름', exact=True).fill('새하늘')
            page.get_by_role('button', name='저장하기', exact=True).click()
            page.wait_for_function('!document.getElementById("app").hasAttribute("aria-busy")')
            expect(page.get_by_role('dialog')).to_be_visible()
            expect(page.get_by_role('dialog')).to_contain_text('이름을 저장하지 못했어요.')
            expect(page.get_by_label('이름', exact=True)).to_have_value('새하늘')
            self.assertEqual(page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY), before)

            # Closing after failure must discard only the attempted rename. A later
            # successful navigation save must not accidentally commit that name.
            page.get_by_role('dialog').get_by_role('button', name='닫기', exact=True).click()
            expect(page.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('하늘')
            page.evaluate('window.failRename = false')
            page.get_by_label('탐험가 메뉴', exact=True).click()
            page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
            expect(page.locator('.explorer-list button').filter(has_text='하늘')).to_be_visible()
            saved = page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)
            self.assertEqual(saved['profiles']['rename-student'], before['profiles']['rename-student'])

            page.locator('.explorer-list button').filter(has_text='하늘').click()
            expect(page.locator('.station')).to_have_count(10)
            page.get_by_label('탐험가 메뉴', exact=True).click()
            page.get_by_role('button', name='✏️ 이름 바꾸기', exact=True).click()
            page.get_by_label('이름', exact=True).fill('새하늘')
            page.get_by_role('button', name='저장하기', exact=True).click()
            expect(page.get_by_role('dialog')).to_have_count(0)
            page.reload(wait_until='domcontentloaded')
            expect(page.get_by_label('탐험가 메뉴', exact=True)).to_contain_text('새하늘')
            saved = page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)
            self.assertEqual(saved['profiles']['rename-student']['name'], '새하늘')
            self.assertEqual(saved['profiles']['rename-student']['quests'], before['profiles']['rename-student']['quests'])
            self.assertEqual(errors, [])
            browser.close()


if __name__ == '__main__':
    unittest.main()
