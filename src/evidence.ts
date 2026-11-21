export const fieldKeys = [
  'product',
  'strength',
  'manufacturer',
  'batch',
  'mfg',
  'expiry',
] as const
export type FieldKey = (typeof fieldKeys)[number]
export type PackFields = Record<FieldKey, string>
type Identifier = 'product' | 'strength' | 'manufacturer' | 'batch'
const identifiers: Identifier[] = [
  'product',
  'batch',
  'strength',
  'manufacturer',
]
export type DatasetKind = 'official' | 'demo'
export type FieldConflict = {
  field: FieldKey
  printed: string
  encoded: string
}
export interface Notice {
  id: string
  title: string
  authority: string
  date: string
  url: string
  localPdf?: string
}
export interface AlertRecord extends PackFields {
  noticeId: string
  page: string | number
  row: string | number
  classification: string
  printedProduct?: string
  printedManufacturer?: string
  remarks?: string
  reason?: string
  laboratory?: string
  normalized: Record<Identifier, string>
}
export interface AlertDataset {
  kind: DatasetKind
  available: boolean
  snapshotDate: string
  notices: Notice[]
  records: AlertRecord[]
  coverageNote: string
}
export type ComparisonStatus =
  'match' | 'similar' | 'different' | 'missing' | 'unavailable'
export interface FieldComparison {
  field: FieldKey
  status: ComparisonStatus
  yourValue: string
  noticeValue: string
}
export interface EvidenceHit {
  record: AlertRecord
  notice: Notice
  fields: FieldComparison[]
  attention: FieldKey[]
}
export type FindingState =
  'match' | 'possible' | 'none' | 'insufficient' | 'unavailable'
export interface Finding {
  state: FindingState
  title: string
  explanation: string
  nextStep: string
  hits: EvidenceHit[]
  missing: FieldKey[]
  expiry: { state: 'expired' | 'current' | 'unknown'; message: string }
  conflicts: FieldConflict[]
  checks: string[]
  checkedAt: string
  coverage: {
    kind: DatasetKind
    snapshotDate: string
    noticeCount: number
    recordCount: number
    note: string
  }
}
export function emptyFields(): PackFields {
  return {
    product: '',
    strength: '',
    manufacturer: '',
    batch: '',
    mfg: '',
    expiry: '',
  }
}

export function normalizeField(field: FieldKey, value: string): string {
  const trimmed = value.normalize('NFC').trim()
  if (field === 'batch')
    return trimmed.replace(/[a-z]/g, (c) => c.toUpperCase())
  const plain = trimmed
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s+/g, ' ')
  if (field === 'strength')
    return plain.replace(/(\d)\s+(?=(mg|mcg|µg|μg|g|ml|iu|%)\b|%)/g, '$1')
  return plain
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const hasLocation = (value: unknown) =>
  hasText(value) || (Number.isInteger(value) && Number(value) >= 1)
function isoDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const parsed = new Date(value)
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

export function isAlertDataset(
  value: unknown,
  expectedKind?: DatasetKind,
): value is AlertDataset {
  if (
    !object(value) ||
    (value.kind !== 'official' && value.kind !== 'demo') ||
    (expectedKind && value.kind !== expectedKind) ||
    typeof value.available !== 'boolean' ||
    !isoDate(value.snapshotDate) ||
    !hasText(value.coverageNote) ||
    !Array.isArray(value.notices) ||
    !Array.isArray(value.records)
  )
    return false
  const noticeIds = new Set<string>()
  for (const notice of value.notices) {
    if (
      !object(notice) ||
      !hasText(notice.id) ||
      noticeIds.has(notice.id) ||
      !hasText(notice.title) ||
      !hasText(notice.authority) ||
      !isoDate(notice.date) ||
      !hasText(notice.url)
    )
      return false
    if (
      notice.localPdf !== undefined &&
      (typeof notice.localPdf !== 'string' ||
        !/^\/data\/notices\/[a-z0-9-]+\.pdf$/.test(notice.localPdf))
    )
      return false
    if (
      value.kind === 'official' &&
      !/^https:\/\/(?:[a-z0-9-]+\.)*cdsco\.gov\.in\//i.test(notice.url)
    )
      return false
    if (value.kind === 'demo' && notice.url !== '/data/demo-notice.html')
      return false
    noticeIds.add(notice.id)
  }
  if (value.available && (!value.notices.length || !value.records.length))
    return false
  return value.records.every(
    (row) =>
      object(row) &&
      hasText(row.noticeId) &&
      noticeIds.has(row.noticeId) &&
      hasLocation(row.page) &&
      hasLocation(row.row) &&
      hasText(row.classification) &&
      fieldKeys.every((key) => typeof row[key] === 'string') &&
      hasText(row.product) &&
      ['printedProduct', 'printedManufacturer', 'reason', 'remarks'].every(
        (key) => row[key] === undefined || typeof row[key] === 'string',
      ) &&
      object(row.normalized) &&
      identifiers.every(
        (key) =>
          typeof (row.normalized as Record<string, unknown>)[key] === 'string',
      ),
  )
}

// Similarity selects candidates for human inspection only. Exact results never use these functions.
function oneEditApart(left: string, right: string) {
  if (
    Math.min(left.length, right.length) < 5 ||
    Math.abs(left.length - right.length) > 1
  )
    return false
  let i = 0,
    j = 0,
    edits = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (left.length >= right.length) i++
    if (right.length >= left.length) j++
  }
  return edits + left.length - i + right.length - j === 1
}

const genericWords = new Set([
  'tablets',
  'tablet',
  'capsules',
  'capsule',
  'oral',
  'injection',
  'injections',
  'syrup',
  'solution',
  'suspension',
  'film',
  'coated',
  'extended',
  'release',
  'cream',
  'ointment',
  'powder',
  'for',
  'and',
  'the',
  'ip',
  'bp',
  'usp',
  'mg',
  'ml',
  'ltd',
  'limited',
  'pvt',
  'private',
  'pharmaceuticals',
  'pharma',
  'labs',
  'laboratories',
])
function similarName(left: string, right: string): boolean {
  const words = (s: string) =>
    s
      .match(/[\p{L}]+/gu)
      ?.filter((w) => w.length >= 3 && !genericWords.has(w)) ?? []
  const a = words(left),
    b = words(right)
  return a.some((x) => b.some((y) => x === y || oneEditApart(x, y)))
}
function similarBatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let differences = 0
  for (let i = 0; i < left.length; i++) {
    if (left[i] === right[i]) continue
    if (
      !['0O', 'O0', 'I1', '1I'].includes(left[i] + right[i]) ||
      ++differences > 1
    )
      return false
  }
  return differences === 1
}

interface PackDate {
  year: number
  month: number
  day?: number
}
function parsePackDate(input: string): PackDate | undefined {
  const value = input.trim()
  let year: number, month: number, day: number | undefined
  let match = /^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/.exec(value)
  if (match) {
    year = +match[1]
    month = +match[2]
    day = match[3] ? +match[3] : undefined
  } else if (
    (match = /^(?:(\d{1,2})[./-])?(\d{1,2})[./-](\d{4})$/.exec(value))
  ) {
    year = +match[3]
    month = +match[2]
    day = match[1] ? +match[1] : undefined
  } else if ((match = /^([a-z]+)[\s./-]+(\d{4})$/i.exec(value))) {
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ]
    const name = match[1].toLowerCase()
    month =
      1 + monthNames.findIndex((m) => m === name || m.slice(0, 3) === name)
    year = +match[2]
  } else return undefined
  if (year < 1900 || month < 1 || month > 12) return undefined
  if (
    day !== undefined &&
    (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())
  )
    return undefined
  return { year, month, day }
}

function checkExpiry(
  value: string,
  manufactured: string,
  now: Date,
): Finding['expiry'] {
  const date = parsePackDate(value)
  if (!date)
    return {
      state: 'unknown',
      message: value.trim()
        ? 'Expiry could not be interpreted. Check the printed date and use a four-digit year.'
        : 'Expiry was not supplied. Check the printed expiry date.',
    }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const part = (k: string) => Number(parts.find((p) => p.type === k)?.value)
  const today = Date.UTC(part('year'), part('month') - 1, part('day'))
  const end = Date.UTC(
    date.year,
    date.month - 1,
    date.day ?? new Date(Date.UTC(date.year, date.month, 0)).getUTCDate(),
  )
  const start = parsePackDate(manufactured)
  if (start && end < Date.UTC(start.year, start.month - 1, start.day ?? 1)) {
    const past = end < today
    return {
      state: past ? 'expired' : 'unknown',
      message:
        (past ? 'The reviewed expiry date has passed. ' : '') +
        'The expiry date precedes the manufacturing date. Compare both dates with the pack.',
    }
  }
  return end < today
    ? {
        state: 'expired',
        message:
          'The printed expiry date has passed. Show the date to a licensed pharmacist.',
      }
    : { state: 'current', message: 'The reviewed expiry date has not passed.' }
}

function unreadable(value: string): boolean {
  return (
    !value.trim() ||
    /[?*█�]/u.test(value) ||
    /^(?:n\/?a|unknown|unreadable|illegible|not visible)$/i.test(value.trim())
  )
}

function compare(
  field: FieldKey,
  yours: string,
  printed: string,
): ComparisonStatus {
  if (!printed.trim()) return 'unavailable'
  if (unreadable(yours)) return 'missing'
  const a = normalizeField(field, yours),
    b = normalizeField(field, printed)
  if (a === b) return 'match'
  if (field === 'batch' && similarBatch(a, b)) return 'similar'
  if ((field === 'product' || field === 'manufacturer') && similarName(a, b))
    return 'similar'
  if (field === 'mfg' || field === 'expiry') {
    const x = parsePackDate(a),
      y = parsePackDate(b)
    if (x && y && x.year === y.year && x.month === y.month && x.day === y.day)
      return 'match'
  }
  return 'different'
}

function classifyRow(
  pack: PackFields,
  record: AlertRecord,
  notice: Notice,
  uncertain: Set<string>,
) {
  const fields = fieldKeys.map((field) => {
    const yourValue = pack[field]
    let noticeValue = record[field]
    let status = compare(field, yourValue, noticeValue)
    const fullCell =
      field === 'product'
        ? record.printedProduct
        : field === 'manufacturer'
          ? record.printedManufacturer
          : undefined
    if (noticeValue && fullCell && status !== 'match') {
      const fullStatus = compare(field, yourValue, fullCell)
      if (
        fullStatus === 'match' ||
        (fullStatus === 'similar' && status === 'different')
      ) {
        status = fullStatus
        noticeValue = fullCell
      }
    }
    return { field, status, yourValue, noticeValue }
  })
  const status = (key: FieldKey) => fields.find((f) => f.field === key)!.status
  const product = status('product'),
    batch = status('batch')
  if (!['match', 'similar'].includes(product)) return
  if (batch === 'different') return
  // Two weak identifiers without an exact anchor generate excessive unrelated alerts.
  if (product === 'similar' && batch !== 'match') return
  const attention = identifiers.filter(
    (k) =>
      (k === 'batch' || record[k].trim() !== '') &&
      (status(k) !== 'match' || uncertain.has(k)),
  )
  const hit: EvidenceHit = { record, notice, fields, attention }
  return { exact: attention.length === 0, hit }
}

const titles: Record<FindingState, string> = {
  match: 'Published alert matches this batch',
  possible: 'Possible match — check these details',
  none: 'No matching alert found in the records checked',
  insufficient: 'Insufficient information',
  unavailable: 'Source unavailable',
}

export function checkPack(
  pack: PackFields,
  dataset: AlertDataset | null,
  options: {
    expectedKind?: DatasetKind
    conflicts?: FieldConflict[]
    uncertain?: string[]
    now?: Date
  } = {},
): Finding {
  const now = options.now ?? new Date()
  const kind = options.expectedKind ?? dataset?.kind ?? 'official'
  const selected = isAlertDataset(dataset, kind) ? dataset : null
  const valid = selected?.available ? selected : null
  const uncertain = new Set(options.uncertain ?? [])
  const productUsable =
    !unreadable(pack.product) &&
    (pack.product.match(/\p{L}/gu)?.length ?? 0) >= 2
  const batchUsable =
    !unreadable(pack.batch) && /[\p{L}\p{N}]/u.test(pack.batch)
  const missing: FieldKey[] = []
  if (!productUsable || uncertain.has('product')) missing.push('product')
  if (!batchUsable || uncertain.has('batch')) missing.push('batch')
  const checks = ['Checked the reviewed expiry date.']
  if (options.conflicts?.length)
    checks.push(
      'Recorded differences between the printed text and the decoded contents.',
    )
  const finish = (
    state: FindingState,
    explanation: string,
    nextStep: string,
    hits: EvidenceHit[] = [],
  ): Finding => ({
    state,
    title: titles[state],
    explanation,
    nextStep,
    hits,
    missing,
    expiry: checkExpiry(pack.expiry, pack.mfg, now),
    conflicts: options.conflicts ?? [],
    checks,
    checkedAt: now.toISOString(),
    coverage: {
      kind,
      snapshotDate: selected?.snapshotDate ?? '',
      noticeCount: valid?.notices.length ?? 0,
      recordCount: valid?.records.length ?? 0,
      note:
        selected?.coverageNote ?? 'The selected snapshot could not be checked.',
    },
  })
  if (!valid)
    return finish(
      'unavailable',
      'The selected records could not be loaded or validated.',
      'Retry the check or consult the official alerts index.',
    )
  if (!productUsable)
    return finish(
      'insufficient',
      'A readable product name is needed to identify candidate notices.',
      'Photograph the product name and batch panel, or enter the printed details.',
    )
  const exact: EvidenceHit[] = [],
    possible: EvidenceHit[] = []
  const notices = new Map(valid.notices.map((n) => [n.id, n]))
  for (const record of valid.records) {
    const result = classifyRow(
      pack,
      record,
      notices.get(record.noticeId)!,
      uncertain,
    )
    if (result) (result.exact ? exact : possible).push(result.hit)
  }
  checks.unshift(
    'Compared the reviewed product and batch with the selected records.',
    'Compared strength and manufacturer wherever the notice listed them.',
  )
  if (exact.length)
    return finish(
      'match',
      'The reviewed product, batch and all other published identifying fields agree.',
      'Open the cited notice and show this report to a licensed pharmacist.',
      exact,
    )
  if (possible.length)
    return finish(
      'possible',
      'A notice shares identifying details with this pack. Check the highlighted fields against the print.',
      'Review the marked details, open the cited notice and show the comparison to a licensed pharmacist.',
      possible,
    )
  if (missing.length)
    return finish(
      'insufficient',
      'A readable, reviewed product name and batch are needed to complete the search.',
      'Photograph the batch panel again or enter the missing details exactly as printed.',
    )
  return finish(
    'none',
    'The reviewed identifiers did not match a batch in this snapshot. Other batches and notices may exist.',
    'If the pack still concerns you, take it and this report to a licensed pharmacist.',
  )
}
