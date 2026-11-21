// ZXing operates on downsized pixel data in a disposable worker.
importScripts('./index.min.js')
self.onmessage = ({ data }) => {
  try {
    const { width, height, rgba } = data
    const gray = new Uint8ClampedArray(width * height)
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (rgba[p] + 2 * rgba[p + 1] + rgba[p + 2]) >>> 2
    }
    const source = new ZXing.RGBLuminanceSource(gray, width, height)
    const hints = new Map([[ZXing.DecodeHintType.TRY_HARDER, true]])
    const reader = new ZXing.MultiFormatReader()
    reader.setHints(hints)
    const codes = []
    const sw = Math.ceil(width * 0.62)
    const sh = Math.ceil(height * 0.62)
    const regions = [
      [0, 0, width, height],
      [0, 0, sw, sh],
      [width - sw, 0, sw, sh],
      [0, height - sh, sw, sh],
      [width - sw, height - sh, sw, sh],
    ]
    for (const [x, y, w, h] of regions) {
      const luminance = source.crop(x, y, w, h)
      try {
        const bitmap = new ZXing.BinaryBitmap(
          new ZXing.HybridBinarizer(luminance),
        )
        const result = reader.decodeWithState(bitmap)
        const text = result.getText()
        if (!codes.some((code) => code.text === text))
          codes.push({
            text,
            format: ZXing.BarcodeFormat[result.getBarcodeFormat()],
          })
      } catch (error) {
        if (!(
          error instanceof ZXing.NotFoundException ||
          error instanceof ZXing.FormatException ||
          error instanceof ZXing.ChecksumException
        ))
          throw error
      } finally {
        reader.reset()
      }
    }
    if (!codes.some((code) => code.format === 'QR_CODE')) {
      importScripts('../jsqr/jsQR.js')
      const qr = jsQR(rgba, width, height, { inversionAttempts: 'dontInvert' })
      if (qr && !codes.some((code) => code.text === qr.data))
        codes.push({ text: qr.data, format: 'QR_CODE' })
    }
    self.postMessage({ codes })
  } catch {
    self.postMessage({ error: 'Code reader could not inspect this image.' })
  }
}
