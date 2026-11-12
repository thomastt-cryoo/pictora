# Safari investigation

The Actions workflow runs the installed Safari browser through Apple's `safaridriver` on a real macOS runner. It captures the launch screen, attempts a photo upload and actual worker conversion, and observes SVG/PNG files in Safari's Downloads directory. The JSON record preserves failures and browser capabilities. Completion of the CI job alone does not establish browser support.

Safari's WebDriver does not provide Chromium's per-context offline control. The current Safari investigation therefore records offline cold launch as unverified, even if the photo and downloads succeed. Remote automation is enabled only on the disposable QA runner. Customers open the file normally.

WebKit announced OffscreenCanvas 2D support in Safari 16.4. API availability alone does not establish support for this local-file workflow. [WebKit release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/).

WebKit bug 258443 describes Blob reads and module imports failing in workers with opaque origins, including workers from file URLs. The report is relevant to investigating local-file restrictions, but it does not demonstrate a Pictora failure. Pictora uses a classic self-contained worker, transfers an already-created ImageBitmap and reads it with OffscreenCanvas. Its worker does not import another Blob module or decode a photo Blob itself. [WebKit bug 258443](https://bugs.webkit.org/show_bug.cgi?id=258443).

Bug 329354 concerns revoking a worker Blob URL before worker initialization. A fix landed in WebKit main on November 5, 2026. That landing does not establish which installed Safari release contains the fix. Pictora's actual local-file startup and Retry behavior still require observation on the tested Safari version. [WebKit bug 329354](https://bugs.webkit.org/show_bug.cgi?id=329354).

Actual result on macOS 15.8.2 ARM64 with Safari 27.2: Safari WebDriver rejected the local file before the application loaded. Its screenshot reads “Ignoring request to load this main resource because it is outside the sandbox.” The run retained the screenshot and capabilities. No conversion or download was verified in Safari. This is a WebDriver local-file access limitation, so it does not establish that a customer opening the file normally will encounter the same error. Safari remains unverified and is excluded from the supported-browser recommendation. Chrome and Edge passed on the same macOS runner image.

No numerical algorithm or main-thread processing fallback was introduced. [Actual Safari record](ci/safari/logs/safari.json), [sandbox failure screenshot](ci/safari/screenshots/safari-investigation-failure.png).
