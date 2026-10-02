"""Activity save regressions with deliberately pending storage callbacks.

Run against a local static server; see tests/README.md for dependencies.
HISTORY_TEST_BASE_URL and HISTORY_TEST_BROWSER may override the defaults.
"""
import os
import shutil
import unittest

from playwright.sync_api import sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')

HELPERS = '''
    const {renderSummary} = await import('./js/activities/summary.js');
    const {renderMastery} = await import('./js/activities/mastery.js');
    const {stations} = await import('./content/quests.js');
    const root = document.createElement('div');
    document.body.append(root);
    const button = label => [...root.querySelectorAll('button')].find(b => b.textContent === label);
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    const deferred = () => {
        let resolve;
        const promise = new Promise(r => { resolve = r; });
        return {promise, resolve};
    };
    let checks = 0;
    const check = (condition, message) => {
        if (!condition) throw new Error(message);
        checks++;
    };
'''


class ActivitySaves(unittest.TestCase):
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

    def run_checks(self, script, expected_count):
        context = self.browser.new_context(service_workers='block')
        self.addCleanup(context.close)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until='domcontentloaded')
        count = page.evaluate('async () => {' + HELPERS + script + '\nroot.remove(); return checks; }')
        self.assertEqual(count, expected_count)
        self.assertEqual(errors, [])

    def test_summary_waits_for_save_and_completion_and_blocks_duplicate_calls(self):
        self.run_checks('''
            let pending = deferred(), saveCalls = 0, doneCalls = 0;
            renderSummary(root, {frames: [{parts: ['생각: ', {free: true}]}]}, {
                record: {},
                save() { saveCalls++; return pending.promise; },
                async done() { doneCalls++; },
            });
            root.querySelector('input').value = '나의 생각';
            button('✔ 확인하기').click();
            const save = button('💾 저장하고 퀘스트 마치기');
            save.click();
            // Dispatch also exercises the handler's guard independently of disabled buttons.
            save.dispatchEvent(new Event('click'));
            check(save.disabled && saveCalls === 1 && doneCalls === 0,
                'Summary must wait for save and prevent duplicate calls.');
            pending.resolve(false);
            await settle();
            check(doneCalls === 0 && !save.disabled,
                'A rejected save must not complete the summary and must release the button.');
            pending = deferred();
            save.click();
            pending.resolve(true);
            await settle();
            check(saveCalls === 2 && doneCalls === 1,
                'A successful retry must complete the summary exactly once.');

            const donePending = deferred();
            saveCalls = 0;
            doneCalls = 0;
            renderSummary(root, {frames: [{parts: [{free: true}]}]}, {
                record: {},
                async save() { saveCalls++; return true; },
                done() { doneCalls++; return donePending.promise; },
            });
            root.querySelector('input').value = '나의 생각';
            button('✔ 확인하기').click();
            const save2 = button('💾 저장하고 퀘스트 마치기');
            save2.click();
            await settle();
            save2.dispatchEvent(new Event('click'));
            check(save2.disabled && saveCalls === 1 && doneCalls === 1,
                'Summary must remain busy until asynchronous completion finishes.');
            donePending.resolve();
            await settle();
        ''', 4)

    def test_mastery_waits_for_save_review_and_completion_and_blocks_duplicate_calls(self):
        self.run_checks('''
            const q = stations[0].quest.stages.find(s => s.type === 'mastery')
                .questions.find(q => q.type === 'choice');
            const stage = {questions: [q], pick: 1, pass: 1};
            const solve = () => {
                [...root.querySelectorAll('.choice')]
                    .find(b => b.textContent.replace(/^○/, '') === q.choices[q.answer]).click();
                button('결과 보기 ▶').click();
            };
            let pending = deferred(), saveCalls = 0, reviewCalls = 0;
            renderMastery(root, stage, {
                record: {},
                save() { saveCalls++; return pending.promise; },
                reviewUpdate() { reviewCalls++; return true; },
                done() {},
            });
            solve();
            button('결과 보기 ▶').dispatchEvent(new Event('click'));
            check(saveCalls === 1 && !root.querySelector('.score-big'),
                'Mastery must wait for save and prevent duplicate result writes.');
            pending.resolve(false);
            await settle();
            check(reviewCalls === 0 && !root.querySelector('.score-big'),
                'A rejected mastery save must suppress review updates and results.');

            pending = deferred();
            saveCalls = 0;
            reviewCalls = 0;
            renderMastery(root, stage, {
                record: {},
                async save() { saveCalls++; return true; },
                reviewUpdate() { reviewCalls++; return pending.promise; },
                done() {},
            });
            solve();
            await settle();
            check(saveCalls === 1 && reviewCalls === 1 && !root.querySelector('.score-big'),
                'Mastery must wait for the review update before showing results.');
            pending.resolve(false);
            await settle();
            check(!root.querySelector('.score-big'),
                'A rejected review update must suppress mastery results.');

            const donePending = deferred();
            let doneCalls = 0;
            renderMastery(root, stage, {
                record: {},
                async save() { return true; },
                async reviewUpdate() { return true; },
                done() { doneCalls++; return donePending.promise; },
            });
            solve();
            await settle();
            check(root.querySelector('.score-big')?.textContent === '1 / 1',
                'Mastery must show results after both saves succeed.');
            const next = button('다음 단계로 ▶');
            next.click();
            next.dispatchEvent(new Event('click'));
            check(next.disabled && doneCalls === 1,
                'Mastery must wait for completion and prevent duplicate calls.');
            donePending.resolve();
            await settle();
        ''', 6)


if __name__ == '__main__':
    unittest.main()
