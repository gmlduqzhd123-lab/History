"""Exercise source-based inquiry and historical diaries through the real app.

Run against the static server documented in tests/README.md. Synthetic profiles
and isolated browser contexts keep these checks separate from student records.
"""
import copy
import os
import re
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
KEY = 'history-quest:v1'
PROFILE_KEY = 'inquiry-test'
SAVE_LABEL = '💾 탐구 기록 저장하기'


class InquiryFlow(unittest.TestCase):
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
        self.errors = []
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(BASE, wait_until='domcontentloaded')
        self.activities = self.page.evaluate("async () => (await import('./content/inquiries.js')).inquiries")
        self.inquiry = next(a for a in self.activities if a['unit'] == 0 and a['kind'] != 'diary')
        self.diary = next(a for a in self.activities if a['unit'] == 0 and a['kind'] == 'diary')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
        finally:
            self.context.close()

    def seed(self, done=(), teacher=False):
        self.page.evaluate('''async value => {
            const {newProfile} = await import('./js/storage.js');
            const profile = newProfile(1, '🦊', '자료 점검');
            for (const id of value.done) profile.quests[id] = {
                stage: 5, done: true, notes: [], mastery: {passed: true},
            };
            localStorage.setItem(value.key, JSON.stringify({
                current: value.profileKey, profiles: {[value.profileKey]: profile},
            }));
        }''', {'key': KEY, 'profileKey': PROFILE_KEY, 'done': list(done)})
        self.page.goto(BASE.rstrip('/') + '/' + ('?open=all' if teacher else ''), wait_until='domcontentloaded')
        expect(self.page.locator('.station')).to_have_count(10)

    def records(self):
        return self.page.evaluate('''value => JSON.parse(localStorage.getItem(value.key))
            .profiles[value.profileKey].extras.inquiries''', {'key': KEY, 'profileKey': PROFILE_KEY})

    def open_list(self, unit=0):
        self.page.locator('.unit').nth(unit).get_by_role(
            'button', name=re.compile('자료 탐구 · 역사 일기')
        ).click()

    def activity_button(self, activity):
        return self.page.get_by_role('button', name=re.compile(re.escape(activity['title'])))

    def open_activity(self, activity):
        self.open_list(activity['unit'])
        self.activity_button(activity).click()
        expect(self.page.get_by_label(activity['prompts'][0]['label'], exact=True)).to_be_visible()

    def answers(self, activity, suffix='첫 기록'):
        return {prompt['id']: f"{suffix} ({prompt['id']}): 자료를 살펴보니 당시의 생활과 선택을 알 수 있습니다. "
                '자료에서 확인한 사실과 내가 생각한 점을 구별해서 적었습니다.'
                for prompt in activity['prompts']}

    def fill_answers(self, activity, answers):
        for prompt in activity['prompts']:
            self.page.get_by_label(prompt['label'], exact=True).fill(answers[prompt['id']])
        if activity.get('roles'):
            self.page.get_by_role('radio', name=activity['roles'][0]['label'], exact=True).check()

    def choose_evidence(self, activity, count=None):
        count = activity['minEvidence'] if count is None else count
        for source in activity['sources'][:count]:
            self.page.get_by_label(f"{source['title']}을 근거로 선택", exact=True).check()

    def complete_checks(self, activity, count=None):
        checks = activity['checks'] if count is None else activity['checks'][:count]
        for check in checks:
            self.page.get_by_label(check, exact=True).check()

    def complete(self, activity, suffix='첫 기록'):
        answers = self.answers(activity, suffix)
        self.fill_answers(activity, answers)
        self.choose_evidence(activity)
        self.complete_checks(activity)
        self.page.get_by_role('button', name=SAVE_LABEL, exact=True).click()
        expect(self.page.locator('.inquiry-result')).to_be_visible()
        return answers

    def map_from_list(self):
        self.page.get_by_role('button', name='🗺️ 지도', exact=True).click()
        expect(self.page.locator('.station')).to_have_count(10)

    def test_nine_activities_have_readable_sources_and_loaded_local_images(self):
        self.assertEqual(len(self.activities), 9)
        self.assertEqual([sum(a['unit'] == unit for a in self.activities) for unit in range(3)], [4, 3, 2])
        self.assertEqual(len({a['id'] for a in self.activities}), 9)
        self.seed(teacher=True)
        image_count = 0
        for activity in self.activities:
            with self.subTest(activity=activity['id']):
                self.open_activity(activity)
                expect(self.page.locator('.inquiry-source')).to_have_count(len(activity['sources']))
                for source in activity['sources']:
                    card = self.page.locator('.inquiry-source').filter(
                        has=self.page.get_by_role('heading', name=source['title'], exact=True)
                    )
                    expect(card).to_contain_text(source['text'])
                    if source.get('credit'):
                        expect(card).to_contain_text(source['credit'])
                    if source.get('image'):
                        image_count += 1
                        image = card.locator('img')
                        expect(image).to_have_attribute('alt', source.get('alt') or source['title'])
                        image.scroll_into_view_if_needed()
                        expect(image).to_be_visible()
                        self.page.wait_for_function(
                            'image => image.complete && image.naturalWidth > 0', arg=image.element_handle()
                        )
                self.page.get_by_role('button', name='← 활동 고르기', exact=True).first.click()
                self.map_from_list()
        self.assertGreater(image_count, 0, 'At least one inquiry must exercise its actual source image.')

    def test_evidence_answers_and_self_checks_are_required_without_auto_grading(self):
        self.seed(done=[self.inquiry['questId']])
        before = self.page.evaluate('''key => JSON.parse(localStorage.getItem(key))
            .profiles['inquiry-test'].quests''', KEY)
        self.open_activity(self.inquiry)
        save = self.page.get_by_role('button', name=SAVE_LABEL, exact=True)
        save.click()
        expect(self.page.locator('.inquiry-feedback')).to_contain_text('자료')
        self.assertEqual(self.records(), {})
        self.choose_evidence(self.inquiry)
        expect(self.page.locator('.inquiry-source.selected')).to_have_count(self.inquiry['minEvidence'])
        save.click()
        expect(self.page.locator('.inquiry-feedback')).to_contain_text('모든 질문')
        self.fill_answers(self.inquiry, self.answers(self.inquiry))
        self.complete_checks(self.inquiry, len(self.inquiry['checks']) - 1)
        save.click()
        expect(self.page.locator('.inquiry-feedback')).to_contain_text('점검')
        self.assertEqual(self.records(), {})
        self.complete_checks(self.inquiry)
        save.click()
        expect(self.page.locator('.inquiry-result')).to_be_visible()
        self.assertEqual(set(self.records()), {self.inquiry['id']})
        after = self.page.evaluate('''key => JSON.parse(localStorage.getItem(key))
            .profiles['inquiry-test'].quests''', KEY)
        self.assertEqual(after, before, 'Free responses must not change mastery or quest progress.')
        self.assertNotIn('정답', self.page.locator('.inquiry-result').inner_text())

    def test_diary_requires_a_role_and_keeps_facts_and_imagination(self):
        self.seed(done=[self.diary['questId']])
        self.open_activity(self.diary)
        self.choose_evidence(self.diary)
        answers = self.answers(self.diary, '역사 일기')
        for prompt in self.diary['prompts']:
            self.page.get_by_label(prompt['label'], exact=True).fill(answers[prompt['id']])
        self.complete_checks(self.diary)
        self.page.get_by_role('button', name=SAVE_LABEL, exact=True).click()
        expect(self.page.locator('.inquiry-feedback')).to_contain_text('입장')
        self.assertEqual(self.records(), {})
        role = self.diary['roles'][0]
        self.page.get_by_role('radio', name=role['label'], exact=True).check()
        expect(self.page.locator('.inquiry-role-context')).to_have_text(role['context'])
        self.page.get_by_role('button', name=SAVE_LABEL, exact=True).click()
        expect(self.page.locator('.inquiry-result')).to_contain_text(role['label'])
        record = self.records()[self.diary['id']]
        self.assertEqual(record['role'], role['id'])
        self.assertEqual(record['answers'], answers)
        self.assertEqual(record['checks'], [True] * len(self.diary['checks']))

    def test_saved_inquiries_remain_separate_and_edit_after_reload(self):
        self.seed(teacher=True)
        self.open_activity(self.inquiry)
        first = self.complete(self.inquiry)
        self.page.get_by_role('button', name='← 활동 고르기', exact=True).first.click()
        self.map_from_list()
        self.open_activity(self.diary)
        self.complete(self.diary)
        saved_diary = copy.deepcopy(self.records()[self.diary['id']])
        self.page.reload(wait_until='domcontentloaded')
        self.open_activity(self.inquiry)
        for prompt in self.inquiry['prompts']:
            expect(self.page.get_by_label(prompt['label'], exact=True)).to_have_value(first[prompt['id']])
        for source in self.inquiry['sources'][:self.inquiry['minEvidence']]:
            expect(self.page.get_by_label(f"{source['title']}을 근거로 선택", exact=True)).to_be_checked()
        revised = self.complete(self.inquiry, '고친 기록')
        self.assertEqual(self.records()[self.inquiry['id']]['answers'], revised)
        self.assertEqual(self.records()[self.diary['id']], saved_diary)
        self.assertEqual(len(self.records()), 2)

    def test_narrow_calm_activity_has_no_horizontal_overflow(self):
        activity = next(a for a in self.activities if a['unit'] == 2)
        self.page.set_viewport_size({'width': 320, 'height': 760})
        self.seed(teacher=True)
        self.open_activity(activity)
        expect(self.page.locator('body')).to_have_class(re.compile(r'\bcalm\b'))
        metrics = self.page.evaluate('''() => ({
            width: window.innerWidth,
            document: document.documentElement.scrollWidth,
            controls: [...document.querySelectorAll('.inquiry-textarea, .inquiry-source-image')]
                .map(node => {const r = node.getBoundingClientRect(); return {left:r.left,right:r.right};}),
        })''')
        self.assertLessEqual(metrics['document'], metrics['width'])
        for control in metrics['controls']:
            self.assertGreaterEqual(control['left'], 0)
            self.assertLessEqual(control['right'], 320)
        self.complete(activity)
        self.assertNotRegex(self.page.locator('.inquiry-result').inner_text(), '[🎉🏆🥳]')

    def test_locked_activities_follow_their_quest_and_teacher_override(self):
        self.seed()
        self.open_list(self.inquiry['unit'])
        for activity in (a for a in self.activities if a['unit'] == self.inquiry['unit']):
            expect(self.activity_button(activity)).to_be_disabled()
        self.assertEqual(self.records(), {})
        self.seed(done=[self.inquiry['questId']])
        self.open_list(self.inquiry['unit'])
        for activity in (a for a in self.activities if a['unit'] == self.inquiry['unit']):
            button = self.activity_button(activity)
            if activity['questId'] == self.inquiry['questId']:
                expect(button).to_be_enabled()
            else:
                expect(button).to_be_disabled()
        self.seed(teacher=True)
        for unit in range(3):
            self.open_list(unit)
            for activity in (a for a in self.activities if a['unit'] == unit):
                expect(self.activity_button(activity)).to_be_enabled()
            self.map_from_list()

    def test_draft_leave_confirmation_and_profile_isolation(self):
        self.seed(teacher=True)
        def warns_on_unload():
            return self.page.evaluate('''() => {
                const event = new Event('beforeunload', {cancelable: true});
                window.dispatchEvent(event);
                return event.defaultPrevented;
            }''')
        self.assertFalse(warns_on_unload())
        self.open_activity(self.inquiry)
        prompt = self.inquiry['prompts'][0]
        draft = '이 학생만 쓰던 자료 탐구 초안입니다.'
        self.page.get_by_label(prompt['label'], exact=True).fill(draft)
        self.assertTrue(warns_on_unload())
        self.page.get_by_role('button', name='← 활동 고르기', exact=True).first.click()
        expect(self.page.get_by_role('heading', name='아직 탐구 기록을 저장하지 않았어요')).to_be_visible()
        self.page.get_by_role('button', name='계속 쓰기', exact=True).click()
        expect(self.page.get_by_label(prompt['label'], exact=True)).to_have_value(draft)
        self.page.get_by_role('button', name='← 활동 고르기', exact=True).first.click()
        self.page.get_by_role('button', name='활동 나가기', exact=True).click()
        expect(self.activity_button(self.inquiry)).to_contain_text('쓰던 내용')
        self.assertEqual(self.records(), {}, 'Leaving an unsaved draft must not claim a saved response.')
        self.map_from_list()
        self.assertTrue(warns_on_unload(), 'A draft still needs protection after leaving its screen.')
        self.open_activity(self.inquiry)
        self.page.get_by_role('button', name='홈으로', exact=True).click()
        self.assertTrue(warns_on_unload(), 'Home must not remove the unsaved-draft unload warning.')
        self.page.get_by_role('button', name=re.compile('자료 점검')).click()
        # A different student's update refreshes the app's data object. It must
        # neither erase this draft nor make it visible to that other student.
        other = self.context.new_page()
        other.goto(BASE, wait_until='domcontentloaded')
        other.evaluate('''async () => {
            const {loadData, newProfile, saveData} = await import('./js/storage.js');
            const data = loadData();
            data.profiles['other-inquiry-test'] = newProfile(2, '🐻', '다른 학생');
            if (await saveData(data) !== true) throw new Error('Cannot create second test student');
        }''')
        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
        self.page.get_by_role('button', name=re.compile('다른 학생')).click()
        self.open_activity(self.inquiry)
        expect(self.page.get_by_label(prompt['label'], exact=True)).to_have_value('')
        self.page.get_by_role('button', name='← 활동 고르기', exact=True).first.click()
        self.map_from_list()
        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
        self.page.get_by_role('button', name=re.compile('자료 점검')).click()
        self.open_activity(self.inquiry)
        expect(self.page.get_by_label(prompt['label'], exact=True)).to_have_value(draft)
        other.close()

    def test_student_html_is_displayed_as_text_and_profanity_is_filtered(self):
        self.seed(teacher=True)
        self.open_activity(self.inquiry)
        answers = self.answers(self.inquiry)
        prompt = self.inquiry['prompts'][0]
        answers[prompt['id']] = '씨.발'
        self.fill_answers(self.inquiry, answers)
        self.choose_evidence(self.inquiry)
        self.complete_checks(self.inquiry)
        self.page.get_by_role('button', name=SAVE_LABEL, exact=True).click()
        expect(self.page.locator('.inquiry-result')).to_contain_text('🌸')
        self.assertEqual(self.records()[self.inquiry['id']]['answers'][prompt['id']], '🌸')
        self.page.get_by_role('button', name='✏️ 다시 쓰기', exact=True).click()
        unsafe = '<img src=x onerror="window.inquiryInjected=true"><script>window.inquiryInjected=true</script>'
        self.page.get_by_label(prompt['label'], exact=True).fill(unsafe)
        self.page.get_by_role('button', name=SAVE_LABEL, exact=True).click()
        expect(self.page.locator('.inquiry-result')).to_contain_text(unsafe)
        expect(self.page.locator('.inquiry-result img, .inquiry-result script')).to_have_count(0)
        self.assertIsNone(self.page.evaluate('window.inquiryInjected'))
        self.page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True).click()
        expect(self.page.locator('.inquiry-result')).to_contain_text(unsafe)
        expect(self.page.locator('.inquiry-result img, .inquiry-result script')).to_have_count(0)

    def test_failed_and_pending_saves_do_not_duplicate_or_claim_success(self):
        checks = self.page.evaluate('''async () => {
            const {renderInquiry} = await import('./js/extras/inquiry.js');
            const {newProfile} = await import('./js/storage.js');
            const {inquiries} = await import('./content/inquiries.js');
            const activity = inquiries.find(a => a.kind !== 'diary');
            const root = document.createElement('section'); document.body.append(root);
            const owner = newProfile(1, '🦊', '지연 저장 점검');
            const previous = {id:activity.id,at:1,evidence:[],answers:{},checks:[]};
            owner.extras.inquiries[activity.id] = previous;
            let cleanup, calls=0, requestedStorage, pending, succeed;
            const deferred = () => {pending = new Promise(resolve => {succeed=resolve;});};
            deferred();
            const env = {
                profile: () => owner, profileKey: () => 'deferred-inquiry',
                canInquire: () => true, go: () => {},
                onDispose: callback => {cleanup=callback;},
                mount: (...nodes) => root.replaceChildren(...nodes.filter(Boolean)),
                topbar: () => document.createElement('header'),
                persist: requireStorage => {calls++;requestedStorage=requireStorage;return pending;},
            };
            const settle = () => new Promise(resolve => setTimeout(resolve,0));
            let checks=0;
            const check = (value,message) => {if(!value)throw new Error(message);checks++;};
            const render = () => {
                cleanup?.();renderInquiry(env,activity.unit,activity.id);
                for (const input of root.querySelectorAll('textarea')) {
                    input.value='자료의 사실과 나의 생각을 구별해서 적었습니다.';
                    input.dispatchEvent(new Event('input',{bubbles:true}));
                }
                for (const input of root.querySelectorAll('input[type=checkbox]')) {
                    input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
                }
            };
            render();
            let form = root.querySelector('form');
            form.requestSubmit();form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
            check(calls===1 && form.getAttribute('aria-busy')==='true' &&
                [...form.querySelectorAll('input,textarea,button')].every(input=>input.disabled),
                'Pending save must lock input and prevent duplicate submits.');
            check(requestedStorage===true,'Inquiry records require a successful durable storage write.');
            check(!root.querySelector('.inquiry-result'),'Pending save must not show successful results.');
            succeed(false);await settle();
            check(owner.extras.inquiries[activity.id]===previous && !root.querySelector('.inquiry-result'),
                'Failed save must restore the previous record and suppress success.');
            check([...form.querySelectorAll('textarea')].every(input=>!input.disabled && input.value),
                'Failure must preserve editable student answers.');
            deferred();form.requestSubmit();succeed('conflict');await settle();
            check(owner.extras.inquiries[activity.id]===previous && !root.querySelector('.inquiry-result'),
                'A conflict result must not be treated as a successful write.');
            deferred();form.requestSubmit();succeed(true);await settle();
            check(calls===3 && !!root.querySelector('.inquiry-result'),
                'A successful retry must show results exactly once.');
            check(owner.extras.inquiries[activity.id]!==previous,
                'Only a successful storage write may replace the saved inquiry.');
            cleanup?.();root.remove();return checks;
        }''')
        self.assertEqual(checks, 8)

    def test_notebook_preserves_evidence_responses_and_print_output(self):
        self.seed(teacher=True)
        self.open_activity(self.inquiry)
        answers = self.complete(self.inquiry)
        self.page.get_by_role('button', name='📒 나의 역사 노트 보기', exact=True).click()
        result = self.page.locator('.inquiry-result')
        expect(result).to_have_count(1)
        expect(result).to_contain_text(self.inquiry['title'])
        for source in self.inquiry['sources'][:self.inquiry['minEvidence']]:
            expect(result).to_contain_text(source['title'])
        for answer in answers.values():
            expect(result).to_contain_text(answer)
        self.page.emulate_media(media='print')
        expect(result).to_be_visible()
        self.assertNotEqual(result.evaluate('node => getComputedStyle(node).display'), 'none')
        pdf = self.page.pdf(print_background=True)
        self.assertGreater(len(pdf), 1000)
        self.assertTrue(pdf.startswith(b'%PDF'))


if __name__ == '__main__':
    unittest.main()
