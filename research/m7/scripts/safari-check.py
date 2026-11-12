"""Actual Safari investigation. Offline status remains unverified without network control."""
import json
import platform
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

root = Path('research/m7')
result = dict(platform=platform.platform(), browser='Safari', offlineBeforeLaunch=False,
              offlineStatus='UNVERIFIED: Safari WebDriver has no per-context offline control', results=[])
driver = None
try:
    driver = webdriver.Safari()
    result['capabilities'] = driver.capabilities
    driver.get(Path('release/candidates/m7-browser/Pictora.html').resolve().as_uri())
    wait = WebDriverWait(driver, 60)
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.app'))
    driver.save_screenshot(str(root / 'screenshots/safari-local-launch.png'))
    picker = driver.find_element(By.CSS_SELECTOR, '[aria-label="Source image file"]')
    picker.send_keys(str(Path('research/m4/fixtures/portrait.jpg').resolve()))
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.preview-artwork > svg') and d.find_element(By.CSS_SELECTOR, '[aria-label="Export SVG"]').is_enabled())
    result['results'].append(dict(case='local photo and actual worker conversion', status='PASS'))
    driver.save_screenshot(str(root / 'screenshots/safari-portrait.png'))
    download_dir = Path.home() / 'Downloads'
    before = set(download_dir.glob('*'))
    for fmt in ['SVG', 'PNG']:
        driver.find_element(By.CSS_SELECTOR, f'[aria-label="Export {fmt}"]').click()
        target = download_dir / f'portrait-pbn.{fmt.lower()}'
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline and (not target.exists() or target in before):
            time.sleep(.5)
        assert target.exists() and target not in before, f'{fmt} download not observed'
        output = root / 'outputs/safari' / target.name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(target.read_bytes())
        result['results'].append(dict(case=f'{fmt} actual Safari download', status='PASS', bytes=output.stat().st_size))
    result['status'] = 'PARTIAL: actual Safari execution passed; offline cold launch remains unverified'
except Exception as error:
    result['status'] = 'UNVERIFIED'
    result['error'] = repr(error)
    if driver:
        driver.save_screenshot(str(root / 'screenshots/safari-investigation-failure.png'))
finally:
    if driver:
        driver.quit()
    (root / 'logs/safari.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
