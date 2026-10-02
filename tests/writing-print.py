"""Standalone newspaper/letter PDFs keep student work and omit screen controls.

Uses isolated synthetic records. Install Poppler/pdftotext to verify the actual
PDF text, then run against the static server described in tests/README.md.
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
class WritingPrint(unittest.TestCase):
    def test_individual_newspaper_and_letter_pdfs_include_work_without_screen_actions(self):
        cases = (
            ('news', '속보! 신라, 삼국 통일을 이루다', '속보! 신라, 삼국 통일을 이루다',
             ('당', '백제와 고구려를', '새로 배운 역사를 가족에게 알려주고 싶어요.')),
            ('letter', '장보고에게 편지 쓰기', '장보고님께',
             ('청해진', '바다 도적을 물리치고 무역을 할', '안전한 바다길을 지켜 주셔서 고맙습니다.')),
        )
        compact = lambda text: re.sub(r'\s+', '', text)
        with sync_playwright() as runner:
            executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
            options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
            if executable:
                options['executable_path'] = executable
            browser = runner.chromium.launch(**options)
            try:
                for kind, option, print_title, answers in cases:
                    with self.subTest(kind=kind), browser.new_context(locale='ko-KR', service_workers='block') as context:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        page.goto(BASE, wait_until='domcontentloaded')
                        page.evaluate('''async () => {
                            const {newProfile} = await import('./js/storage.js');
                            const student = newProfile(40, '🦊', '가나다라마바사아자차');
                            for (let i = 1; i <= 10; i++) student.quests['q' + i] = {
                                stage: 5, done: true, notes: [], mastery: {passed: true},
                            };
                            localStorage.setItem('history-quest:v1', JSON.stringify({
                                current: 'writing-print', profiles: {'writing-print': student},
                            }));
                        }''')
                        page.reload(wait_until='domcontentloaded')
                        page.get_by_role('button', name='역사 신문 · 편지', exact=False).first.click()
                        page.locator('.writing-opt').filter(has_text=option).click()
                        for field, answer in zip(page.locator('.blank').all(), answers):
                            field.fill(answer)
                        page.get_by_role('button', name='✔ 확인하기', exact=True).click()
                        page.get_by_role('button', name='💾 저장하고 퀘스트 마치기', exact=True).click()
                        expect(page.get_by_text('나의 역사 노트에도 저장했어요.', exact=True)).to_be_visible()
                        expect(page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True)).to_be_visible()
                        await_fonts = 'async () => { await document.fonts.ready; }'
                        page.evaluate(await_fonts)
                        with tempfile.TemporaryDirectory(prefix='history-writing-print-') as folder:
                            pdf = Path(folder) / f'{kind}.pdf'
                            page.pdf(path=str(pdf), format='A4', print_background=True)
                            text = subprocess.run(['pdftotext', str(pdf), '-'],
                                                  check=True, capture_output=True, text=True).stdout
                            printed = compact(text)
                            for required in ('40번', '가나다라마바사아자차', print_title, answers[-1]):
                                self.assertIn(compact(required), printed)
                            for screen_text in ('나의 역사 노트에도 저장했어요.', '나의 역사 노트 보기',
                                                '지도로 돌아가기', '인쇄하기 / PDF로 저장'):
                                self.assertNotIn(compact(screen_text), printed)
                        self.assertEqual(errors, [])
            finally:
                browser.close()


if __name__ == '__main__':
    unittest.main()
