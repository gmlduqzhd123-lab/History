"""Protect students' newspaper/letter work during failed saves and navigation.

Uses synthetic profiles and isolated browser contexts; no actual student records.
"""
import os
import re
import shutil
import unittest

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
KEY = 'history-quest:v1'
PROFILE_KEY = 'writing-regression'


class WritingRegressions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = sync_playwright().start()
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        executable = os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium')
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
        self.page.evaluate('''async () => {
            const {newProfile} = await import('./js/storage.js');
            const profile = newProfile(1, '🦊', '신문 점검');
            const other = newProfile(2, '🐻', '다른 학생');
            for (const p of [profile, other]) for (let i=1; i<=10; i++)
                p.quests['q'+i] = {stage:5, done:true, notes:[]};
            profile.extras.writings.u1 = {id:'u1-unify', kind:'news',
                title:'전에 저장한 신문', lines:['이전에 저장한 소중한 글입니다.'], at:1};
            localStorage.setItem('history-quest:v1', JSON.stringify({
                current:'writing-regression',
                profiles:{'writing-regression':profile, 'writing-other':other},
            }));
        }''')
        self.page.reload(wait_until='domcontentloaded')
        self.page.get_by_role('button', name=re.compile('신문 점검')).click()
        # Choosing a student awaits storage before rendering the map. A DOM click
        # alone returns earlier and leaves the app's global save barrier active.
        expect(self.page.locator('.station')).to_have_count(10)

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
        finally:
            self.context.close()

    def saved_writing(self):
        return self.page.evaluate('''() => JSON.parse(localStorage.getItem('history-quest:v1'))
            .profiles['writing-regression'].extras.writings.u1''')

    def open_writing(self, title='속보! 신라, 삼국 통일을 이루다'):
        self.page.get_by_role('button', name='역사 신문 · 편지', exact=False).first.click()
        self.page.locator('.writing-opt').filter(has_text=title).click()

    def fill_and_check(self, values=('당', '백제와 고구려를', '나라를 지킨 노력이 인상적이에요.')):
        for input_, value in zip(self.page.locator('.blank').all(), values):
            input_.fill(value)
        self.page.get_by_role('button', name='✔ 확인하기', exact=True).click()

    def warns_on_unload(self):
        return self.page.evaluate('''() => {
            const event = new Event('beforeunload', {cancelable:true});
            window.dispatchEvent(event);
            return event.defaultPrevented;
        }''')

    def confirm_leave(self):
        expect(self.page.get_by_role('heading', name='아직 글을 저장하지 않았어요')).to_be_visible()
        self.page.get_by_role('button', name='활동 나가기', exact=True).click()

    def test_quota_failure_retains_previous_record_and_draft_until_successful_retry(self):
        previous = self.saved_writing()
        self.open_writing()
        self.fill_and_check()
        self.page.evaluate('''() => {
            window.originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'history-quest:v1') throw new DOMException('Test storage full', 'QuotaExceededError');
                return window.originalSetItem.call(this, key, value);
            };
        }''')
        save = self.page.get_by_role('button', name='💾 저장하고 퀘스트 마치기', exact=True)
        save.click()
        expect(self.page.get_by_text('글을 저장하지 못했어요.', exact=False)).to_be_visible()
        expect(self.page.get_by_text('나의 역사 노트에도 저장했어요.', exact=True)).to_have_count(0)
        self.assertEqual(self.saved_writing(), previous)
        self.assertTrue(self.warns_on_unload())
        expect(self.page.locator('.blank').last).to_have_value('나라를 지킨 노력이 인상적이에요.')
        expect(save).to_be_enabled()

        self.page.get_by_role('button', name='← 고르기', exact=True).click()
        self.confirm_leave()
        expect(self.page.locator('.newspaper')).to_contain_text('이전에 저장한 소중한 글입니다.')
        expect(self.page.locator('.writing-opt').first).to_contain_text('쓰던 내용')
        self.page.locator('.writing-opt').first.click()
        expect(self.page.locator('.blank').last).to_have_value('나라를 지킨 노력이 인상적이에요.')
        self.page.get_by_role('button', name='✔ 확인하기', exact=True).click()
        self.page.evaluate('() => { Storage.prototype.setItem = window.originalSetItem; }')
        self.page.get_by_role('button', name='💾 저장하고 퀘스트 마치기', exact=True).click()
        expect(self.page.get_by_text('나의 역사 노트에도 저장했어요.', exact=True)).to_be_visible()
        self.assertFalse(self.warns_on_unload())
        self.assertIn('나라를 지킨 노력이 인상적이에요.', self.saved_writing()['lines'][-1])
        self.page.reload(wait_until='domcontentloaded')
        self.page.get_by_role('button', name=re.compile('신문 점검')).click()
        self.page.get_by_role('button', name='📒 나의 역사 노트', exact=True).click()
        expect(self.page.locator('.newspaper')).to_contain_text('나라를 지킨 노력이 인상적이에요.')

    def test_failed_first_letter_save_does_not_leave_a_saved_record(self):
        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
        self.page.get_by_role('button', name=re.compile('다른 학생')).click()
        self.open_writing('장보고에게 편지 쓰기')
        self.fill_and_check(('청해진', '바다 도적을 물리치고 무역을 할', '안전한 바다길을 지켜 주셔서 고맙습니다.'))
        self.page.evaluate('''() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'history-quest:v1') throw new DOMException('Test storage full', 'QuotaExceededError');
                return original.call(this, key, value);
            };
        }''')
        self.page.get_by_role('button', name='💾 저장하고 퀘스트 마치기', exact=True).click()
        expect(self.page.get_by_text('글을 저장하지 못했어요.', exact=False)).to_be_visible()
        expect(self.page.get_by_text('나의 역사 노트에도 저장했어요.', exact=True)).to_have_count(0)
        self.assertEqual(self.page.evaluate('''() => JSON.parse(localStorage.getItem('history-quest:v1'))
            .profiles['writing-other'].extras.writings'''), {})
        self.page.get_by_role('button', name='← 고르기', exact=True).click()
        self.confirm_leave()
        expect(self.page.locator('.letter')).to_have_count(0)
        self.page.locator('.writing-opt').filter(has_text='장보고에게 편지 쓰기').click()
        expect(self.page.locator('.blank').last).to_have_value('안전한 바다길을 지켜 주셔서 고맙습니다.')
        self.assertTrue(self.warns_on_unload())

    def test_drafts_are_isolated_by_option_and_student_and_guard_home_navigation(self):
        self.assertFalse(self.warns_on_unload())
        self.open_writing()
        draft = '첫 학생이 쓰던 신문 초안이에요.'
        self.page.locator('.blank').last.fill(draft)
        self.page.get_by_role('button', name='← 고르기', exact=True).click()
        expect(self.page.get_by_role('heading', name='아직 글을 저장하지 않았어요')).to_be_visible()
        self.page.get_by_role('button', name='계속 쓰기', exact=True).click()
        expect(self.page.locator('.blank').last).to_have_value(draft)
        self.page.get_by_role('button', name='← 고르기', exact=True).click()
        self.confirm_leave()
        self.page.locator('.writing-opt').filter(has_text='장보고에게 편지 쓰기').click()
        expect(self.page.locator('.blank').last).to_have_value('')
        self.page.locator('.blank').last.fill('장보고님께 쓰던 편지 초안이에요.')
        self.page.get_by_role('button', name='홈으로', exact=True).click()
        self.confirm_leave()
        self.assertTrue(self.warns_on_unload(), 'Home must keep drafts protected from reload/close.')
        self.page.get_by_role('button', name=re.compile('신문 점검')).click()
        self.open_writing()
        expect(self.page.locator('.blank').last).to_have_value(draft)

        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
        expect(self.page.get_by_role('heading', name='아직 글을 저장하지 않았어요')).to_be_visible()
        self.page.get_by_role('button', name='계속 쓰기', exact=True).click()
        expect(self.page.locator('.blank').last).to_have_value(draft)
        # Cancelling student change must not clear the current owner behind the editor.
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('history-quest:v1')).current"), PROFILE_KEY)
        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
        self.confirm_leave()
        self.page.get_by_role('button', name=re.compile('다른 학생')).click()
        self.open_writing()
        expect(self.page.locator('.blank').last).to_have_value('')
        self.page.get_by_role('button', name='탐험가 메뉴', exact=True).click()
        self.page.get_by_role('button', name='🔄 다른 탐험가로 바꾸기', exact=True).click()
        self.page.get_by_role('button', name=re.compile('신문 점검')).click()
        self.open_writing()
        expect(self.page.locator('.blank').last).to_have_value(draft)

    def test_pending_failed_and_conflicting_saves_do_not_claim_success_or_duplicate(self):
        checks = self.page.evaluate('''async () => {
            const {renderWriting} = await import('./js/extras/writing.js');
            const {newProfile} = await import('./js/storage.js');
            const {h} = await import('./js/dom.js');
            const owner = newProfile(17, '🐼', '저장 점검');
            const previous = {id:'u1-unify', kind:'news', title:'저장된 글', lines:['이전 기록'], at:1};
            owner.extras.writings.u1=previous;
            const root=document.createElement('div');document.body.append(root);
            let cleanup, calls=0, requestedStorage, resolveSave, rejectSave;
            let pending=new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});
            const env={
                mount:(...nodes)=>root.replaceChildren(...nodes),
                topbar:()=>h('div'), go:()=>{}, profile:()=>owner,
                profileKey:()=> 'writing-deferred', unitTitle:()=> '단원', author:()=> '17번 저장 점검',
                onDispose:fn=>{cleanup=fn;},
                persist:required=>{calls++;requestedStorage=required;return pending;},
            };
            renderWriting(env, 'u1', 'u1-unify');
            const inputs=[...root.querySelectorAll('.blank')];
            ['당','백제와 고구려를','저장할 글이에요.'].forEach((value,index)=>{
                inputs[index].value=value;inputs[index].dispatchEvent(new Event('input'));
            });
            const checkButton=[...root.querySelectorAll('button')].find(b=>b.textContent==='✔ 확인하기');
            if (!checkButton) throw new Error('Writing editor must contain its validation button.');
            checkButton.click();
            const save=[...root.querySelectorAll('button')].find(b=>b.textContent.includes('저장하고'));
            if (!save) throw new Error('Valid writing must expose a save button before testing deferred storage.');
            let checks=0;
            const check=(ok,message)=>{if(!ok)throw new Error(message);checks++;};
            const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
            const success=()=>root.textContent.includes('나의 역사 노트에도 저장했어요.');
            save.click();save.click();await settle();
            check(calls===1 && requestedStorage===true && !success(),
                'Pending save must require durable storage and run exactly once without success.');
            check(inputs.every(i=>i.disabled), 'Pending save must lock controls.');
            resolveSave(false);await settle();
            check(owner.extras.writings.u1===previous && !success(),
                'A failed write must restore the previous writing and suppress success.');
            check(inputs.every(i=>!i.disabled && i.value) && !save.disabled,
                'Failed write must keep answers and enable retry.');
            pending=new Promise(resolve=>{resolveSave=resolve;});
            save.click();await settle();resolveSave('conflict');await settle();
            check(owner.extras.writings.u1===previous && !success(),
                'A conflict result must not count as a successful write.');
            pending=new Promise((resolve,reject)=>{rejectSave=reject;});
            save.click();await settle();rejectSave(new Error('Test rejection'));await settle();
            check(owner.extras.writings.u1===previous && !success(),
                'A rejected write must also preserve the previous record.');
            pending=new Promise(resolve=>{resolveSave=resolve;});
            save.click();await settle();resolveSave(true);await settle();
            check(calls===4 && success() && owner.extras.writings.u1!==previous,
                'Only a successful retry may replace the record and show success.');
            cleanup?.();root.remove();return checks;
        }''')
        self.assertEqual(checks, 7)

    def test_discard_drafts_targets_exact_student_identity(self):
        checks = self.page.evaluate('''async () => {
            const {renderWriting, discardWritingDrafts} = await import('./js/extras/writing.js');
            const {newProfile} = await import('./js/storage.js');
            const {h} = await import('./js/dom.js');
            const root=document.createElement('div');document.body.append(root);
            const first=newProfile(3, '🦊', '같은 번호 첫 학생');first.createdAt=101;
            const second=newProfile(3, '🐻', '같은 번호 다른 학생');second.createdAt=102;
            let owner=first, key='draft-first', cleanup;
            const env={mount:(...nodes)=>root.replaceChildren(...nodes), topbar:()=>h('div'),
                go:()=>{}, profile:()=>owner, profileKey:()=>key, author:()=>owner.name,
                unitTitle:()=> '단원', persist:()=>true, onDispose:fn=>{cleanup=fn;}};
            const render=()=>{cleanup?.();renderWriting(env,'u1','u1-unify');};
            const input=()=>root.querySelectorAll('.blank')[2];
            const write=text=>{input().value=text;input().dispatchEvent(new Event('input'));};
            const warns=()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;};
            let checks=0;
            const check=(ok,message)=>{if(!ok)throw new Error(message);checks++;};
            render();write('첫 학생의 초안이에요.');
            owner=second;key='draft-second';render();write('다른 학생의 초안이에요.');
            discardWritingDrafts('draft-first',{...first,createdAt:999});
            owner=first;key='draft-first';render();
            check(input().value==='첫 학생의 초안이에요.',
                'A recreated profile with the same key must not erase an older student draft.');
            discardWritingDrafts(key,owner);
            owner=second;key='draft-second';render();
            check(input().value==='다른 학생의 초안이에요.' && warns(),
                'Deleting one student draft must preserve another student with the same number.');
            owner=first;key='draft-first';render();
            check(input().value==='', 'A discarded student draft must not reappear in the editor.');
            discardWritingDrafts('draft-second',second);
            check(!warns(), 'Discarding the last draft must also remove its close/reload warning.');
            cleanup?.();root.remove();return checks;
        }''')
        self.assertEqual(checks, 4)


if __name__ == '__main__':
    unittest.main()
