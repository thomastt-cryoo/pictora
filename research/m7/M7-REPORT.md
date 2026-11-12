# Pictora M7 — Cross-platform offline browser verification

## Result and product direction

The primary product is one standalone offline HTML application for Windows and macOS. Chrome and Edge passed actual macOS and Windows execution. Safari remains unverified because its WebDriver rejected access to the local file before Pictora loaded. Recommend Chrome or Edge on both operating systems. Prior native desktop work is preserved locally, and the browser customer ZIP contains HTML, instructions and notices.

The repository now contains the source and browser candidate on `main`. Upload used the connected GitHub API because local Git push authentication was unavailable. The remote is a source/test snapshot. All historical commits and full milestone evidence remain in the local repository. The earlier Pages deployment workflow was archived locally and excluded from the remote test snapshot.

## Actual environments

| Environment | Chrome | Edge | Safari |
| --- | --- | --- | --- |
| Windows 11 Home 26300 x64, local | 151.0.7922.72 PASS | 157.0.4341.46 PASS | Not applicable |
| GitHub Windows Server 2025 runner, x64 | 157.0.8103.79 PASS | 157.0.4341.46 PASS | Not applicable |
| GitHub macOS 15.8.2, build 24H232, Apple Silicon ARM64 | 157.0.8103.79 PASS | 157.0.4341.46 PASS | 27.2 UNVERIFIED |

The macOS jobs executed on real Apple-architecture macOS VMs. Chrome and Edge screenshots come from those browsers running headlessly on macOS. Safari used the installed browser with Apple's driver. [Completed Actions run](https://github.com/thomastt-cryoo/pictora/actions/runs/43128190105), [Mac runner identity](ci/macos/logs/runner.txt), [Safari investigation](SAFARI-INVESTIGATION.md).

## Offline launch and worker

Each Chrome/Edge cold-launch check copied the HTML alone into a temporary folder, created an empty disk profile, and set the browser context offline before file navigation. The browser sandbox stayed enabled. No application HTTP server or external asset was used. The complete browser was closed and reopened offline to check another photograph and stored theme.

The actual Blob worker ran OffscreenCanvas and ImageBitmap probes and converted the portrait. Settings checks recorded detached ImageBitmap transfers and progress responses. Automatic and paint-photo palette generation and segmentation ran through the original worker. The candidate HTML is byte-identical to M5, with the original processing engine intact. [Mac cold launch](ci/macos/logs/cold-launch.json), [Windows cold launch](ci/windows/logs/cold-launch.json), [preservation](logs/preservation.json).

Offline control was scoped to browser application traffic. The Actions runner retained its control connection for setup and artifact upload. Safari's job does not claim offline launch.

## Features and settings

Chrome and Edge each passed 14 workflows on both CI operating systems, totaling 56 workflow checks. The local Windows browsers also passed 28 workflows. Coverage includes image input and replacement, all palette modes, manual edits/add/remove, numbering and key, smoothing, color count, stale-result ownership, invalid-file recovery and controlled worker errors, themes, preview views, narrow layouts, keyboard focus, safe color strings and untrusted SVG handling, and real SVG/PNG downloads.

The focused settings check used a six-color portrait, smoothing 70, minimum shape size 160, 700-pixel detail and 8-way connectivity. Its model SHA-256 matched the approved M5 record on both Mac browsers. Zoom, fit, styled/filled PNG, system theme and the HTML drop handler passed. The drag test injects a DataTransfer into the application handler. A physical Finder-to-window drag gesture was not performed. High-detail 1400 was not separately repeated on macOS. [Mac workflow logs](ci/macos/logs/workflows-chrome.json), [Mac Edge workflows](ci/macos/logs/workflows-edge.json), [Mac settings](ci/macos/logs/settings.json), [Windows CI settings](ci/windows/logs/settings.json).

## Exports and parity

Actual Mac browser downloads were saved and inspected. Names followed the active source, including replacement and pending-work cases. The portrait default PNG was 1600 × 2000 pixels. Reduced and styled exports retained their configured dimensions.

The Mac comparison inspected 34 M5 reference exports. All 22 SVGs were exact. The 12 PNGs had matching dimensions with pixel differences from Windows rasterization. The inspected crop shows matching vector geometry with raster edge differences. Across Mac Chrome and Edge, all seven corresponding PNG pairs, including the filled/styled output, had identical decoded RGBA. Alpha differences in the recorded Windows/Mac PNG comparisons were zero. No pixel equality across operating systems is claimed. [Mac export metrics](ci/macos/logs/export-comparisons.json), [Mac Chrome/Edge equality](logs/mac-chrome-edge-png.json), [visual comparison](screenshots/png-platform-comparison.png).

Local Windows comparisons inspected 34 exports with exact output. Windows CI comparison metrics are retained independently. Mac screenshots and raw exported files are saved under `ci/macos/`.

## Safari and storage limits

Safari WebDriver opened an error page stating that the local resource was outside its sandbox. The application did not load, so that run establishes neither Safari worker nor download compatibility. No browser security setting was bypassed to force access. Safari's automation-local-file limitation and relevant WebKit Blob-origin issues are documented separately. The verified recommendation is Chrome or Edge on macOS.

Chrome and Edge retained the explicit dark theme when the same profile reopened the same file. Moving the HTML, clearing browser data, using private mode or browser storage policies can affect file-origin storage.

## Performance and memory observations

Local Windows portrait conversion in the focused drop/settings sample took 2.15 s in Chrome and 3.50 s in Edge, with sampled aggregate working sets of 867 MiB and 943 MiB. Mac portrait conversion took 1.70 s in Chrome and 1.79 s in Edge. These are single functional-test observations with instrumentation and ordinary runner variability, not controlled cross-machine benchmarks.

The Mac settings record includes browser process counts and worker/transfer progress. A process RSS snapshot was taken at job end, after browser closure, and cannot establish peak image-processing memory. No maximum-PNG memory claim is made for macOS. [Local observations](logs/settings.json), [Mac observations](ci/macos/logs/settings.json), [runner process snapshot](ci/macos/logs/process-memory.txt).

## Packaging, preservation and issues

`release/candidates/m7-browser/Pictora-Browser-Offline.zip` contains exactly `Pictora.html`, `README.txt` and `THIRD-PARTY-NOTICES.txt`. All application functionality is in the HTML. The ZIP excludes native desktop binaries. Exact sizes and SHA-256 values are recorded in [ARTIFACTS.json](ARTIFACTS.json).

M5 browser files, golden evidence and M1–M6 artifacts were preserved. No application source changed. An initial Actions attempt failed while saving logs because the clean checkout lacked evidence directories. The workflow was corrected, earlier runs were cancelled, and the final Windows and macOS jobs completed successfully. Safari's JSON status remains explicitly unverified despite its diagnostic job completing successfully.

## Screenshots and acceptance

[Mac Chrome cold launch](ci/macos/screenshots/chrome-cold-file-dark.png), [Mac Edge cold launch](ci/macos/screenshots/edge-cold-file-dark.png), [Mac settings](ci/macos/screenshots/chrome-settings.png), [Safari error](ci/safari/screenshots/safari-investigation-failure.png).

The Chrome/Edge cross-platform browser target is verified for the listed systems. Safari and physical OS drag gestures remain unverified. M7 produces a review candidate and browser recommendations. The project is ready for supervisor review before M8.
