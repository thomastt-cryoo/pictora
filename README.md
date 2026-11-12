# Pictora

Pictora converts photos into printable paint-by-numbers templates. The primary product is one standalone offline browser application for Windows and macOS.

## Open the browser candidate

Download the ZIP from `release/candidates/m7-browser`, extract it, then open `Pictora.html` in Chrome or Edge. All application functionality is inside the HTML. Photos are processed locally.

## Compatibility

Windows Chrome and Edge have passed local offline launch, feature and output checks. Real macOS Chrome, Edge and Safari verification is in progress through the M7 GitHub Actions workflow. Mac compatibility is pending those results.

## Development

Run `npm ci` and `npm run dev` for web development. `npm run build` builds the normal web application. The approved M5 standalone HTML and local milestone evidence are preserved separately. Earlier Tauri work is retained as development history and excluded from the browser customer ZIP.

The M7 workflow saves browser screenshots, logs and generated files as Actions artifacts. It performs verification only.
