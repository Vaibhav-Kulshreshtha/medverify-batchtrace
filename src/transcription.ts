export const fieldKeys = [
  'product',
  'strength',
  'manufacturer',
  'batch',
  'mfg',
  'expiry',
] as const
export type Field = (typeof fieldKeys)[number]
export type PackFields = Record<Field, string>
export type Origins = Partial<Record<Field, 'image' | 'code'>>
export type Code = { text: string; format: string; fields: Partial<PackFields> }
export type Conflict = { field: Field; printed: string; encoded: string }
export type PackRead = {
  fields: PackFields
  origins: Origins
  uncertain: Field[]
  codes: Code[]
  conflicts: Conflict[]
  rawText: string
}
export interface TextLine {
  text: string
  confidence: number
}

const strengthPattern =
  /\b\d+(?:\.\d+)?\s*(?:mcg|µg|μg|mg|g|ml|iu|units?|%)(?:\s*\/\s*(?:\d+(?:\.\d+)?\s*)?(?:ml|l|g|dose))?(?![a-z])/i
const productPattern =
  /^[A-Za-z][A-Za-z\d '’()+-]{1,90}\b(?:tablets?|capsules?|syrup|injection|ointment|cream|suspension)\b/i
const datePattern =
  /^(?:\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}[./-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s./-]*\d{2,4})(?!\w)/i
const labels: Record<Field, RegExp> = {
  product:
    /\b(?:product(?:\s+name)?|brand(?:\s+name)?|drug\s+name)\s*[:=-]\s*/i,
  strength: /\bstrength\b\s*[:.=–-]?\s*/i,
  manufacturer:
    /\b(?:manufacturer|(?:manufactured|mfd\.?|mfg\.?)\s+by)\b\s*[:.=–-]?\s*/i,
  batch: /\b(?:batch|lot|b\.(?=\s*no))\s*(?:no\.?|number|#)?\s*[:.=–-]?\s*/i,
  mfg: /\b(?:manufacturing\s+date|date\s+of\s+manufacture|mfg\.?|mfd\.?|dom\b)(?!\s*by)\s*(?:date)?\s*[:.=–-]?\s*/i,
  expiry:
    /\b(?:date\s+of\s+expiry|expiration|expiry|expires|exp\b|doe\b)\.?\s*(?:date)?\s*[:.=–-]?\s*/i,
}
const keyLabels = Object.entries(labels) as [Field, RegExp][]

function printedValue(field: Field, text: string): string {
  const value = text.trim()
  if (!value || /[?*█�]/u.test(value)) return ''
  if (field === 'batch') {
    // Keep the entire token exactly as recognized. In particular, no O/0 substitution.
    return /^[A-Z0-9][A-Z0-9./_-]{1,49}$/i.test(value) ? value : ''
  }
  if (field === 'mfg' || field === 'expiry')
    return value.match(datePattern)?.[0] ?? ''
  if (field === 'strength') {
    const amount = value.match(strengthPattern)
    return amount && Number.parseFloat(amount[0]) > 0 && value.length <= 80
      ? value
      : ''
  }
  return value.length <= 180 && /[a-z]/i.test(value) ? value : ''
}

export function extractPrinted(lines: TextLine[]) {
  const fields: PackFields = {
    product: '',
    strength: '',
    manufacturer: '',
    batch: '',
    mfg: '',
    expiry: '',
  }
  const uncertain = new Set<Field>()
  const candidates: Partial<
    Record<Field, { value: string; confidence: number }[]>
  > = {}
  const propose = (field: Field, text: string, confidence: number) => {
    const value = printedValue(field, text)
    if (value) (candidates[field] ??= []).push({ value, confidence })
  }
  for (const [index, line] of lines.entries()) {
    const matches = keyLabels
      .flatMap(([field, pattern]) => {
        const match = line.text.match(pattern)
        return match
          ? [
              {
                field,
                start: match.index!,
                end: match.index! + match[0].length,
              },
            ]
          : []
      })
      .sort((a, b) => a.start - b.start)
    matches.forEach((match, i) => {
      if (i && match.start < matches[i - 1].end) return
      const inlineValue = line.text
        .slice(match.end, matches[i + 1]?.start)
        .trim()
      if (inlineValue) {
        propose(match.field, inlineValue, line.confidence)
        return
      }
      // Some cartons put an explicit label on its own line. Such cross-line
      // associations always need confirmation, even when both lines are sharp.
      const next = lines[index + 1]
      if (
        matches.length === 1 &&
        !line.text.slice(0, match.start).trim() &&
        next &&
        !keyLabels.some(([, pattern]) => pattern.test(next.text))
      ) {
        propose(
          match.field,
          next.text,
          Math.min(70, line.confidence, next.confidence),
        )
      }
    })
  }
  // Unlabelled strength and a probable product line are suggestions for review.
  if (!candidates.strength) {
    for (const { text, confidence } of lines) {
      const match = text.match(strengthPattern)
      if (!match) continue
      const standalone = text.trim() === match[0]
      const inProductHeading =
        productPattern.test(text.trim()) &&
        !/\b(?:dose|dosage|per day|daily|take|takes|given)\b/i.test(text)
      if (standalone || inProductHeading)
        propose('strength', match[0], Math.min(confidence, 70))
    }
  }
  if (!candidates.product) {
    for (const { text } of lines) {
      if (
        productPattern.test(text.trim()) &&
        !keyLabels.some(([, pattern]) => pattern.test(text))
      ) {
        propose('product', text.replace(strengthPattern, '').trim(), 65)
      }
    }
  }
  for (const field of fieldKeys) {
    const choices = candidates[field] ?? []
    if (!choices.length) {
      uncertain.add(field)
      continue
    }
    const distinct = new Set(choices.map((c) => c.value.toLowerCase()))
    if (distinct.size > 1) {
      uncertain.add(field)
      continue
    }
    const best = choices.reduce((a, b) => (a.confidence > b.confidence ? a : b))
    if (best.confidence >= 40) fields[field] = best.value
    if (best.confidence < 80) uncertain.add(field)
  }
  return { fields, uncertain }
}

export function decodeFields(text: string): Partial<PackFields> {
  // URLs, GTIN-only codes, arbitrary JSON and unlabelled numeric strings stay display-only.
  if (text.length > 8192 || /^\s*[a-z][\w+.-]*:\/\//i.test(text)) return {}
  const fields: Partial<PackFields> = {}
  if (text.trimStart().startsWith('{')) {
    try {
      const data = JSON.parse(text)
      for (const field of fieldKeys) {
        if (typeof data?.[field] === 'string') {
          const value = printedValue(field, data[field])
          if (value) fields[field] = value
        }
      }
    } catch {
      /* Display raw undecodable payload. */
    }
    return fields
  }
  // Human-readable GS1 element strings. Only parse complete parenthesized (10) lot fields.
  const lot = text.match(
    /(?:^|\(\d{2,4}\)[^(]*)\(10\)([a-z\d./_-]{1,20})(?=\(|$)/i,
  )
  if (lot) return { batch: lot[1] }
  const { fields: labelled } = extractPrinted(
    text.split(/[;\n]/).map((line) => ({ text: line, confidence: 100 })),
  )
  for (const [field, pattern] of keyLabels)
    if (pattern.test(text) && labelled[field]) fields[field] = labelled[field]
  return fields
}

export function combineRead(
  lines: TextLine[],
  rawText: string,
  codes: Code[],
): PackRead {
  const { fields, uncertain } = extractPrinted(lines)
  const origins: Origins = {}
  const conflicts: Conflict[] = []
  for (const field of fieldKeys) {
    if (fields[field]) origins[field] = 'image'
    const encoded = Array.from(
      new Set(
        codes.flatMap((code) =>
          code.fields[field] ? [code.fields[field]!] : [],
        ),
      ),
    )
    if (fields[field]) {
      for (const value of encoded) {
        if (fields[field].trim().toLowerCase() !== value.trim().toLowerCase()) {
          conflicts.push({ field, printed: fields[field], encoded: value })
          uncertain.add(field)
        }
      }
    } else if (encoded.length === 1) {
      fields[field] = encoded[0]
      origins[field] = 'code'
      uncertain.delete(field)
    } else if (encoded.length > 1) {
      for (const value of encoded)
        conflicts.push({ field, printed: '', encoded: value })
    }
  }
  return {
    fields,
    origins,
    uncertain: [...uncertain],
    codes,
    conflicts,
    rawText,
  }
}
