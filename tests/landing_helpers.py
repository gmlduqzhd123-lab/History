"""첫 화면에서 탐험가를 고르는 공통 도우미.

마지막으로 탐험한 학생은 이어가기 카드로, 나머지 학생은 이름 단추로 보인다.
"""
from playwright.sync_api import expect


def explorer(page, name):
    """이름에 맞는 이어가기 카드 단추나 이름 단추를 돌려준다."""
    expect(page.locator('#landing-title')).to_be_visible()
    resume = page.locator('.landing-resume').filter(has_text=name)
    if resume.count():
        return resume.get_by_role('button', name='이어서 탐험하기', exact=True)
    return page.locator('.explorer-list button').filter(has_text=name)


def choose_explorer(page, name):
    explorer(page, name).click()
