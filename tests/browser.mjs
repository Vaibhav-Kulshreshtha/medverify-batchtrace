import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = path.join(root, 'test-results')
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4291'
const origin = new URL(base).origin
const labels = {
  product: 'Product name',
  batch: 'Batch / lot number',
  manufacturer: 'Manufacturer',
  strength: 'Strength',
  mfg: 'Manufacturing date',
  expiry: 'Expiry date',
}
const findings = {
  match: 'Published alert matches this batch',
  possible: 'Possible match — check these details',
  none: 'No matching alert found in the records checked',
  insufficient: 'Insufficient information',
  unavailable: 'Source unavailable',
}
const outcomes = []
const faults = []
const external = []
let server, browser, page

function pass(name) {
  outcomes.push(name)
  console.log('PASS ' + name)
}

async function checkedScreen(name) {
  await page.evaluate(() => document.fonts.ready)
  const sizes = await page.evaluate(() => [
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
  ])
  assert.ok(
    sizes[1] <= sizes[0] + 1,
    name + ' overflows by ' + (sizes[1] - sizes[0]) + ' px',
  )
  await page.screenshot({
    path: path.join(out, name + '.png'),
    fullPage: true,
    animations: 'disabled',
  })
}
const button = (name) =>
  page.getByRole('button', { name, exact: typeof name === 'string' })
const field = (key) => page.getByLabel(labels[key], { exact: true })
const heading = (name) => page.getByRole('heading', { name, exact: true })
async function expectFinding(key) {
  await heading(findings[key]).waitFor()
}
async function home() {
  await page.goto(base)
  await heading('Check a medicine pack for reported issues.').waitFor()
}
async function manual(values) {
  await button('Enter details manually').click()
  for (const [key, value] of Object.entries(values))
    await field(key).fill(value)
}
async function check() {
  const comparison = page.getByRole('checkbox', { name: /I compared/ })
  if (await comparison.isVisible()) await comparison.check()
  await button('Check published alerts').click()
}
async function useDemo(id) {
  await button('Try a demo pack').click()
  if (id === 'upload') {
    await button('Upload a demo image').click()
    // Arbitrary filename proves this input reaches the file-based workflow.
    await page.getByLabel('Upload pack image').setInputFiles({
      name: 'runner-renamed-pack.png',
      mimeType: 'image/png',
      buffer: await readFile(path.join(root, 'public/samples/A.png')),
    })
  } else {
    await button('Use pack ' + id).click()
  }
  await button('Read pack details').click()
  await heading('Review the printed details').waitFor({ timeout: 105000 })
}
async function reviewLayout(width) {
  const photo = await page
    .getByAltText('Your pack for comparison with the transcribed fields')
    .boundingBox()
  const input = await field('product').boundingBox()
  if (width === 360)
    assert.ok(
      photo.y + photo.height <= input.y + 1,
      'Photo should precede editable details on mobile',
    )
  else
    assert.ok(
      photo.x + photo.width <= input.x + 1,
      'Photo should sit beside editable fields on desktop',
    )
}

await mkdir(out, { recursive: true })
try {
  if (!process.env.TEST_BASE_URL) {
    await readFile(path.join(root, 'dist/index.html'))
    server = spawn(
      process.execPath,
      [
        path.join(root, 'node_modules/vite/bin/vite.js'),
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4291',
        '--strictPort',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let logs = ''
    for (const stream of [server.stdout, server.stderr])
      stream.on('data', (chunk) => {
        logs += chunk.toString()
      })
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null)
        throw new Error('Preview failed to start. ' + logs)
      if (
        logs.includes('http://127.0.0.1:4291') &&
        (await fetch(base).then(
          (r) => r.ok,
          () => false,
        ))
      ) {
        ready = true
        break
      }
      await delay(100)
    }
    assert.ok(ready, 'Production preview did not start. ' + logs)
  }
  browser = await chromium.launch(
    process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: 'chrome' },
  )
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'en-GB',
    timezoneId: 'Asia/Kolkata',
    serviceWorkers: 'block',
  })
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (/^https?:/.test(url) && new URL(url).origin !== origin) {
      external.push(new URL(url).origin)
      return route.abort()
    }
    return route.continue()
  })
  await context.addInitScript(() => {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Test permission denial', 'NotAllowedError')
      }
    }
    window.print = () => {
      window.__printInvocations = (window.__printInvocations || 0) + 1
    }
  })
  page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => faults.push(error.message))

  await home()
  await checkedScreen('desktop-home')
  await useDemo('upload')
  await reviewLayout(1366)
  const sampleA = {
    product: 'Velmora Tablets',
    batch: '00742A',
    strength: '25 mg',
    manufacturer: 'Lumen Vale Labs',
    mfg: '01/2025',
    expiry: '12/2028',
  }
  for (const [key, value] of Object.entries(sampleA))
    assert.equal(await field(key).inputValue(), value, 'Sample A: ' + key)
  assert.match(
    await page.locator('#origin-product').innerText(),
    /Read from image/,
  )
  assert.match(await page.locator('.decoded').innerText(), /00742A/)
  assert.match(
    await page.locator('.code-info').innerText(),
    /Batch \/ lot number/,
  )
  assert.ok(await button('Check published alerts').isDisabled())
  await checkedScreen('desktop-review')
  await check()
  await expectFinding('match')
  await page
    .getByRole('columnheader', { name: 'Your pack', exact: true })
    .waitFor()
  await page
    .getByRole('columnheader', { name: 'Published notice', exact: true })
    .waitFor()
  assert.match(
    await page.locator('main').innerText(),
    /Fictional quality alert/,
  )
  await checkedScreen('desktop-result')
  await button(/print.*report|print.*save/i).click()
  assert.equal(await page.evaluate(() => window.__printInvocations), 1)
  const report = await page.pdf({
    path: path.join(out, 'demo-comparison.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  })
  assert.ok(report.subarray(0, 5).equals(Buffer.from('%PDF-')))
  const evidenceLink = page.locator('a[href*="demo-notice.html"]').first()
  const notice = await context.request.get(
    new URL(await evidenceLink.getAttribute('href'), base).href,
  )
  assert.ok(notice.ok())
  assert.match(await notice.text(), /00742A/)
  pass(
    'Renamed upload → local OCR and QR → reviewed demo match → comparison table, original demo row and printable PDF',
  )

  await home()
  await useDemo('B')
  assert.equal(await field('batch').inputValue(), '00791B')
  await check()
  await expectFinding('none')
  await button(/edit.*details|review.*details/i).click()
  await field('batch').fill('00742A')
  assert.match(
    await page.locator('#origin-batch').innerText(),
    /Entered by you/,
  )
  assert.equal(await heading(findings.none).count(), 0)
  await check()
  await expectFinding('match')
  await page
    .getByText('Reviewed details differ from the code', { exact: true })
    .waitFor()
  assert.match(await page.locator('.report .alert-text').innerText(), /00791B/)
  pass(
    'Pack B correction replaces the old result and retains the differing QR batch',
  )

  await home()
  await page.setViewportSize({ width: 360, height: 780 })
  await checkedScreen('mobile-home')
  await button('Scan a medicine pack').click()
  await button('Open camera').click()
  assert.match(
    await page.getByRole('alert').innerText(),
    /Camera access is unavailable/,
  )
  assert.ok(await button('Upload an image').isVisible())
  await checkedScreen('mobile-capture')
  await page.getByLabel('Upload pack image').setInputFiles({
    name: 'unreadable.png',
    mimeType: 'image/png',
    buffer: Buffer.from('This is not an image'),
  })
  await page
    .getByRole('alert')
    .filter({ hasText: /JPEG|PNG|photo/i })
    .waitFor()
  await page
    .getByLabel('Upload pack image')
    .setInputFiles(path.join(root, 'public/samples/B.png'))
  await page.getByAltText('Chosen pack photo').waitFor()
  await button('Retake or replace').click()
  await button('Upload an image').waitFor()
  await manual({})
  assert.equal(await field('batch').inputValue(), '')
  await check()
  await expectFinding('insufficient')
  pass(
    'Camera denial, corrupt upload, successful replacement, retake and manual fallback at 360 px',
  )

  await home()
  await useDemo('A')
  await reviewLayout(360)
  await checkedScreen('mobile-review')
  await check()
  await expectFinding('match')
  await checkedScreen('mobile-result')
  pass(
    'Pack A matches the fictional notice at 360 px with image above fields and no page overflow',
  )
  await home()
  await useDemo('C')
  assert.equal(await field('product').inputValue(), '')
  assert.equal(await field('batch').inputValue(), '')
  await check()
  await expectFinding('insufficient')
  await button(/edit.*details|review.*details/i).click()
  await field('product').fill('Velmora Tablets')
  await field('batch').fill('00742A')
  await check()
  await expectFinding('match')
  pass(
    'Damaged Pack C requests missing identifiers and checks the completed transcription',
  )

  await button('Check a real pack').click()
  await page.getByText('Official records', { exact: true }).waitFor()
  assert.equal(await page.getByAltText('Chosen pack photo').count(), 0)
  await button('Enter details manually').click()
  for (const key of Object.keys(labels))
    assert.equal(await field(key).inputValue(), '')
  assert.equal(await page.locator('.code-info').count(), 0)
  pass(
    'Leaving demo mode clears every field, photo, decoded value and old finding',
  )
  const official = JSON.parse(
    await readFile(path.join(root, 'public/data/official.json'), 'utf8'),
  )
  const r = official.records.find((record) => record.batch === '0081')
  const fields = Object.fromEntries(Object.keys(labels).map((k) => [k, r[k]]))
  for (const [key, value] of Object.entries(fields))
    if (key !== 'manufacturer') await field(key).fill(value)
  await check()
  await expectFinding('possible')
  assert.match(await page.locator('.row-attention').innerText(), /Manufacturer/)
  await button('Edit details').click()
  await field('manufacturer').fill(fields.manufacturer)
  await check()
  await expectFinding('match')
  const body = await page.locator('main').innerText()
  assert.match(body, /Not of Standard Quality \(NSQ\)/)
  assert.match(body, /expiry date has passed/i)
  assert.match(body, /0081/)
  assert.match(body, /2026/)
  const n = official.notices.find((x) => x.id === r.noticeId)
  assert.ok(
    await page
      .locator('a')
      .evaluateAll(
        (links, url) => links.some((a) => a.href.split('#')[0] === url),
        n.url,
      ),
  )
  await checkedScreen('mobile-official')
  pass(
    'Official manual check preserves 0081 and links the expired pack to the March 2025 NSQ row',
  )

  await home()
  await manual({ product: 'Velmora Tablets', batch: '00742A' })
  await check()
  await expectFinding('none')
  pass('Real mode excludes every fictional row')
  await page.route('**/data/official.json', (route) => route.abort())
  await home()
  await manual(fields)
  await check()
  await expectFinding('unavailable')
  await page.unroute('**/data/official.json')
  await button('Retry check').click()
  await expectFinding('match')
  pass(
    'An unavailable official registry fails closed and retry restores the actual source',
  )
  const offlinePdf = page.getByRole('link', {
    name: 'View offline PDF',
    exact: true,
  })
  const pdfBytes = await (
    await context.request.get(
      new URL(await offlinePdf.getAttribute('href'), base).href,
    )
  ).body()
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-')
  pass('Offline copy of the cited CDSCO PDF opens from the local origin')

  await home()
  await manual(fields)
  let release, started
  const gate = new Promise((resolve) => (release = resolve))
  const pending = new Promise((resolve) => (started = resolve))
  await page.route('**/data/official.json', async (route) => {
    started()
    await gate
    await route.continue()
  })
  await button('Check published alerts').click()
  await pending
  await field('batch').fill('0099')
  const response = page.waitForResponse((res) =>
    res.url().endsWith('/data/official.json'),
  )
  release()
  await response
  await page.unroute('**/data/official.json')
  await check()
  await expectFinding('none')
  assert.match(await page.locator('.reviewed-list').innerText(), /0099/)
  pass('Editing during an in-flight comparison invalidates its result')

  await home()
  await button('Scan a medicine pack').click()
  // Supply a real MediaStream made from a known image without accessing the machine camera.
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__requestedFacing = constraints.video.facingMode.ideal
      const img = new Image()
      img.src = './samples/A.png'
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      const stream = canvas.captureStream(4)
      ctx.drawImage(img, 0, 0)
      window.__testTrack = stream.getVideoTracks()[0]
      window.__testCanvas = canvas
      return stream
    }
  })
  await button('Open camera').click()
  await page.waitForFunction(
    () => document.querySelector('video')?.videoWidth > 0,
  )
  await button('Take photo').click()
  await page.getByAltText('Chosen pack photo').waitFor()
  assert.deepEqual(
    await page.evaluate(() => [
      window.__requestedFacing,
      window.__testTrack.readyState,
    ]),
    ['environment', 'ended'],
  )
  await button('Read pack details').click()
  await field('batch').waitFor({ timeout: 95000 })
  assert.equal(await field('batch').inputValue(), '00742A')
  await button('Enlarge photo').click()
  await heading('Pack photo at full size').waitFor()
  await button('Close dialog').click()
  pass(
    'Simulated rear-camera stream captures a readable frame, stops its track and opens full-size comparison',
  )

  const photoResults = []
  for (const name of [
    'medicine-storage-container-09.jpg',
    'paracetamol-650.jpg',
  ]) {
    await home()
    await button('Scan a medicine pack').click()
    await page
      .getByLabel('Upload pack image')
      .setInputFiles(path.join(root, 'tests', 'fixtures', name))
    await button('Read pack details').click()
    await field('product').waitFor({ timeout: 95000 })
    const values = {}
    for (const key of Object.keys(labels))
      values[key] = await field(key).inputValue()
    await check()
    const title = await page.locator('.finding h1').innerText()
    assert.equal(title, findings.insufficient)
    photoResults.push({ image: name, fields: values, finding: title })
  }
  await writeFile(
    path.join(out, 'real-photo-results.json'),
    JSON.stringify(photoResults, null, 2) + '\n',
  )
  pass(
    'Two independent physical-packaging photographs pass through upload, OCR, review and official-source checking',
  )
  assert.deepEqual(
    external,
    [],
    'Unexpected network origins used by the workflow',
  )
  assert.deepEqual(faults, [], 'Uncaught browser errors')
  pass('All workflow requests stayed on the local origin')
  await writeFile(
    path.join(out, 'browser-results.json'),
    JSON.stringify(
      { chromium: browser.version(), viewports: [1366, 360], passes: outcomes },
      null,
      2,
    ) + '\n',
  )
} catch (error) {
  if (page) {
    console.error(
      'UI at failure:',
      (
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 2600),
    )
    await page
      .screenshot({ path: path.join(out, 'failure.png'), fullPage: true })
      .catch(() => {})
  }
  throw error
} finally {
  if (browser) await browser.close()
  if (server && server.exitCode === null) {
    const closed = once(server, 'close')
    server.kill('SIGTERM')
    await closed
  }
}
