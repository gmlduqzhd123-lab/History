"""Complete all 10 quests through the real UI. PWA is checked separately."""
import json
import re
import os
import shutil
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.environ.get('HISTORY_TEST_OUTPUT') or tempfile.mkdtemp(prefix='history-full-flow-'))
BASE = os.environ.get('HISTORY_TEST_BASE_URL', 'http://localhost:8000/')
OUT.mkdir(parents=True, exist_ok=True)
result = {'quests': [], 'errors': []}


def plain(value):
    return value.replace('**', '')


def choice(page, text):
    page.locator('button.choice:enabled').filter(has_text=text).click()


with sync_playwright() as runner:
    browser = runner.chromium.launch(executable_path=os.environ.get('HISTORY_TEST_BROWSER') or shutil.which('chromium') or runner.chromium.executable_path, headless=True,
                                    args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(locale='ko-KR', viewport={'width': 1024, 'height': 768}, service_workers='block')
    page = context.new_page()
    page.set_default_timeout(10000)
    page.on('pageerror', lambda error: result['errors'].append(str(error)))
    page.goto(BASE, wait_until='domcontentloaded')
    quests = page.evaluate("async () => (await import('./content/quests.js')).stations.map(s => s.quest)")
    page.get_by_role('button', name='🙋 새 탐험가로 시작하기', exact=True).click()
    page.get_by_label('이름', exact=True).fill('전체검증')
    page.locator('.num-grid').get_by_role('button', name='1', exact=True).click()
    page.get_by_role('button', name='🚀 탐험 시작!', exact=True).click()
    page.get_by_role('button', name='알겠어요!', exact=True).click()
    for index, quest in enumerate(quests):
        print(f'START: {quest["id"]} {quest["title"]}', flush=True)
        page.locator('.station.open').first.click()
        for stage in quest['stages']:
            expect(page.locator('.stage-head h2')).to_have_text(stage['title'])
            kind = stage['type']
            if kind == 'detective':
                for i, artifact in enumerate(stage['artifacts']):
                    for field in ('useQ', 'eraQ'):
                        answer = next(c['t'] for c in artifact[field]['choices'] if c.get('correct') or c.get('good'))
                        choice(page, answer)
                    label = '다음 유물 조사하기 ▶' if i < len(stage['artifacts']) - 1 else f'{stage["title"]} 완료! 다음 단계로 ▶'
                    page.get_by_role('button', name=label, exact=True).click()
            elif kind == 'reading':
                for i, card in enumerate(stage['cards']):
                    expect(page.get_by_role('heading', name=card['title'], exact=True)).to_be_visible()
                    page.get_by_role('button', name='✔ 다 읽었어요', exact=True).click()
                    choice(page, next(c['t'] for c in card['check']['choices'] if c.get('correct') or c.get('good')))
                    label = '다음 카드 ▶' if i < len(stage['cards']) - 1 else f'{stage["title"]} 완료! 다음 단계로 ▶'
                    page.get_by_role('button', name=label, exact=True).click()
            elif kind == 'adventure':
                page.get_by_role('button', name='이야기 시작하기 ▶', exact=True).click()
                for i, scene in enumerate(stage['steps']):
                    choice(page, next(c['t'] for c in scene['choices'] if c.get('good') or c.get('correct')))
                    label = '다음 장면 ▶' if i < len(stage['steps']) - 1 else '이야기 마무리 ▶'
                    page.get_by_role('button', name=label, exact=True).click()
                page.get_by_role('button', name=f'{stage["title"]} 완료! 다음 단계로 ▶', exact=True).click()
            elif kind == 'mastery':
                count = 0
                while not page.locator('.score-big').count():
                    question_text = page.locator('#app .card h3').first.inner_text()
                    question = next(q for q in stage['questions'] if plain(q['q']) == question_text)
                    if question['type'] == 'sort':
                        rows = page.locator('.sort-item')
                        for j in range(rows.count()):
                            row = rows.nth(j)
                            text = row.locator('.label').inner_text()
                            item = next(x for x in question['items'] if x['t'] == text)
                            row.get_by_role('button', name=question['buckets'][item['b']], exact=True).click()
                        page.get_by_role('button', name='확인하기', exact=True).click()
                    elif question['type'] == 'ox':
                        page.get_by_role('button', name='⭕ 맞아요' if question['answer'] else '❌ 틀려요', exact=True).click()
                    else:
                        choice(page, question['choices'][question['answer']])
                    next_button = page.get_by_role('button', name=re.compile('^(다음 문제|결과 보기) ▶$'))
                    final_question = next_button.inner_text() == '결과 보기 ▶'
                    next_button.click()
                    if final_question:
                        expect(page.locator('.score-big')).to_be_visible()
                    count += 1
                    assert count <= 20
                expect(page.locator('.score-big')).to_have_text(f'{stage["pick"]} / {stage["pick"]}')
                page.get_by_role('button', name='다음 단계로 ▶', exact=True).click()
            elif kind == 'summary':
                fields = [part for frame in stage['frames'] for part in frame['parts'] if isinstance(part, dict)]
                inputs = page.locator('input.blank')
                assert inputs.count() == len(fields)
                for i, spec in enumerate(fields):
                    answer = '배운 역사를 더 알아보고 싶어요' if spec.get('free') else (
                        ' '.join(group[0] for group in spec['keywordGroups']) if spec.get('keywordGroups') else
                        ' '.join(spec['keywords']) if spec.get('keywordMode') == 'all' else spec['keywords'][0]
                    )
                    inputs.nth(i).fill(answer)
                page.get_by_role('button', name='✔ 확인하기', exact=True).click()
                page.get_by_role('button', name='💾 저장하고 퀘스트 마치기', exact=True).click()
            else:
                raise AssertionError(kind)
        expect(page.locator('.stage-head')).to_have_count(0)
        profile = page.evaluate("() => { const data = JSON.parse(localStorage.getItem('history-quest:v1')); return data.profiles[data.current]; }")
        record = profile['quests'][quest['id']]
        assert record['stage'] == 5 and record['done'] and record['mastery']['passed'], record
        assert len(record['notes']) == len(quest['stages'][-1]['frames'])
        page.get_by_role('button', name='🗺️ 지도로 돌아가기', exact=True).click()
        expect(page.locator('.station.done')).to_have_count(index + 1)
        expect(page.locator('.station.open')).to_have_count(1 if index < 9 else 0)
        result['quests'].append({'id': quest['id'], 'done': True, 'mastery': record['mastery'], 'notes': len(record['notes'])})
        print(f'PASS: {quest["id"]} all five stages, grade, notes, next quest unlocking', flush=True)
    page.get_by_role('button', name='📒 나의 역사 노트', exact=True).click()
    metrics = page.locator('.progress-summary b').all_text_contents()
    assert metrics[:2] == ['10 / 10', '10 / 10'], metrics
    result['notebook_metrics'] = metrics
    page.emulate_media(media='print')
    page.pdf(path=str(OUT / 'history-notebook.pdf'), format='A4')
    result['pdf_bytes'] = (OUT / 'history-notebook.pdf').stat().st_size
    page.emulate_media(media='screen')
    assert not result['errors'], result['errors']
    (OUT / 'full-flow-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'full-profile.json').write_text(json.dumps(profile, ensure_ascii=False, indent=2) + '\n')
    print('PASS: all10 notebook metrics and PDF generation; no JavaScript runtime errors', flush=True)
    print(f'Results and notebook PDF: {OUT}', flush=True)
    browser.close()
