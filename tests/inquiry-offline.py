"""One real service-worker smoke: new inquiry assets, writing and saved notes offline."""
import os
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright


BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')


class InquiryOffline(unittest.TestCase):
    def test_precached_inquiry_images_style_and_saved_notebook_work_offline(self):
        with sync_playwright() as runner:
            options = {'headless': True}
            binary = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
            if binary:
                options['executable_path'] = binary
            browser = runner.chromium.launch(**options)
            try:
                context = browser.new_context(locale='ko-KR', service_workers='allow')
                page = context.new_page()
                page.set_default_timeout(15000)
                errors = []
                local_failures = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('requestfailed', lambda request: local_failures.append(request.url)
                        if request.url.startswith(BASE) else None)
                page.goto(BASE, wait_until='domcontentloaded')
                activity = page.evaluate('''async () => {
                    const { inquiries } = await import('./content/inquiries.js');
                    const { newProfile } = await import('./js/storage.js');
                    const p = newProfile(1, '🐻', '오프라인 탐구');
                    for (let i = 1; i <= 10; i++) p.quests['q' + i] = {stage: 5, done: true, notes: []};
                    localStorage.setItem('history-quest:v1', JSON.stringify({current: 'offline-inquiry', profiles: {'offline-inquiry': p}}));
                    const ready = await navigator.serviceWorker.ready;
                    const cacheName = (await caches.keys()).find(name => /^history-quest-v\\d+$/.test(name));
                    const cache = await caches.open(cacheName);
                    const required = ['js/extras/inquiry.js', 'content/inquiries.js', 'css/inquiry.css'];
                    for (const source of inquiries.flatMap(item => item.sources)) {
                        if (source.image) required.push(source.image);
                    }
                    for (const asset of required) {
                        if (!await cache.match(new URL(asset, location.href).href)) throw new Error('not precached: ' + asset);
                    }
                    return inquiries.find(item => item.sources.some(source => source.image)) || inquiries[0];
                }''')
                context.set_offline(True)
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function('navigator.serviceWorker.controller !== null')
                page.locator('section.unit').nth(activity['unit']).get_by_role('button', name='자료 탐구 · 역사 일기', exact=False).click()
                page.locator('.inquiry-option').filter(has_text=activity['title']).click()
                expect(page.get_by_role('heading', name=activity['title'], exact=True)).to_be_visible()
                self.assertTrue(page.evaluate('Array.from(document.styleSheets).some(sheet => sheet.href?.includes("css/inquiry.css"))'))
                for image in page.locator('.inquiry-source-image').all():
                    expect(image).to_be_visible()
                    image.evaluate('(element) => element.decode()')
                    self.assertGreater(image.evaluate('(element) => element.naturalWidth'), 0)
                if activity['kind'] == 'diary':
                    page.get_by_role('radio', name=activity['roles'][0]['label'], exact=True).check()
                for source in activity['sources'][:activity['minEvidence']]:
                    page.get_by_role('checkbox', name=f"{source['title']}을 근거로 선택", exact=True).check()
                for prompt in activity['prompts']:
                    page.get_by_role('textbox', name=prompt['label'], exact=True).fill('인터넷 없이도 자료를 읽고 근거를 바탕으로 생각을 적었어요.')
                for check in activity['checks']:
                    page.get_by_role('checkbox', name=check, exact=True).check()
                page.get_by_role('button', name='💾 탐구 기록 저장하기', exact=True).click()
                page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True).wait_for()
                page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True).click()
                expect(page.locator('.inquiry-result').filter(has_text=activity['title'])).to_contain_text('인터넷 없이도 자료를 읽고')
                page.reload(wait_until='domcontentloaded')
                page.get_by_role('button', name='📒 나의 역사 노트', exact=True).click()
                expect(page.locator('.inquiry-result').filter(has_text=activity['title'])).to_contain_text('인터넷 없이도 자료를 읽고')
                stored = page.evaluate('JSON.parse(localStorage.getItem("history-quest:v1")).profiles["offline-inquiry"].extras.inquiries')
                self.assertIn(activity['id'], stored)
                self.assertEqual(errors, [])
                self.assertEqual(local_failures, [])
            finally:
                browser.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
