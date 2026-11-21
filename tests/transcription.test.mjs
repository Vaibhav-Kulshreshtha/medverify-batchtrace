import test from 'node:test'
import assert from 'node:assert/strict'
import {
  combineRead,
  decodeFields,
  extractPrinted,
} from '../src/transcription.ts'

const line = (text) => ({ text, confidence: 95 })
test('Only printed candidates with sufficient evidence become field suggestions', () => {
  const { fields, uncertain } = extractPrinted([
    line('Product: Test Tablets'),
    line('Batch: 0OI1'),
    line('Mfg: 01/2025  Exp: 12/2028'),
    line('Take 100mg daily'),
  ])
  assert.equal(fields.product, 'Test Tablets')
  assert.equal(fields.batch, '0OI1')
  assert.equal(fields.mfg, '01/2025')
  assert.equal(fields.expiry, '12/2028')
  assert.equal(fields.strength, '')
  assert.ok(uncertain.has('strength'))
})
test('Conflicting readings of printed batch text are left unresolved', () => {
  const { fields, uncertain } = extractPrinted([
    line('LOT: 0059'),
    line('Batch: O059'),
  ])
  assert.equal(fields.batch, '')
  assert.ok(uncertain.has('batch'))
})
test('Code-supplied fields retain their origin and never override conflicting print', () => {
  const text = '{"batch":"O059","strength":"20 mg"}'
  const result = combineRead([line('Batch: 0059')], 'Batch: 0059', [
    { text, format: 'QR_CODE', fields: decodeFields(text) },
  ])
  assert.equal(result.fields.batch, '0059')
  assert.equal(result.origins.batch, 'image')
  assert.equal(result.origins.strength, 'code')
  assert.deepEqual(result.conflicts, [
    { field: 'batch', printed: '0059', encoded: 'O059' },
  ])
  assert.ok(result.uncertain.includes('batch'))
})
test('Scanned links, standalone GTINs and numeric JSON lots cannot supply a pack identity', () => {
  for (const text of [
    'https://example.com/?product=Example&batch=0018',
    '5901234123457',
    '{"batch":18}',
  ])
    assert.deepEqual(decodeFields(text), {})
})

test('A batch on the next line retains leading zeros and needs confirmation', () => {
  const { fields, uncertain } = extractPrinted([
    line('Batch No.'),
    line('00185D'),
    line('Expiry Date'),
    line('12/2028'),
  ])
  assert.equal(fields.batch, '00185D')
  assert.equal(fields.expiry, '12/2028')
  assert.ok(uncertain.has('batch'))
  assert.ok(uncertain.has('expiry'))
})
