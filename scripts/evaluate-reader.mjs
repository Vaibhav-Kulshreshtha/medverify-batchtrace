// Run with the development server active. An optional argument supplies a real photo from disk.
import { chromium } from 'playwright-core'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const address = process.env.READER_TEST_URL || 'http://127.0.0.1:4178'
const modulePath = process.env.READER_TEST_MODULE || '/src/reader.ts'
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath =
  process.env.CHROME_PATH || (existsSync(macChrome) ? macChrome : undefined)
const browser = await chromium.launch({ executablePath, headless: true })
try {
  const page = await browser.newPage()
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === new URL(address).origin || url.protocol === 'blob:'
      ? route.continue()
      : route.abort()
  })
  await page.goto(address)
  // Use the same File API as an upload; the reader receives no path or demo identifiers.
  const samples = ['A', 'B', 'C'].map((letter) => ({
    label: 'Fictional sample ' + letter,
    path: fileURLToPath(
      new URL('../public/samples/' + letter + '.png', import.meta.url),
    ),
    mime: 'image/png',
  }))
  if (process.argv[2])
    samples.push({
      label: 'Additional photograph',
      path: process.argv[2],
      mime: 'image/jpeg',
    })
  for (const [i, sample] of samples.entries()) {
    const bytes = await readFile(sample.path)
    const result = await page.evaluate(
      async ({ modulePath, base64, mime }) => {
        const { prepareImage, readPack } = await import(modulePath)
        const content = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
        const file = await prepareImage(
          new File([content], 'upload', { type: mime }),
        )
        const { fields, codes, uncertain, conflicts } = await readPack(file)
        return { fields, codes, uncertain, conflicts }
      },
      { modulePath, base64: bytes.toString('base64'), mime: sample.mime },
    )
    console.log(sample.label, JSON.stringify(result))
    if (i < 3) {
      assert.deepEqual(result.fields, {
        product: i === 2 ? '' : 'Velmora Tablets',
        strength: '25 mg',
        manufacturer: 'Lumen Vale Labs',
        batch: ['00742A', '00791B', ''][i],
        mfg: '01/2025',
        expiry: '12/2028',
      })
      if (i === 2)
        assert.deepEqual(
          new Set(result.uncertain),
          new Set(['batch', 'product']),
        )
      else assert.equal(result.codes[0]?.fields.batch, result.fields.batch)
      assert.equal(result.conflicts.length, 0)
    }
  }
  // EAN-13 5901234123457 encoded as its normal 95 modules with quiet zones.
  const retail = await page.evaluate(
    async ({ modulePath }) => {
      const { prepareImage, readPack } = await import(modulePath)
      const modules =
        '101' +
        '000101101001110110011001001101111010011101' +
        '01010' +
        '110011011011001000010101110010011101000100' +
        '101'
      const canvas = document.createElement('canvas')
      canvas.width = 520
      canvas.height = 220
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 520, 220)
      ctx.fillStyle = '#000'
      for (const [i, bar] of [...modules].entries())
        if (bar === '1') ctx.fillRect(50 + i * 4, 30, 4, 150)
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      const result = await readPack(
        await prepareImage(
          new File([blob], 'retail.png', { type: 'image/png' }),
        ),
      )
      return { codes: result.codes, fields: result.fields }
    },
    { modulePath },
  )
  assert.deepEqual(
    retail.codes.find((code) => code.format === 'EAN_13'),
    { text: '5901234123457', format: 'EAN_13', fields: {} },
  )
  assert.equal(retail.fields.batch, '')
  console.log('Retail code', JSON.stringify(retail))
} finally {
  await browser.close()
}
