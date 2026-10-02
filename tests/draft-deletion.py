"""Verify durable student deletion clears only that student's unsaved drafts."""
import os
import re
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
FIRST = '첫 학생'
SECOND = '다른 학생'


class DraftDeletion(unittest.TestCase):
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

    def setUp(self):
        self.context = self.browser.new_context(locale='ko-KR', service_workers='block')
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(BASE, wait_until='domcontentloaded')
        self.activity = self.page.evaluate('''async () => {
            const {newProfile} = await import('./js/storage.js');
            const {inquiries} = await import('./content/inquiries.js');
            const first = newProfile(1, '🦊', '첫 학생');
            const second = newProfile(2, '🐻', '다른 학생');
            for (const profile of [first, second]) for (let i = 1; i <= 10; i++)
                profile.quests['q'+i] = {stage: 5, done: true, notes: []};
            localStorage.setItem('history-quest:v1', JSON.stringify({
                current: 'draft-first', profiles: {'draft-first': first, 'draft-second': second},
            }));
            return inquiries[0];
        }''')
        self.page.reload(wait_until='domcontentloaded')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
        finally:
            self.context.close()

    def choose_student(self, name):
        self.page.get_by_role('button', name=re.compile(name)).click()
        expect(self.page.locator('.station')).to_have_count(10)

    def open_writing(self):
        self.page.get_by_role('button', name='역사 신문 · 편지', exact=False).first.click()
        self.page.locator('.writing-opt').first.click()

    def open_inquiry(self):
        self.page.locator('.unit').nth(self.activity['unit']).get_by_role(
            'button', name=re.compile('자료 탐구 · 역사 일기')).click()
        self.page.get_by_role('button', name=re.compile(re.escape(self.activity['title']))).click()

    def home(self):
        self.page.get_by_role('button', name='홈으로', exact=True).click()
        if self.page.get_by_role('heading', name='아직 글을 저장하지 않았어요', exact=True).count():
            self.page.get_by_role('button', name='활동 나가기', exact=True).click()
        expect(self.page.locator('#tab-start')).to_be_visible()

    def make_drafts(self, name):
        self.choose_student(name)
        self.open_writing()
        self.page.locator('.blank').last.fill(f'{name}의 신문 초안이에요.')
        self.home()
        self.choose_student(name)
        self.open_inquiry()
        self.page.get_by_label(self.activity['prompts'][0]['label'], exact=True).fill(f'{name}의 탐구 초안이에요.')
        self.home()

    def warns_on_unload(self):
        return self.page.evaluate('''() => {
            const event = new Event('beforeunload', {cancelable: true});
            window.dispatchEvent(event);
            return event.defaultPrevented;
        }''')

    def delete_current(self):
        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.page.get_by_role('button', name='🗑️ 이 기기에서 내 기록 지우기', exact=True).click()

    def assert_drafts(self, name):
        self.open_writing()
        expect(self.page.locator('.blank').last).to_have_value(f'{name}의 신문 초안이에요.')
        self.home()
        self.choose_student(name)
        self.open_inquiry()
        expect(self.page.get_by_label(self.activity['prompts'][0]['label'], exact=True)).to_have_value(
            f'{name}의 탐구 초안이에요.')

    def test_successful_deletion_clears_both_drafts_and_unload_warning(self):
        self.make_drafts(FIRST)
        self.assertTrue(self.warns_on_unload())
        self.choose_student(FIRST)
        self.delete_current()
        expect(self.page.locator('#tab-start')).to_be_visible()
        self.assertFalse(self.warns_on_unload())
        self.assertFalse(self.page.evaluate("'draft-first' in JSON.parse(localStorage.getItem('history-quest:v1')).profiles"))

    def test_failed_deletion_preserves_both_drafts_and_warning(self):
        self.make_drafts(FIRST)
        self.choose_student(FIRST)
        self.page.evaluate('''() => {
            window.originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'history-quest:v1') throw new DOMException('Test full', 'QuotaExceededError');
                return window.originalSetItem.call(this, key, value);
            };
        }''')
        self.delete_current()
        expect(self.page.get_by_text('⚠️ 기록을 지우지 못했어요. 기록은 그대로 남아 있어요. 다시 시도해 주세요.', exact=True)).to_be_visible()
        self.assertTrue(self.warns_on_unload())
        self.assertTrue(self.page.evaluate("'draft-first' in JSON.parse(localStorage.getItem('history-quest:v1')).profiles"))
        self.page.evaluate('() => { Storage.prototype.setItem = window.originalSetItem; }')
        self.assert_drafts(FIRST)

    def test_deleting_one_student_keeps_other_students_both_drafts(self):
        self.make_drafts(FIRST)
        self.make_drafts(SECOND)
        self.choose_student(FIRST)
        self.delete_current()
        expect(self.page.locator('#tab-start')).to_be_visible()
        self.assertTrue(self.warns_on_unload())
        self.choose_student(SECOND)
        self.assert_drafts(SECOND)


if __name__ == '__main__':
    unittest.main()
