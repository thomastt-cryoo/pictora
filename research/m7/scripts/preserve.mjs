import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
for (const milestone of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) {
  const root = `research/${milestone}`;
  const manifest = JSON.parse(readFileSync(`${root}/ARTIFACTS.json`));
  const changed = manifest.files.filter(file => hash(readFileSync(`${root}/${file.path}`)) !== file.sha256).map(file => file.path);
  records.push({milestone, artifactCount: manifest.artifactCount, changed});
}
const changed = execFileSync('git', ['diff', 'ce16f4c', '--name-only', '--', 'src', 'release/browser', 'release/windows', 'research/m1', 'research/m2', 'research/m3', 'research/m4', 'research/m5', 'research/m6']).toString().trim();
const candidate = readFileSync('release/candidates/m7-browser/Pictora.html');
const original = readFileSync('release/browser/Pictora.html');
const result = {records, protectedGitChanges: changed, candidateHtmlIdenticalToM5: candidate.equals(original), candidateSha256: hash(candidate)};
writeFileSync('research/m7/logs/preservation.json', JSON.stringify(result, null, 2) + '\n');
if (changed || records.some(record => record.changed.length) || !candidate.equals(original)) throw Error('Protected artifact changed');
console.log('M1–M6 evidence, source and approved releases preserved. Candidate HTML matches M5.');
