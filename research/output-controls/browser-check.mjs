import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium, open, range, ready, upload} from '../m7/scripts/browser-common.mjs';

const candidate = resolve('release/candidates/m7-browser-output-controls/Pictora.html');
const previous = resolve('release/candidates/m7-browser/Pictora.html');
const evidence = resolve('.build-tools/output-controls-evidence');
mkdirSync(evidence, {recursive: true});

async function startBrowser(channel) {
  const options = {channel, headless: true, chromiumSandbox: true};
  try {
    return await chromium.launch(options);
  } catch (error) {
    if (!process.env.CI || !error.message.includes('not found')) throw error;
    const cli = resolve(process.env.PICTORA_PLAYWRIGHT_PATH, 'cli.js');
    execFileSync(process.execPath, [cli, 'install', channel], {stdio: 'inherit'});
    return chromium.launch(options);
  }
}

async function exportFile(page, directory, format, name) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: `Export ${format}`, exact: true}).click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  const bytes = readFileSync(await download.path());
  writeFileSync(resolve(directory, name), bytes);
  return bytes;
}

async function countVisibleLayers(page, png) {
  return page.evaluate(async value => {
    const image = new Image();
    image.src = `data:image/png;base64,${value}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const {data} = context.getImageData(0, 0, canvas.width, canvas.height);
    let outlines = 0, numbers = 0, colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [red, green, blue] = [data[i], data[i + 1], data[i + 2]];
      if (red === 255 && green === 0 && blue === 255) outlines++;
      else if (red === 0 && green === 255 && blue === 255) numbers++;
      else if (red !== green || red !== blue) colored++;
    }
    return {outlines, numbers, colored, width: canvas.width, height: canvas.height};
  }, png.toString('base64'));
}

const results = [];
try {
  for (const channel of ['chrome', 'msedge']) {
    const browser = await startBrowser(channel);
    const directory = resolve(evidence, channel);
    mkdirSync(directory, {recursive: true});
    const result = {channel, version: browser.version(), platform: process.platform, combinations: []};
    results.push(result);
    try {
      const context = await browser.newContext({offline: true, acceptDownloads: true, viewport: {width: 1440, height: 1000}, colorScheme: 'light'});
      const page = await context.newPage();
      const errors = [], external = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
      for (const html of [previous, candidate]) {
        await page.goto(pathToFileURL(html).href);
        await upload(page, 'research/m1/fixtures/complex.png');
        await ready(page);
        const svg = await exportFile(page, directory, 'SVG', html === previous ? 'previous-default.svg' : 'new-default.svg');
        if (html === previous) result.defaultSha256 = createHash('sha256').update(svg).digest('hex');
        else assert.equal(createHash('sha256').update(svg).digest('hex'), result.defaultSha256);
      }

      await open(page, 'Output styling');
      const outlines = page.getByRole('switch', {name: 'Show outlines', exact: true});
      const numbers = page.getByRole('switch', {name: 'Show numbers', exact: true});
      assert(await outlines.isChecked() && await numbers.isChecked(), 'Outlines and numbers should start on');
      await page.getByRole('switch', {name: 'Color preview fill', exact: true}).check();
      await range(page, 'Preview opacity', 100);
      await page.getByLabel('Line color', {exact: true}).fill('#ff00ff');
      await range(page, 'Line thickness', 6);
      await page.getByLabel('Label color', {exact: true}).fill('#00ffff');
      await range(page, 'Label size', 32);
      for (const [showOutlines, showNumbers] of [[true, true], [false, true], [false, false], [true, false], [true, true]]) {
        await outlines.setChecked(showOutlines);
        await numbers.setChecked(showNumbers);
        const name = `${showOutlines ? 'outlines' : 'no-outlines'}-${showNumbers ? 'numbers' : 'no-numbers'}`;
        const preview = await page.locator('.preview-artwork > svg').evaluate(svg => svg.outerHTML);
        const svg = (await exportFile(page, directory, 'SVG', `${name}.svg`)).toString('utf8');
        for (const value of [preview, svg]) {
          assert.equal(value.includes('stroke="#ff00ff"'), showOutlines);
          assert.equal(value.includes('<text '), showNumbers);
          assert.match(value, /<path [^>]+fill="#[0-9a-f]{6}"/i);
        }
        const png = await exportFile(page, directory, 'PNG', `${name}.png`);
        const pixels = await countVisibleLayers(page, png);
        assert.equal(pixels.outlines > 0, showOutlines);
        assert.equal(pixels.numbers > 0, showNumbers);
        assert(pixels.colored > 0 && pixels.width === 1600 && pixels.height === 1200);
        result.combinations.push({showOutlines, showNumbers, pixels});
        if (!showOutlines && !showNumbers) await page.screenshot({path: resolve(directory, 'color-only-preview.png')});
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      result.status = 'PASS';
      console.log(`${process.platform} ${channel} ${result.version}: default SVG and all preview/SVG/PNG combinations passed`);
    } finally {
      await browser.close();
    }
  }
} finally {
  writeFileSync(resolve(evidence, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
