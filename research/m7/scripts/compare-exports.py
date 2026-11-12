import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path('research/m7')
records = []
for browser in ['chrome', 'edge']:
    for file in (root / 'outputs' / browser).glob('*'):
        reference = Path('research/m5/outputs') / browser / file.name
        if not reference.exists():
            reference = Path('research/m5/outputs/chrome') / file.name
        if not reference.exists():
            continue
        if file.suffix == '.svg':
            exact = file.read_bytes() == reference.read_bytes()
            records.append(dict(file=file.as_posix(), kind='svg', exact=exact))
            assert exact, file
        elif file.suffix == '.png':
            with Image.open(file) as a, Image.open(reference) as b:
                assert a.size == b.size, file
                diff = ImageChops.difference(a.convert('RGBA'), b.convert('RGBA'))
                records.append(dict(file=file.as_posix(), kind='png', dimensions=a.size, extrema=diff.getextrema(), rms=ImageStat.Stat(diff).rms, exact=all(v == (0, 0) for v in diff.getextrema())))
assert records, 'No exported files compared'
(root / 'logs/export-comparisons.json').write_text(json.dumps(records, indent=2) + '\n')
print(f'Inspected {len(records)} exports, {sum(r["exact"] for r in records)} exact. PNG raster differences remain explicit for cross-platform review.')
