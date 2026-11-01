import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCertification } from './eligibility.mjs';

const job = { requiredCertification: 'electrical' };

test('nearby technician without the required certification is unqualified', () => {
  const a = { certifications: ['plumbing'], travelMinutes: 5 };
  assert.equal(checkCertification(a, job).qualified, false);
});

test('farther technician with the required certification is qualified', () => {
  const b = { certifications: ['electrical'], travelMinutes: 20 };
  assert.equal(checkCertification(b, job).qualified, true);
});

test('unknown credentials do not count as qualified', () => {
  assert.equal(checkCertification({}, job).qualified, false);
  assert.match(checkCertification({}, job).reason, /verification/);
});

test('missing job requirements are rejected', () => {
  assert.throws(() => checkCertification({ certifications: [] }, {}), /required certification/);
});
