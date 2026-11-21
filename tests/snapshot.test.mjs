import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

test('Bundled CDSCO PDFs reproduce the SHA-256 fingerprints of the original notices', () => {
  const base = new URL('../public/', import.meta.url)
  const notices = JSON.parse(
    readFileSync(new URL('data/official.json', base), 'utf8'),
  ).notices
  for (const notice of notices) {
    const data = readFileSync(new URL(notice.localPdf.slice(1), base))
    assert.equal(data.subarray(0, 5).toString(), '%PDF-')
    assert.equal(createHash('sha256').update(data).digest('hex'), notice.sha256)
  }
})
