import { combineRead, decodeFields } from './transcription'
import type { Code, PackRead, TextLine } from './transcription'
export type {
  PackRead,
  PackFields,
  Field,
  Origins,
  Conflict,
  Code,
} from './transcription'

type OcrData = {
  text: string
  blocks?: { paragraphs: { lines: TextLine[] }[] }[]
}
interface OcrWorker {
  setParameters(options: Record<string, string>): Promise<unknown>
  recognize(
    file: File,
    options: object,
    output: object,
  ): Promise<{ data: OcrData }>
  terminate(): Promise<void>
}
interface OcrLibrary {
  createWorker(
    language: string,
    mode: number,
    options: Record<string, unknown>,
  ): Promise<OcrWorker>
}

let libraryReady: Promise<OcrLibrary> | undefined
function loadOCR(): Promise<OcrLibrary> {
  if (libraryReady) return libraryReady
  libraryReady = new Promise<OcrLibrary>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = './vendor/ocr/tesseract.min.js'
    el.onload = () => {
      const library = (window as Window & { Tesseract?: OcrLibrary }).Tesseract
      if (library) resolve(library)
      else reject(new Error('The local text reader could not start.'))
    }
    el.onerror = () => {
      el.remove()
      reject(new Error('The local text reader could not load.'))
    }
    document.head.append(el)
  }).catch((error) => {
    libraryReady = undefined
    throw error
  })
  return libraryReady
}

async function openImage(file: File): Promise<HTMLImageElement> {
  const image = new Image()
  const url = URL.createObjectURL(file)
  try {
    image.src = url
    await image.decode()
    return image
  } catch {
    throw new Error(
      'This photo could not be read. Save it as JPEG or PNG and try again.',
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Inspect common file signatures and dimensions before handing compressed data to the browser.
function inspectImage(bytes: Uint8Array): {
  mime: string
  width: number
  height: number
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end))
  if (
    bytes.length > 24 &&
    bytes[0] === 137 &&
    ascii(1, 4) === 'PNG' &&
    ascii(12, 16) === 'IHDR'
  ) {
    return {
      mime: 'image/png',
      width: view.getUint32(16),
      height: view.getUint32(20),
    }
  }
  if (bytes.length > 30 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const tag = ascii(12, 16)
    const le24 = (offset: number) =>
      bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536
    if (tag === 'VP8X')
      return { mime: 'image/webp', width: 1 + le24(24), height: 1 + le24(27) }
    if (tag === 'VP8L' && bytes[20] === 47) {
      const size = view.getUint32(21, true)
      return {
        mime: 'image/webp',
        width: 1 + (size & 16383),
        height: 1 + ((size >>> 14) & 16383),
      }
    }
    if (tag === 'VP8 ')
      return {
        mime: 'image/webp',
        width: view.getUint16(26, true) & 16383,
        height: view.getUint16(28, true) & 16383,
      }
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    for (let p = 2; p + 8 < bytes.length;) {
      if (bytes[p++] !== 255) break
      while (bytes[p] === 255) p++
      const tag = bytes[p++]
      if (p + 7 > bytes.length) break
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(tag)
      ) {
        return {
          mime: 'image/jpeg',
          width: view.getUint16(p + 5),
          height: view.getUint16(p + 3),
        }
      }
      const length = view.getUint16(p)
      if (length < 2) break
      p += length
    }
  }
  throw new Error(
    'Choose a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.',
  )
}

function canvasFor(image: HTMLImageElement, limit: number) {
  const ratio = Math.min(
    1,
    limit / Math.max(image.naturalWidth, image.naturalHeight),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const ctx = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true,
  })
  if (!ctx) throw new Error('This browser could not prepare the photo.')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, ctx }
}

export async function prepareImage(file: File): Promise<File> {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error(
      'Choose a photo under 20 MB that contains the printed batch panel.',
    )
  const bytes = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer())
  const { mime, width, height } = inspectImage(bytes)
  if (
    !width ||
    !height ||
    width * height > 65_000_000 ||
    Math.max(width, height) > 32000
  ) {
    throw new Error('Crop this large photo to the batch panel and try again.')
  }
  if (
    file.type &&
    file.type !== 'application/octet-stream' &&
    file.type !== mime &&
    !(file.type === 'image/jpg' && mime === 'image/jpeg')
  ) {
    throw new Error(
      'The photo format does not match its file type. Export a fresh JPEG or PNG.',
    )
  }
  const image = await openImage(file)
  const { canvas } = canvasFor(image, 2400)
  const type =
    mime === 'image/png' && Math.max(width, height) <= 2400
      ? 'image/png'
      : 'image/jpeg'
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.94),
    )
    if (!blob)
      throw new Error(
        'The browser could not resize the photo. Try a closer crop.',
      )
    return new File([blob], type === 'image/png' ? 'pack.png' : 'pack.jpg', {
      type,
    })
  } finally {
    canvas.width = canvas.height = 1
  }
}

async function readCodes(file: File, signal: AbortSignal): Promise<Code[]> {
  const image = await openImage(file)
  signal.throwIfAborted()
  const { canvas, ctx } = canvasFor(image, 2000)
  const { width, height } = canvas
  const rgba = ctx.getImageData(0, 0, width, height).data
  canvas.width = canvas.height = 1
  const worker = new Worker('./vendor/zxing/decode-worker.js')
  let onAbort: (() => void) | undefined
  try {
    const raw = await new Promise<{ text: string; format: string }[]>(
      (resolve, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener('abort', onAbort, { once: true })
        worker.onerror = () =>
          reject(new Error('The local code reader could not load.'))
        worker.onmessage = ({ data }) =>
          data.error ? reject(new Error(data.error)) : resolve(data.codes)
        worker.postMessage({ rgba, width, height }, [rgba.buffer])
      },
    )
    return raw.map((code) => ({ ...code, fields: decodeFields(code.text) }))
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
    worker.terminate()
  }
}

async function recognize(
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const library = await loadOCR()
  signal.throwIfAborted()
  const worker = await library.createWorker('eng', 1, {
    workerPath: new URL('./vendor/ocr/worker.min.js', document.baseURI).href,
    workerBlobURL: false,
    corePath: new URL('./vendor/ocr/tesseract-core-lstm.wasm.js', document.baseURI).href,
    langPath: new URL('./vendor/ocr', document.baseURI).href,
    cacheMethod: 'none',
    gzip: true,
    logging: false,
    logger: (event: { status: string; progress: number }) => {
      if (event.status === 'recognizing text' && !signal.aborted)
        progress(0.2 + 0.75 * event.progress)
    },
    // Rejected worker jobs are surfaced by the UI. Avoid the library's default uncaught throw.
    errorHandler: () => {},
  })
  const stop = () => {
    void worker.terminate()
  }
  try {
    signal.throwIfAborted()
    signal.addEventListener('abort', stop, { once: true })
    await worker.setParameters({ tessedit_pageseg_mode: '11' })
    const { data } = await worker.recognize(
      file,
      { rotateAuto: true },
      { text: true, blocks: true },
    )
    const lines = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((p) => p.lines),
    )
    return {
      lines: lines.length
        ? lines
        : data.text.split('\n').map((text) => ({ text, confidence: 60 })),
      raw: data.text,
    }
  } finally {
    signal.removeEventListener('abort', stop)
    await worker.terminate()
  }
}

export async function readPack(
  file: File,
  onProgress: (fraction: number) => void = () => {},
  signal?: AbortSignal,
): Promise<PackRead> {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  const timer = window.setTimeout(
    () =>
      controller.abort(
        new Error(
          'Reading timed out. Try a closer crop, or enter the printed details manually.',
        ),
      ),
    90000,
  )
  onProgress(0.03)
  try {
    const cancelled = new Promise<never>((_, reject) =>
      controller.signal.addEventListener(
        'abort',
        () => reject(controller.signal.reason),
        { once: true },
      ),
    )
    const [ocr, codes] = await Promise.race([
      Promise.all([
        recognize(file, controller.signal, onProgress),
        readCodes(file, controller.signal),
      ]),
      cancelled,
    ])
    onProgress(1)
    return combineRead(ocr.lines, ocr.raw, codes)
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    controller.abort()
  }
}
