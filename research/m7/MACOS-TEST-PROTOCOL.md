# macOS acceptance protocol

Use the extracted M7 candidate ZIP on a real Mac. Record macOS version, CPU architecture, installed browser version and the HTML SHA-256. Test Chrome first, then Edge and Safari. Each browser must use its own fresh profile. Keep the HTML alone in the test folder.

1. Disable application networking before opening the browser. For Chrome and Edge, the automated context starts offline before navigating to `file://`. This blocks browser traffic without affecting the runner's control connection or artifact upload.
2. Open the local HTML. Confirm the actual worker initializes and can read an OffscreenCanvas and create an ImageBitmap. Convert a JPEG and PNG, observe progress and inspect the template.
3. Exercise automatic, paint-photo and manual palettes. Edit/add/remove colors and verify the color key numbers. Change color count, smoothing, minimum shape size, detail resolution and connectivity. Compare model/SVG results to M5 where instrumented.
4. Exercise Original/Template, zoom, fit, system/light/dark themes, sidebar, responsive layout and keyboard focus. Replace image A with B during processing and verify exports belong to B.
5. Save SVG and PNG through the real browser download path. Inspect file names, SVG structure and output dimensions. Compare decoded PNG pixels and retain difference metrics if macOS rasterization differs.
6. Test invalid-file recovery and worker Retry. Close the complete browser, reopen offline, convert another photo and verify theme persistence where storage allows it.
7. Capture screenshots from the real Mac browser and retain original exported files, timings and memory observations. A Windows WebKit emulation cannot satisfy these steps.

The CI workflow covers automated file input and DOM drop-event handling. A physical Finder-to-browser drag remains a manual check. Safari's offline control and download behavior require explicit verification, and automation limitations must be reported separately from application failures.
