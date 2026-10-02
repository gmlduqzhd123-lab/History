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
python3 tests/map-regressions.py -v
python3 tests/browser-ui.py -v
python3 tests/activity-save.py -v
python3 tests/extras-flow.py -v
python3 tests/full-flow.py
```

- Storage checks protect against stale profile writes, deleted-record resurrection,
  same-number identity confusion, rename collisions and lost mastery status. They
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
- Map checks click real dot centers on mobile/desktop and require correct 5/5 scoring.
- UI checks cover keyboard focus, nested dialogs, narrow screens, concealed accessible
  labels, failed-photo fallback and cancellation of previous narration.
- Activity save checks defer completion callbacks to verify that save results are
  awaited, conflicts stop completion and repeated clicks cannot duplicate saves.
- Extra activity checks verify saved review results, timeline improvements, person
  cards and a newspaper retained in the notebook after reloading.
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
