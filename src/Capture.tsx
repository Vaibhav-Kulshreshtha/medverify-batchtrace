import { useRef, useState, useEffect } from 'react'
import {
  Camera,
  ImagePlus,
  LoaderCircle,
  PencilLine,
  RotateCcw,
  ScanLine,
  Upload,
  X,
} from 'lucide-react'
export interface CaptureProps {
  preview: string
  busy: string
  error: string
  progress: number
  demo: boolean
  pick: (f: File) => void
  read: () => void
  clear: () => void
  manual: () => void
  cancel: () => void
}
export function Capture({
  preview,
  busy,
  error,
  progress,
  demo,
  pick,
  read,
  clear,
  manual,
  cancel,
}: CaptureProps) {
  const input = useRef<HTMLInputElement>(null),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    token = useRef(0)
  const [active, setActive] = useState(false),
    [requesting, setRequesting] = useState(false),
    [cameraError, setCameraError] = useState('')
  function stop() {
    token.current++
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setActive(false)
    setRequesting(false)
  }
  useEffect(
    () => () => {
      token.current++
      stream.current?.getTracks().forEach((t) => t.stop())
    },
    [],
  )
  useEffect(() => {
    if (active && video.current) video.current.srcObject = stream.current
  }, [active])
  async function camera() {
    setCameraError('')
    setRequesting(true)
    const n = ++token.current
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera unavailable')
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      })
      if (n !== token.current) {
        s.getTracks().forEach((t) => t.stop())
        return
      }
      stream.current = s
      setActive(true)
    } catch {
      if (n === token.current)
        setCameraError(
          'Camera access is unavailable. Allow camera access in your browser, upload a photo, or enter the details manually.',
        )
    } finally {
      if (n === token.current) setRequesting(false)
    }
  }
  async function snap() {
    const v = video.current
    if (!v?.videoWidth) {
      setCameraError('Waiting for the camera image. Try again in a moment.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    const n = token.current
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, 'image/jpeg', 0.94),
    )
    if (n !== token.current) return
    if (blob) {
      stop()
      pick(new File([blob], 'pack-photo.jpg', { type: 'image/jpeg' }))
    } else
      setCameraError(
        'The photo could not be captured. Try again or upload an image.',
      )
  }
  return (
    <section className="page-panel capture">
      <div className="title-block">
        <div className="section-kicker">
          <ScanLine size={16} />
          {demo ? 'Fictional demo' : 'Pack capture'}
        </div>
        <h1>{preview ? 'Review your photo' : 'Capture the batch panel'}</h1>
        <p>
          Use bright, even light. Include the product name, manufacturer, batch
          number and dates in one sharp photo.
        </p>
      </div>
      <input
        ref={input}
        id="pack-upload"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Upload pack image"
        className="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) {
            stop()
            setCameraError('')
            pick(f)
          }
        }}
      />
      <div
        className={'capture-surface ' + (preview || active ? 'has-photo' : '')}
      >
        {preview ? (
          <img src={preview} alt="Chosen pack photo" />
        ) : active ? (
          <video
            ref={video}
            muted
            autoPlay
            playsInline
            aria-label="Live camera preview"
          />
        ) : (
          <div className="capture-empty">
            <ImagePlus size={43} strokeWidth={1.4} />
            <strong>Choose a pack photo</strong>
            <span>JPG, PNG or WebP · up to 20 MB</span>
          </div>
        )}
      </div>
      {(error || cameraError) && (
        <p className="alert-text" role="alert">
          {error || cameraError}
        </p>
      )}
      {busy ? (
        <div className="loading" role="status">
          <LoaderCircle className="spin" />
          <div>
            <strong>{busy}</strong>
            {busy.includes('Reading') && (
              <progress
                max={1}
                value={progress}
                aria-label="Image reading progress"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="actions">
          {preview ? (
            <>
              <button className="btn primary" onClick={read}>
                <ScanLine />
                Read pack details
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  clear()
                  setCameraError('')
                }}
              >
                <RotateCcw />
                Retake or replace
              </button>
            </>
          ) : active ? (
            <>
              <button className="btn primary" onClick={snap}>
                <Camera />
                Take photo
              </button>
              <button className="btn secondary" onClick={stop}>
                <X />
                Close camera
              </button>
            </>
          ) : (
            <button
              className="btn primary"
              onClick={camera}
              disabled={requesting}
            >
              <Camera />
              {requesting ? 'Waiting for camera…' : 'Open camera'}
            </button>
          )}
          {!preview && (
            <button
              className="btn secondary"
              onClick={() => input.current?.click()}
            >
              <Upload />
              Upload an image
            </button>
          )}
        </div>
      )}
      <div className="capture-links">
        <button className="text-btn" onClick={manual}>
          <PencilLine size={16} />
          Enter details manually
        </button>
        <button className="text-btn muted" onClick={cancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
