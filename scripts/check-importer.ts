/**
 * Local check only (not part of the build or UI): run the importer on a survey.json-format file
 * passed as argv[2] and print the report. Used once against the public NutriCheck survey.json.
 */
import { readFileSync } from 'node:fs';
import { importNutriCheck } from '../src/engine/importer.ts';
import { validateVersion } from '../src/engine/validate.ts';
const file = process.argv[2];
const json = JSON.parse(readFileSync(file, 'utf8'));
const { version, report } = importNutriCheck(json, { id: 'check', version: '0.0', country: '*', created_at: new Date().toISOString() });
console.log(JSON.stringify({ ...report, unsupported_count: report.unsupported.length, unsupported: report.unsupported.slice(0, 50) }, null, 2));
if (version) {
  const v = validateVersion(version);
  console.log('VALIDATION', { errors: v.errors, warnings: v.warnings, publishable: v.publishable, max_total: v.max_total, max_by_topic: v.max_by_topic });
  console.log('ERRORS BY CODE', v.issues.filter((i) => i.severity === 'error').reduce<Record<string, number>>((a, i) => ((a[i.code] = (a[i.code] ?? 0) + 1), a), {}));
  console.log('ERROR SAMPLE', v.issues.filter((i) => i.severity === 'error').slice(0, 15).map((i) => i.message));
}
