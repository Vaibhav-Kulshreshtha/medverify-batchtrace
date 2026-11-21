import { useState } from 'react'
import {
  Camera,
  Check,
  FilePenLine,
  Image,
  Search,
  ZoomIn,
  ScanBarcode,
  TriangleAlert,
} from 'lucide-react'
import { labels, order, Modal } from './ui'
import type { FieldKey, PackFields } from './evidence'
import type { PackRead } from './transcription'
export type Origin = 'image' | 'code' | 'user'
export type FieldOrigins = Partial<Record<FieldKey, Origin>>
export const originText = {
  image: 'Read from image',
  code: 'Read from code',
  user: 'Entered by you',
}
export function Codes({ read }: { read: PackRead }) {
  return (
    <div className="code-info">
      <h3>
        <ScanBarcode size={19} />
        Decoded contents
      </h3>
      {read.codes.length ? (
        <>
          {read.codes.map((code, i) => (
            <div key={i} className="decoded">
              <strong>{code.format}</strong>
              <code dir="auto">{code.text}</code>
              <small>
                {Object.keys(code.fields).length
                  ? 'Fields in code: ' +
                    Object.keys(code.fields)
                      .map((k) => labels[k as FieldKey])
                      .join(', ')
                  : 'No pack fields supplied by this code.'}
              </small>
            </div>
          ))}
          <p>
            A retail code may identify a product. A copied code can appear on
            another pack. Scanned links are displayed as text.
          </p>
        </>
      ) : (
        <p>No supported code was decoded from this image.</p>
      )}
    </div>
  )
}
export function ReviewedCodeDifferences({
  fields,
  read,
}: {
  fields: PackFields
  read: PackRead | null
}) {
  if (!read) return null
  const items = read.codes.flatMap((code) =>
    order
      .filter(
        (k) =>
          code.fields[k] &&
          fields[k].trim().toLowerCase() !==
            code.fields[k]!.trim().toLowerCase() &&
          !read.conflicts.some(
            (c) =>
              c.field === k &&
              c.printed === fields[k] &&
              c.encoded === code.fields[k],
          ),
      )
      .map((k) => ({ key: k, encoded: code.fields[k] })),
  )
  return items.length ? (
    <div className="alert-text">
      <strong>Reviewed details differ from the code</strong>
      {items.map((x, i) => (
        <p key={i}>
          {labels[x.key]} · reviewed <b>{fields[x.key] || 'not supplied'}</b> ·
          encoded <b>{x.encoded}</b>
        </p>
      ))}
    </div>
  ) : null
}
export function Review({
  fields,
  origins,
  read,
  preview,
  uncertain,
  change,
  confirm,
  check,
  replace,
  checking,
  error,
}: {
  fields: PackFields
  origins: FieldOrigins
  read: PackRead | null
  preview: string
  uncertain: FieldKey[]
  change: (k: FieldKey, v: string) => void
  confirm: (k: FieldKey) => void
  check: () => void
  replace: () => void
  checking: boolean
  error: string
}) {
  const [seen, setSeen] = useState(false),
    [zoom, setZoom] = useState(false)
  return (
    <section>
      <div className="title-block">
        <div className="section-kicker">
          <FilePenLine size={16} />
          Pack details
        </div>
        <h1>
          {preview ? 'Review the printed details' : 'Enter the printed details'}
        </h1>
        <p>
          {preview
            ? 'Compare each field with the photo. Keep letters, digits and leading zeros exactly as printed.'
            : 'Start with the product name and batch number. Add the other details exactly as printed on the pack.'}
        </p>
      </div>
      {error && (
        <p className="alert-text" role="alert">
          {error}
        </p>
      )}
      <div className={'review-grid ' + (!preview ? 'manual-grid' : '')}>
        {preview && (
          <div className="review-left">
            <div className="review-photo">
              <div className="photo-heading">
                <Image size={18} />
                Your pack photo
              </div>
              <img
                src={preview}
                alt="Your pack for comparison with the transcribed fields"
              />
              <div className="photo-actions">
                <button className="text-btn" onClick={() => setZoom(true)}>
                  <ZoomIn size={16} />
                  Enlarge photo
                </button>
                <button className="text-btn" onClick={replace}>
                  <Camera size={16} />
                  Replace photo
                </button>
              </div>
            </div>
            {read && (
              <div className="read-evidence">
                <Codes read={read} />
                <details>
                  <summary>View raw OCR text</summary>
                  <pre>{read.rawText || 'No text was readable.'}</pre>
                </details>
              </div>
            )}
          </div>
        )}
        <div className="form-panel">
          {read && order.every((k) => !read.fields[k]) && (
            <p className="alert-text">
              No usable pack details could be read. Try a straight-on close-up
              of the label in even light, or enter the visible details below.
            </p>
          )}
          <div className="field-grid">
            {order.map((key) => {
              const origin = origins[key],
                flag = uncertain.includes(key) && !!fields[key]
              return (
                <div
                  className={
                    'form-field ' +
                    (['product', 'manufacturer'].includes(key) ? 'wide' : '')
                  }
                  key={key}
                >
                  <label htmlFor={'f-' + key}>{labels[key]}</label>
                  <input
                    id={'f-' + key}
                    type="text"
                    className={key === 'batch' ? 'mono' : ''}
                    value={fields[key]}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={220}
                    placeholder={
                      key === 'mfg' || key === 'expiry'
                        ? 'MM/YYYY'
                        : 'As printed on pack'
                    }
                    onChange={(e) => {
                      setSeen(false)
                      change(key, e.target.value)
                    }}
                    aria-describedby={'origin-' + key}
                  />
                  <small id={'origin-' + key}>
                    {origin && fields[key] ? (
                      <>
                        <span className="origin-dot" />
                        {originText[origin]}
                      </>
                    ) : preview ? (
                      <>
                        <TriangleAlert size={13} />
                        Missing · review pack
                      </>
                    ) : (
                      'Enter if visible'
                    )}
                  </small>
                  {flag && (
                    <button
                      className="verify-field"
                      onClick={() => confirm(key)}
                    >
                      <Check size={14} />
                      Confirm uncertain reading
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {!!read?.conflicts.length && (
            <div className="alert-text">
              <strong>Printed and encoded details differ</strong>
              {read.conflicts.map((c, i) => (
                <p key={i}>
                  {labels[c.field]} · printed <b>{c.printed || 'unreadable'}</b>{' '}
                  · code <b>{c.encoded}</b>
                </p>
              ))}
            </div>
          )}
          <ReviewedCodeDifferences fields={fields} read={read} />
          {preview && (
            <label className="review-check">
              <input
                type="checkbox"
                checked={seen}
                onChange={(e) => setSeen(e.target.checked)}
              />
              I compared the details above with the pack.
            </label>
          )}
          <button
            className="btn primary check-btn"
            onClick={check}
            disabled={checking || (!!preview && !seen)}
          >
            <Search />
            {checking ? 'Checking records…' : 'Check published alerts'}
          </button>
        </div>
      </div>
      {zoom && (
        <Modal title="Pack photo at full size" close={() => setZoom(false)}>
          <p>Scroll to inspect the label.</p>
          <div
            className="zoom-photo"
            tabIndex={0}
            role="region"
            aria-label="Scrollable full-size pack photo"
          >
            <img src={preview} alt="Full-size pack for close inspection" />
          </div>
        </Modal>
      )}
    </section>
  )
}
