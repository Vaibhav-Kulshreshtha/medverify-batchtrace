import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  checkPack,
  emptyFields,
  fieldKeys,
  isAlertDataset,
  normalizeField,
} from '../src/evidence.ts'

const demo = JSON.parse(
  readFileSync(new URL('../public/data/demo.json', import.meta.url), 'utf8'),
)
const row = demo.records[0]
const sample = Object.fromEntries(fieldKeys.map((field) => [field, row[field]]))
const options = { expectedKind: 'demo', now: new Date('2026-11-20T10:00:00Z') }
const check = (changes = {}, opts = {}, dataset = demo) =>
  checkPack({ ...sample, ...changes }, dataset, { ...options, ...opts })

test('exact matches retain the source, classification, reviewed values and row', () => {
  const f = check()
  assert.equal(f.state, 'match')
  assert.equal(f.hits[0].notice.id, row.noticeId)
  assert.equal(f.hits[0].record.classification, 'Fictional quality alert')
  assert.equal(f.hits[0].record.row, 1)
  assert.equal(f.hits[0].fields.length, 6)
  assert.deepEqual(f.hits[0].attention, [])
  assert.equal(
    f.hits[0].fields.find((c) => c.field === 'batch').yourValue,
    '00742A',
  )
  assert.equal(f.coverage.noticeCount, 1)
  assert.equal(f.coverage.recordCount, 1)
})
test('separate checks never reuse a previous match', () => {
  assert.equal(check().state, 'match')
  assert.equal(check({ batch: '00791B' }).state, 'none')
})
test('same batch on an unrelated product yields no match', () => {
  assert.equal(check({ product: 'Kelnavir Tablets' }).state, 'none')
})
test('batch alone and completely blank packs are insufficient', () => {
  assert.equal(
    check({ ...emptyFields(), batch: sample.batch }).state,
    'insufficient',
  )
  assert.deepEqual(check(emptyFields()).missing, ['product', 'batch'])
})
test('exact product without a batch points at the missing batch', () => {
  const f = check({ batch: '' })
  assert.equal(f.state, 'possible')
  assert.deepEqual(f.hits[0].attention, ['batch'])
})
test('unrelated product without a batch lacks enough information', () => {
  assert.equal(
    check({ product: 'Kelnavir Tablets', batch: '' }).state,
    'insufficient',
  )
})
test('one visually confusable O/0 or I/1 is review-only', () => {
  assert.equal(check({ batch: 'O0742A' }).state, 'possible')
  assert.equal(
    check({ batch: 'O0742A' }).hits[0].fields.find((c) => c.field === 'batch')
      .status,
    'similar',
  )
  const d = structuredClone(demo)
  d.records[0].batch = 'A17'
  assert.equal(check({ batch: 'AI7' }, {}, d).state, 'possible')
})
test('leading zeros and punctuation remain significant', () => {
  assert.equal(check({ batch: '742A' }).state, 'none')
  assert.equal(check({ batch: '007-42A' }).state, 'none')
  assert.equal(check({ batch: '007 42A' }).state, 'none')
  assert.equal(normalizeField('batch', ' 00742a '), '00742A')
})
test('normalization tolerates case, typographic dashes and strength unit spacing', () => {
  assert.equal(
    check({
      product: '  VELMORA   tablets ',
      strength: '25mg',
      manufacturer: 'lumen vale labs',
      batch: '00742a',
    }).state,
    'match',
  )
  assert.equal(
    normalizeField('product', 'Peptin–A'),
    normalizeField('product', 'Peptin-A'),
  )
})
test('strength and manufacturer disagreements or omissions block exact results', () => {
  for (const [field, value] of [
    ['strength', '50 mg'],
    ['strength', ''],
    ['manufacturer', 'Second Works'],
    ['manufacturer', ''],
  ]) {
    const f = check({ [field]: value })
    assert.equal(f.state, 'possible')
    assert.ok(f.hits[0].attention.includes(field))
  }
})
test('only discriminators printed by the issuing authority are required', () => {
  const d = structuredClone(demo)
  d.records[0].manufacturer = ''
  const f = check({ manufacturer: '' }, {}, d)
  assert.equal(f.state, 'match')
  assert.equal(
    f.hits[0].fields.find((c) => c.field === 'manufacturer').status,
    'unavailable',
  )
})
test('absence of the batch in a source row prevents a match', () => {
  const d = structuredClone(demo)
  d.records[0].batch = ''
  assert.equal(check({}, {}, d).state, 'possible')
})
test('a partially matching name with exact batch can only be possible', () => {
  assert.equal(check({ product: 'Velmara Tablets' }).state, 'possible')
  assert.equal(
    check({ product: 'Velmara Tablets', batch: '00791B' }).state,
    'none',
  )
})
test('unresolved OCR uncertainty gates matches and inconclusive searches', () => {
  const f = check({}, { uncertain: ['batch'] })
  assert.equal(f.state, 'possible')
  assert.deepEqual(f.hits[0].attention, ['batch'])
  assert.equal(
    check({ batch: '00791B' }, { uncertain: ['batch'] }).state,
    'insufficient',
  )
})
test('possible candidates retain all affected source rows', () => {
  const d = structuredClone(demo)
  d.records.push({ ...row, batch: '00000B', row: 2 })
  assert.equal(check({ batch: '' }, {}, d).hits.length, 2)
})
test('end-of-month expiry and code disagreements survive an alert match', () => {
  const conflicts = [{ field: 'batch', printed: '00742A', encoded: '00999B' }]
  const f = check(
    { mfg: '01/2023', expiry: '02/2024' },
    { now: new Date('2024-02-29T18:30:00Z'), conflicts },
  )
  assert.equal(f.state, 'match')
  assert.equal(f.expiry.state, 'expired')
  assert.deepEqual(f.conflicts, conflicts)
  assert.equal(
    f.hits[0].fields.find((c) => c.field === 'expiry').status,
    'different',
  )
})
test('expiry by Indian civil date covers leap month, full day and unparseable inputs', () => {
  assert.equal(
    check(
      { mfg: '01/2023', expiry: 'February 2024' },
      { now: new Date('2024-02-29T18:29:59Z') },
    ).expiry.state,
    'current',
  )
  assert.equal(check({ expiry: '19/11/2026' }).expiry.state, 'expired')
  assert.equal(check({ expiry: '2026-11-20' }).expiry.state, 'current')
  for (const expiry of [
    '29/02/2025',
    '00/2026',
    '13/2026',
    '02/28',
    '',
    'XX / 2028',
  ]) {
    assert.equal(check({ expiry }).expiry.state, 'unknown')
  }
})
test('unavailable, empty, invalid, broken-lineage and wrong-kind sources fail closed', () => {
  assert.equal(check({}, {}, null).state, 'unavailable')
  assert.equal(
    check({}, {}, { ...demo, available: false }).state,
    'unavailable',
  )
  assert.equal(check({}, {}, { ...demo, records: [] }).state, 'unavailable')
  assert.equal(
    check({}, {}, { ...demo, records: [{ ...row, noticeId: 'unknown' }] })
      .state,
    'unavailable',
  )
  assert.equal(check({}, { expectedKind: 'official' }).state, 'unavailable')
  assert.equal(check({}, {}, {}).state, 'unavailable')
})
test('a decoded URL cannot enter the approved evidence-link path', () => {
  const d = structuredClone(demo)
  d.notices[0].url = 'javascript:alert(1)'
  assert.equal(isAlertDataset(d), false)
})
test('stored normalized demonstration keys agree with the matcher', () => {
  for (const [key, value] of Object.entries(row.normalized))
    assert.equal(normalizeField(key, row[key]), value)
})

const official = JSON.parse(
  readFileSync(
    new URL('../public/data/official.json', import.meta.url),
    'utf8',
  ),
)
test('official snapshot validates and all row identifiers recover their own source row', () => {
  assert.ok(isAlertDataset(official, 'official'))
  for (const record of official.records) {
    const f = checkPack(record, official, {
      now: options.now,
      expectedKind: 'official',
    })
    assert.equal(f.state, 'match')
    assert.ok(f.hits.some((h) => h.record === record))
    for (const [key, value] of Object.entries(record.normalized))
      assert.equal(normalizeField(key, record[key]), value)
  }
})
test('full printed product and manufacturer cells can identify an official row', () => {
  for (const r of official.records) {
    const f = checkPack(
      {
        ...r,
        product: r.printedProduct || r.product,
        manufacturer: r.printedManufacturer || r.manufacturer,
      },
      official,
      { expectedKind: 'official', now: options.now },
    )
    assert.equal(f.state, 'match')
    assert.ok(f.hits.some((h) => h.record === r))
  }
})
test('an official pack searched against training records fails closed', () => {
  assert.equal(
    checkPack(official.records[0], demo, { expectedKind: 'official' }).state,
    'unavailable',
  )
  assert.equal(
    checkPack(sample, official, { expectedKind: 'official' }).state,
    'none',
  )
})

test('explicitly unreadable identifiers cannot produce a completed negative check', () => {
  for (const batch of ['00?42A', 'N/A', 'unknown']) {
    assert.equal(check({ batch }).state, 'possible')
    assert.equal(
      check({ product: 'Kelnavir Tablets', batch }).state,
      'insufficient',
    )
  }
  assert.equal(check({ product: 'Vel?ora Tablets' }).state, 'insufficient')
})
test('disabled validated snapshot preserves its coverage note without counting rows as checked', () => {
  const disabled = {
    ...demo,
    available: false,
    coverageNote: 'The demo notice is being refreshed.',
  }
  const f = check({}, {}, disabled)
  assert.equal(f.state, 'unavailable')
  assert.equal(f.coverage.note, disabled.coverageNote)
  assert.equal(f.coverage.recordCount, 0)
})

test('expiry preceding manufacture is flagged independently of an exact alert', () => {
  const f = check({ mfg: '05/2028', expiry: '03/2028' })
  assert.equal(f.state, 'match')
  assert.equal(f.expiry.state, 'unknown')
  assert.match(f.expiry.message, /precedes the manufacturing date/)
})

test('Malformed optional source fields and impossible publication dates fail closed', () => {
  for (const modify of [
    (data) => {
      data.notices[0].date = '2026-14-41'
    },
    (data) => {
      data.records[0].printedProduct = {}
    },
    (data) => {
      data.notices[0].localPdf = 'https://example.com/pdf'
    },
  ]) {
    const data = structuredClone(demo)
    modify(data)
    assert.equal(checkPack(sample, data, options).state, 'unavailable')
  }
})
