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

async function checkRegionColor(page, directory) {
  await page.reload();
  await upload(page, 'research/m1/fixtures/checkerboard.png');
  await range(page, 'Number of colors', 2);
  await open(page, 'Region generation');
  await range(page, 'Smoothing / complexity', 0);
  await range(page, 'Min shape size', 0);
  await ready(page);

  const template = page.locator('.preview-artwork > svg');
  async function clickRegion(x, y) {
    const point = await template.evaluate((svg, [x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
      return {x: point.x, y: point.y};
    }, [x, y]);
    await page.mouse.click(point.x, point.y);
  }

  await clickRegion(2, 2);
  const picker = page.getByLabel('Custom region color');
  const palette = page.getByRole('combobox', {name: 'Region color'});
  const before = await picker.inputValue();
  assert.equal(before, '#141414', 'The clicked region should be selectable with color fill off');
  await page.getByRole('button', {name: 'Show color fill', exact: true}).click();
  await open(page, 'Output styling');
  await range(page, 'Preview opacity', 100);
  const baseline = await exportFile(page, directory, 'SVG', 'region-original.svg');
  const basePng = await exportFile(page, directory, 'PNG', 'region-original.png');

  const paletteIndex = await palette.inputValue();
  await palette.selectOption({index: 1 - Number(paletteIndex)});
  assert.equal(await picker.inputValue(), '#f0f0f0');
  await clickRegion(10, 2);
  assert.equal(await picker.inputValue(), before, 'A disconnected region of the same paint should retain its color');
  await clickRegion(2, 2);
  assert.equal(await picker.inputValue(), '#f0f0f0');
  await picker.fill('#000000');
  assert.equal(await picker.inputValue(), '#000000');

  const svg = await exportFile(page, directory, 'SVG', 'region-custom.svg');
  const png = await exportFile(page, directory, 'PNG', 'region-custom.png');
  const success = await page.evaluate(([before, after]) => {
    const parse = (value) => new DOMParser().parseFromString(value, 'image/svg+xml').documentElement;
    const fills = (root) => [...root.querySelectorAll('g[opacity] > path')].map((p) => [p.getAttribute('d'), p.getAttribute('fill')]);
    const labels = (root) => [...root.querySelectorAll('text')].map((t) => [t.getAttribute('x'), t.getAttribute('y'), t.textContent]);
    const outlines = (root) => root.querySelector('g[stroke-width]').outerHTML;
    const original = parse(before), edited = parse(after);
    const originalFills = fills(original), editedFills = fills(edited);
    const changedFills = editedFills.filter((entry, i) => entry[1] !== originalFills[i][1]);
    const originalLabels = labels(original), editedLabels = labels(edited);
    const changedLabels = editedLabels.filter((entry, i) => entry[2] !== originalLabels[i][2]);
    return {
      preservedOutlines: outlines(original) === outlines(edited),
      activePathChanged: changedFills.length === 1 && changedFills[0][0] === document.querySelector('.region-selection path').getAttribute('d'),
      changedColor: changedFills[0]?.[1], changedLabel: changedLabels[0], labelChanges: changedLabels.length,
    };
  }, [baseline.toString('utf8'), svg.toString('utf8')]);
  assert(success.preservedOutlines && success.activePathChanged);
  assert.equal(success.changedColor, '#000000');
  assert.equal(success.labelChanges, 1);
  assert(Number(success.changedLabel[0]) < 4 && Number(success.changedLabel[1]) < 4 && success.changedLabel[2] === '3');
  assert(!svg.includes('region-selection'), 'Selection markup must stay out of the export');
  const raster = await page.evaluate(async values => {
    async function pixels(value) {
      const image = new Image();
      image.src = `data:image/png;base64,${value}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    const [original, edited] = await Promise.all(values.map(pixels));
    let outsideDifferences = 0;
    for (let i = 0; i < edited.data.length; i += 4) {
      const x = (i / 4) % edited.width, y = Math.floor(i / 4 / edited.width);
      if (x < 101 && y < 101) continue;
      if (edited.data.subarray(i, i + 4).some((value, channel) => value !== original.data[i + channel])) outsideDifferences++;
    }
    return {outsideDifferences, editedPixel: [...edited.data.slice((20 * edited.width + 20) * 4, (20 * edited.width + 21) * 4)]};
  }, [basePng, png].map((bytes) => bytes.toString('base64')));
  assert.deepEqual(raster, {outsideDifferences: 0, editedPixel: [0, 0, 0, 255]});
  await open(page, 'Color key');
  assert.equal(await page.locator('.legend-item[title="#000000"]').innerText(), '3');
  await page.screenshot({path: resolve(directory, 'region-color.png')});

  const undo = page.getByRole('button', {name: 'Undo', exact: true});
  const redo = page.getByRole('button', {name: 'Redo', exact: true});
  await undo.click();
  assert.equal(await picker.inputValue(), '#f0f0f0');
  await redo.click();
  assert.equal(await picker.inputValue(), '#000000');
  await page.getByRole('button', {name: 'Reset region color', exact: true}).click();
  assert.equal(await picker.inputValue(), before);
  await undo.click();
  assert.equal(await picker.inputValue(), '#000000');

  await page.getByRole('button', {name: '8-way', exact: true}).click();
  await ready(page);
  assert.equal(await picker.count(), 0, 'Regenerating should clear the selection');
  assert.equal(await template.locator('path[fill="#000000"]').count(), 0, 'An altered contour must not inherit a region edit');
  await undo.click();
  await ready(page);
  assert.equal(await template.locator('path[fill="#000000"]').count(), 1, 'Returning to the same contour should restore its edit');
  await upload(page, 'research/m1/fixtures/checkerboard.png', 'replacement.png');
  await ready(page);
  assert.equal(await template.locator('path[fill="#000000"]').count(), 0, 'Even an identical replacement source should start free of old recolors');
  return {svg: success, png: raster};
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
      const numbers = page.getByRole('switch', {name: 'Show numbers', exact: true});
      const undo = page.getByRole('button', {name: 'Undo', exact: true});
      const redo = page.getByRole('button', {name: 'Redo', exact: true});
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      assert(await undo.isDisabled() && await redo.isDisabled(), 'A newly opened source should have no edit history');
      await numbers.uncheck();
      await undo.click();
      assert(await numbers.isChecked() && await redo.isEnabled(), 'Undo should restore the numbers');
      await redo.click();
      assert(!await numbers.isChecked(), 'Redo should hide the numbers again');
      await page.keyboard.press(`${modifier}+z`);
      assert(await numbers.isChecked(), 'Undo keyboard shortcut should restore numbers');
      await numbers.uncheck();
      assert(await redo.isDisabled(), 'A different edit after undo should clear redo');
      await page.keyboard.press(`${modifier}+z`);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+y');
      assert(!await numbers.isChecked(), 'Redo keyboard shortcut should restore the edit');
      await undo.click();

      await open(page, 'Region generation');
      await range(page, 'Smoothing / complexity', 65);
      await ready(page);
      await undo.click();
      await ready(page);
      assert.equal(await page.getByLabel('Smoothing / complexity').inputValue(), '40');
      await redo.click();
      await ready(page);
      assert.equal(await page.getByLabel('Smoothing / complexity').inputValue(), '65');

      await page.getByRole('button', {name: 'Manual', exact: true}).click();
      await ready(page);
      const swatch = page.getByLabel('Edit color 1', {exact: true});
      const previousColor = await swatch.inputValue();
      await swatch.fill('#13579b');
      await ready(page);
      await undo.click();
      await ready(page);
      assert.equal(await swatch.inputValue(), previousColor);
      await redo.click();
      await ready(page);
      assert.equal(await swatch.inputValue(), '#13579b');

      await page.reload();
      await upload(page, 'research/m1/fixtures/complex.png');
      await ready(page);
      await open(page, 'Output styling');
      assert.equal(await page.getByRole('switch', {name: 'Show outlines', exact: true}).count(), 0);
      assert(await numbers.isChecked(), 'Numbers should start on');
      await page.getByRole('switch', {name: 'Color preview fill', exact: true}).check();
      await range(page, 'Preview opacity', 100);
      await page.getByLabel('Line color', {exact: true}).fill('#ff00ff');
      await range(page, 'Line thickness', 6);
      await page.getByLabel('Label color', {exact: true}).fill('#00ffff');
      await range(page, 'Label size', 32);
      for (const showNumbers of [true, false, true]) {
        await numbers.setChecked(showNumbers);
        const name = showNumbers ? 'numbers' : 'no-numbers';
        const preview = await page.locator('.preview-artwork > svg').evaluate(svg => svg.outerHTML);
        const svg = (await exportFile(page, directory, 'SVG', `${name}.svg`)).toString('utf8');
        for (const value of [preview, svg]) {
          assert(value.includes('stroke="#ff00ff"'), 'The outline stroke should remain');
          assert.equal(value.includes('<text '), showNumbers);
          assert.match(value, /<path [^>]+fill="#[0-9a-f]{6}"/i);
        }
        const png = await exportFile(page, directory, 'PNG', `${name}.png`);
        const pixels = await countVisibleLayers(page, png);
        assert(pixels.outlines > 0, 'The exported PNG should retain visible outlines');
        assert.equal(pixels.numbers > 0, showNumbers);
        assert(pixels.colored > 0 && pixels.width === 1600 && pixels.height === 1200);
        result.combinations.push({showNumbers, pixels});
        if (!showNumbers) await page.screenshot({path: resolve(directory, 'numbers-hidden-preview.png')});
      }
      await page.setViewportSize({width: 375, height: 800});
      await page.getByRole('button', {name: 'Show settings'}).click();
      const drawer = page.getByRole('dialog', {name: 'Image settings'});
      assert(await drawer.getByRole('button', {name: 'Undo', exact: true}).isEnabled());
      await drawer.getByRole('button', {name: 'Undo', exact: true}).click();
      assert(await drawer.getByRole('button', {name: 'Redo', exact: true}).isEnabled());
      await drawer.getByRole('button', {name: 'Close settings'}).click();
      await upload(page, 'research/m1/fixtures/gradient.png');
      assert(await undo.isDisabled() && await redo.isDisabled(), 'A replacement photo must clear history');
      await ready(page);
      await page.setViewportSize({width: 1440, height: 1000});
      result.regionEdit = await checkRegionColor(page, directory);
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      result.status = 'PASS';
      console.log(`${process.platform} ${channel} ${result.version}: undo/redo, individual region colors, settings and offline exports passed`);
    } finally {
      await browser.close();
    }
  }
} finally {
  writeFileSync(resolve(evidence, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
