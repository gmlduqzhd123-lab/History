"""Check that individual inquiry/diary PDFs identify their student author.

Run against the static test server. PDF text checks additionally use pdftotext
(Poppler); all records belong to an isolated synthetic browser context.
"""
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')


@unittest.skipUnless(shutil.which('pdftotext'), 'Install Poppler/pdftotext for PDF text checks.')
class InquiryPrint(unittest.TestCase):
    def test_individual_inquiry_and_diary_pdfs_include_name_number_and_title(self):
        with sync_playwright() as runner:
            executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
            options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
            if executable:
                options['executable_path'] = executable
            browser = runner.chromium.launch(**options)
            try:
                for kind in ('inquiry', 'diary'):
                    with self.subTest(kind=kind), browser.new_context(locale='ko-KR', service_workers='block') as context:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        page.goto(BASE, wait_until='domcontentloaded')
                        activity = page.evaluate('''async kind => {
                            const {newProfile} = await import('./js/storage.js');
                            const {inquiries} = await import('./content/inquiries.js');
                            const activity = inquiries.find(item => kind === 'diary'
                                ? item.kind === 'diary' : item.kind !== 'diary');
                            const student = newProfile(17, '🦊', '김점검');
                            student.quests[activity.questId] = {
                                stage: 5, done: true, notes: [], mastery: {passed: true},
                            };
                            localStorage.setItem('history-quest:v1', JSON.stringify({
                                current: 'print-check', profiles: {'print-check': student},
                            }));
                            return activity;
                        }''', kind)
                        page.reload(wait_until='domcontentloaded')
                        page.locator('.unit').nth(activity['unit']).get_by_role(
                            'button', name=re.compile('자료 탐구 · 역사 일기')).click()
                        page.get_by_role('button', name=re.compile(re.escape(activity['title']))).click()
                        if activity.get('roles'):
                            page.get_by_role('radio', name=activity['roles'][0]['label'], exact=True).check()
                        for source in activity['sources'][:activity['minEvidence']]:
                            page.get_by_label(source['title'] + '을 근거로 선택', exact=True).check()
                        for prompt in activity['prompts']:
                            page.get_by_label(prompt['label'], exact=True).fill(
                                '자료에서 확인한 사실과 내가 생각한 점을 구별하여 적었습니다.')
                        for check in activity['checks']:
                            page.get_by_label(check, exact=True).check()
                        page.get_by_role('button', name='💾 탐구 기록 저장하기', exact=True).click()
                        expect(page.locator('.inquiry-result')).to_contain_text('작성자: 17번 김점검')
                        with tempfile.TemporaryDirectory(prefix='history-inquiry-print-') as folder:
                            pdf = Path(folder) / 'individual.pdf'
                            page.pdf(path=str(pdf), format='A4', print_background=True)
                            extracted = subprocess.run(['pdftotext', str(pdf), '-'],
                                                       check=True, capture_output=True, text=True).stdout
                            self.assertIn('17번', extracted)
                            self.assertIn('김점검', extracted)
                            compact = re.sub(r'\s+', '', extracted)
                            self.assertIn(re.sub(r'\s+', '', activity['title']), compact)
                        page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True).click()
                        expect(page.locator('.inquiry-result')).to_contain_text(activity['title'])
                        expect(page.get_by_role('heading', name=re.compile('17번 김점검.*역사 노트'))).to_be_visible()
                        # The notebook already has a student heading; avoid repeating it on every activity.
                        expect(page.get_by_text('작성자: 17번 김점검', exact=True)).to_have_count(0)
                        self.assertEqual(errors, [])
            finally:
                browser.close()


if __name__ == '__main__':
    unittest.main()
