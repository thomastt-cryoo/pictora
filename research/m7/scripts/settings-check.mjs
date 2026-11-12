import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {launch, fresh, ready, open, range, download, snapshot, root, assert, hash} from './browser-common.mjs';

const records = [];
for (const name of ['chrome', 'edge']) {
  const {browser, context, page, errors, external} = await launch(name);
  try {
    await fresh(page);
    const bytes = [...readFileSync('research/m4/fixtures/portrait.jpg')];
    const dataTransfer = await page.evaluateHandle(bytes => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], 'portrait.jpg', {type: 'image/jpeg'}));
      return transfer;
    }, bytes);
    const started = performance.now();
    await page.locator('.upload-target').first().dispatchEvent('drop', {dataTransfer});
    await dataTransfer.dispose();
    await ready(page);
    const conversionMs = performance.now() - started;
    await open(page, 'Region generation');
    await range(page, 'Number of colors', 6);
    await range(page, 'Smoothing / complexity', 70);
    await range(page, 'Min shape size', 160);
    await page.getByLabel('Detail resolution').selectOption('700');
    await page.getByRole('button', {name: '8-way', exact: true}).click();
    await ready(page);
    const state = await snapshot(page);
    const expected = JSON.parse(readFileSync('research/m5/logs/quality-chrome.json')).results.find(r => r.id === 'portrait-reduced');
    assert(hash(JSON.stringify(state.model)) === expected.modelSha256, 'Reduced settings model mismatch');
    await download(page, name, 'SVG', 'portrait-reduced.svg');
    assert(hash(readFileSync(join(root, 'outputs', name, 'portrait-reduced.svg'))) === expected.svgSha256, 'Reduced SVG mismatch');
    const before = await page.getByRole('status', {name: 'Preview scale'}).innerText();
    await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
    const after = await page.getByRole('status', {name: 'Preview scale'}).innerText();
    assert(before !== after, 'Zoom did not change');
    await page.getByRole('button', {name: 'Zoom out', exact: true}).click();
    await page.getByRole('button', {name: 'Fit preview to workspace', exact: true}).click();
    await open(page, 'Output styling');
    await page.getByRole('switch', {name: 'Color preview fill', exact: true}).check();
    await range(page, 'Preview opacity', 100);
    await range(page, 'Label size', 32);
    await range(page, 'Line thickness', 1.5);
    await download(page, name, 'PNG', 'portrait-reduced-styled.png');
    await page.getByLabel('Interface theme').selectOption('system');
    await page.screenshot({path: join(root, 'screenshots', `${name}-settings.png`)});
    const session = await browser.newBrowserCDPSession();
    const processes = await session.send('SystemInfo.getProcessInfo');
    const memory = process.platform === 'win32' && !process.env.CI
      ? JSON.parse(execFileSync('C:/Users/mazin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe', ['research/m5/scripts/process-memory.py', ...processes.processInfo.map(p => String(p.id))]))
      : {processCount: processes.processInfo.length, note: 'Runner native memory is recorded separately.'};
    const resources = await page.evaluate(() => ({transfers: window.__m4.transfers, progress: window.__m4.events.filter(e => e.type === 'progress').length}));
    assert(resources.transfers.some(t => t.before > 0 && t.after === 0), 'ImageBitmap transfer missing');
    assert(!errors.length && !external.length, 'Error or external request');
    records.push({browser: name, version: browser.version(), status: 'PASS', conversionMs, modelSha256: expected.modelSha256, svgSha256: expected.svgSha256, settings: state.request.settings, zoom: {before, after}, memory, resources, errors, external});
    console.log(`PASS ${name} drop event, reduced settings parity, zoom, filled PNG and memory observation`);
  } finally {
    await browser.close();
    writeFileSync(join(root, 'logs/settings.json'), JSON.stringify({method: 'Actual file URL, network disabled before navigation, synthetic HTML DataTransfer drop into the application handler. Process memory is a sample rather than an allocation peak.', records}, null, 2) + '\n');
  }
}
