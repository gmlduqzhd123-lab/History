The app remains a static site: no production package installation or build is required.
Run the following regression checks with Node 22.7+ and Python 3.10+.

In the managed cloud environment, Node, Python Playwright and Chromium are already
installed. On another development machine, prepare the browser test dependencies:

```sh
npm install --no-save --no-package-lock playwright@1.62.0
python3 -m pip install playwright==1.62.0
python3 -m playwright install chromium
```

From the repository root, start a static server in a separate terminal:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Run all checks from the repository root:

```sh
node --test tests/storage.test.mjs tests/grading.test.mjs tests/pwa.test.cjs
python3 tests/storage_browser.py -v
python3 tests/rename-regressions.py -v
python3 tests/delete-save-race.py -v
python3 tests/map-regressions.py -v
python3 tests/browser-ui.py -v
python3 tests/accessibility-navigation.py -v
python3 tests/landing-page.py -v
python3 tests/guide-video.py -v
python3 tests/guide-video-offline.py -v
python3 tests/activity-save.py -v
python3 tests/activity-navigation.py -v
python3 tests/extras-flow.py -v
python3 tests/writing-regressions.py -v
python3 tests/writing-print.py -v
python3 tests/draft-deletion.py -v
python3 tests/inquiry-flow.py -v
python3 tests/inquiry-print.py -v
python3 tests/inquiry-offline.py -v
python3 tests/offline-readiness.py -v
python3 tests/full-flow.py
```

- Storage checks protect against stale profile writes, deleted-record resurrection,
  same-number identity confusion, rename collisions and lost mastery status. They
  recover damaged stage/map/writing records without dropping valid classmates'
  work and require repaired maps to retain subsequent saves after reloading. They
  also cover queued changes/reversions and preserve in-memory learning when browser
  storage or coordination is unavailable. Browser barrier tests pause one tab
  between reading and writing while another tab requests a save, requiring atomic
  cross-tab merging or an explicit same-student conflict. These two tests create
  their own temporary origin; run them alone with:

  ```sh
  python3 tests/storage_browser.py AtomicStorageBrowserTests -v
  ```

  Saves await a single IndexedDB readwrite transaction mutex in every browser,
  including iOS 14; student records remain in the existing localStorage v1 format.
  If coordination is unavailable, the app continues in memory and warns the user
  to retain their resume code rather than writing without a lock.
- Grading checks validate normal examples, word banks, Korean particles and synonyms,
  and reject unrelated words or answers missing required facts.
- Rename regressions require failed storage to retain the previous name, keep a
  retry available, and preserve learning records after a successful rename/reload.
- Map checks click real dot centers on mobile/desktop and require correct 5/5 scoring.
- UI checks cover keyboard focus, nested dialogs, narrow screens, concealed accessible
  labels, failed-photo fallback and cancellation of previous narration.
- Navigation accessibility checks cover heading focus, arrow-key tab selection,
  avatar selection state, and preserved place-selection and modal focus.
- Guide-video checks exercise the actual MP4's keyboard play/pause, seeking and
  Korean captions. They keep first-visit downloads user initiated, verify the
  written instructions and narrow-screen layout, and retry after a network error.
  The seek check starts an isolated HTTP origin supporting byte ranges, as Pages
  does; Python's standard static server cannot expose native seekable ranges.
- Activity navigation checks require keyboard focus to move to each new reading
  card, concept question, review item, map question and activity result.
- Activity save checks defer completion callbacks to verify that save results are
  awaited, conflicts stop completion and repeated clicks cannot duplicate saves.
- Extra activity checks verify saved review results, timeline improvements, person
  cards and a newspaper retained in the notebook after reloading.
- Writing regressions cover failed, pending and conflicting saves, safe retries,
  preservation of previous work, and separate drafts across activities and students.
- Draft deletion checks require successful deletion to remove that student's writing
  and inquiry drafts, while failed deletion and other students' drafts remain safe.
- Delete-save race checks pause a deletion while another tab changes a classmate's
  record, then fail its save. The active student and menu must recover without
  overwriting the classmate's update or reporting a successful deletion.
- Inquiry checks exercise source selection, historical diaries, self-checks,
  separate saved responses, editing after reloading, safe text rendering, failed
  and concurrent save guards, locked activities and narrow screens. The offline
  smoke check uses the actual app and service worker, including the inquiry assets.
- Individual inquiry/diary PDF checks require Poppler's `pdftotext` and verify student
  name, number and activity title in the actual printed document. Without Poppler,
  the runner explicitly reports this check as skipped.
- Standalone newspaper/letter PDF checks also use Poppler and require the student
  author, title/recipient and written text, while excluding screen buttons and save
  confirmations from the printed work.
- Offline readiness checks interrupt a required asset and worker registration on
  fresh origins, then require a visible retry, successful preparation and an actual
  offline reload. They also remove mandatory files from an active cache, require
  an honest status and complete repair, and preserve version coherence while a
  newer snapshot waits for older tabs to close. No student records are used.
- The full flow completes all 50 stages, verifies unlocking/saved notes and creates a
  notebook PDF. Results go to a temporary directory printed by the runner; set
  `HISTORY_TEST_OUTPUT` to choose another output directory.
- [PWA.md](PWA.md) describes the isolated versioned-cache update tests and lifecycle.

The Python UI tests default to `http://localhost:8000/`; `HISTORY_TEST_BASE_URL` can
override it. They detect a system Chromium or use Playwright's installed browser;
set `HISTORY_TEST_BROWSER` to override the executable. The Node PWA tests create
their own temporary origins and support `HISTORY_TEST_CHROMIUM` for the executable.
UI contexts disable service workers to check the current source directly; the PWA
suite separately exercises the actual workers, offline use and interrupted updates.

Narration tests inspect a controlled speech queue; physical voices and actual
iPad/Safari devices still need device testing. Test profiles are synthetic and
browser contexts are isolated from actual student records.
