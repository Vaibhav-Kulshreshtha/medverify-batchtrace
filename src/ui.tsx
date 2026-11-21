import { noticeHref } from './noticeHref'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  BookOpen,
  Camera,
  Check,
  FileSearch,
  FlaskConical,
  Focus,
  Layers2,
  LockKeyhole,
  PencilLine,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { AlertDataset, FieldKey } from './evidence'

export const labels: Record<FieldKey, string> = {
  product: 'Product name',
  batch: 'Batch / lot number',
  manufacturer: 'Manufacturer',
  strength: 'Strength',
  mfg: 'Manufacturing date',
  expiry: 'Expiry date',
}
export const order: FieldKey[] = [
  'product',
  'strength',
  'batch',
  'manufacturer',
  'mfg',
  'expiry',
]
export const cdsco =
  'https://www.cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/'
export const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(value))
    : 'Unavailable'
export function Brand() {
  return (
    <span className="brand">
      <img src="./mark.svg" alt="" width="38" height="38" />
      MedVerify
    </span>
  )
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    const before = document.activeElement as HTMLElement
    d?.showModal()
    return () => {
      d?.close()
      before?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-body">
        <div className="modal-head">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
const steps = [
  {
    Icon: Camera,
    title: 'Capture the pack',
    text: 'Photograph the printed batch panel, upload an image, or enter the details yourself.',
  },
  {
    Icon: ScanLine,
    title: 'Review the details',
    text: 'Compare the text we read with your pack. Correct any letters, numbers, or dates.',
  },
  {
    Icon: FileSearch,
    title: 'Check the evidence',
    text: 'Compare your pack with published alerts and save a report with the source notice.',
  },
]
export function GuideSteps() {
  return (
    <div className="step-grid">
      {steps.map(({ Icon, title, text }) => (
        <article key={title}>
          <span className="step-icon">
            <Icon size={23} strokeWidth={1.7} />
          </span>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  )
}
export function Home({
  scan,
  manual,
  demo,
}: {
  scan: () => void
  manual: () => void
  demo: () => void
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyeline" />
            Medicine pack screening
          </div>
          <h1>
            Check a medicine pack for <em>reported issues.</em>
          </h1>
          <p className="lede">
            Compare the batch details on your medicine pack with published
            Indian medicine alerts.
          </p>
          <div className="actions hero-actions">
            <button className="btn primary" onClick={scan}>
              <Camera />
              Scan a medicine pack
            </button>
            <button className="btn secondary" onClick={manual}>
              <PencilLine />
              Enter details manually
            </button>
          </div>
          <div className="privacy-line">
            <LockKeyhole size={15} /> Your pack image stays on this device.
          </div>
        </div>
        <figure className="guide-figure">
          <div className="figure-label">
            <Focus size={16} />
            Batch panel guide
          </div>
          <div className="pack-scene">
            <img
              src="./images/pack-guide.webp"
              alt="Medicine carton showing BATCH, MFG and EXP on the side, with a blister strip in front."
            />
            <span className="focus-box" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <figcaption>
            <ScanLine size={17} /> Focus on the batch number and dates.
          </figcaption>
        </figure>
      </section>
      <section className="demo-band" aria-labelledby="demo-title">
        <span className="demo-icon">
          <FlaskConical size={25} strokeWidth={1.65} />
        </span>
        <div>
          <h2 id="demo-title">No pack handy?</h2>
          <p>
            Explore a sample pack and its evidence with fictional demo records.
          </p>
        </div>
        <button className="btn secondary" onClick={demo}>
          <Layers2 size={18} />
          Try a demo pack
        </button>
      </section>
      <section id="how-it-works" className="how">
        <div className="section-kicker">
          <span className="eyeline" />
          The process
        </div>
        <h2>How a pack check works</h2>
        <GuideSteps />
      </section>
    </>
  )
}
export function Sources({ data }: { data: AlertDataset | null | undefined }) {
  return (
    <div className="source-content">
      <p>
        Real pack checks use a selected offline snapshot of notices from India’s
        Central Drugs Standard Control Organisation (CDSCO).
      </p>
      {data?.available ? (
        <>
          <div className="coverage-stats">
            <div>
              <b>{data.notices.length}</b> notices
            </div>
            <div>
              <b>{data.records.length}</b> selected rows
            </div>
            <div>
              <b>{dateLabel(data.snapshotDate)}</b> snapshot
            </div>
          </div>
          <p>{data.coverageNote}</p>
          <ul className="source-list">
            {data.notices.map((n) => (
              <li key={n.id}>
                <BookOpen size={18} />
                <div>
                  <a href={noticeHref(n.url)} target="_blank" rel="noreferrer">
                    {n.title}
                  </a>
                  <small>
                    {n.authority} · {dateLabel(n.date)}
                  </small>
                  {n.localPdf && (
                    <a
                      className="source-link"
                      href={noticeHref(n.localPdf)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View offline PDF
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status">
          {data === undefined
            ? 'Loading the local snapshot…'
            : 'Official-source checking is unavailable.'}
        </p>
      )}
      <p>
        A search covers only the listed rows. Packaging and copied codes cannot
        establish authenticity.
      </p>
      <a href={cdsco} target="_blank" rel="noreferrer">
        Open the CDSCO alerts index
      </a>
    </div>
  )
}
export function Privacy() {
  return (
    <div className="source-content">
      <p>
        <ShieldCheck size={20} /> Your pack photo, OCR text and edits stay in
        browser memory. Starting another check or reloading the page clears
        them.
      </p>
      <p>
        OCR and barcode decoding use bundled software on this device. There are
        no accounts, analytics, or image uploads to a server.
      </p>
      <p>
        Printing or saving a report makes a copy you control. Opening an
        official notice connects to CDSCO.
      </p>
    </div>
  )
}
export function WorkflowSteps({ stage }: { stage: number }) {
  return (
    <ol className="workflow-steps" aria-label="Pack check progress">
      {['Capture', 'Review', 'Evidence'].map((s, i) => (
        <li
          key={s}
          className={i === stage ? 'active' : i < stage ? 'done' : ''}
          aria-current={i === stage ? 'step' : undefined}
        >
          <span>{i < stage ? <Check size={13} /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  )
}
export function DemoPicker({
  select,
  custom,
}: {
  select: (id: string) => void
  custom: () => void
}) {
  return (
    <>
      <p className="intro">
        These fictional packs use the same image reader as a real scan. Choose a
        sample to check against the demo notice.
      </p>
      <div className="sample-list">
        {[
          ['A', 'Listed batch', 'A clear printed panel with a QR code.'],
          [
            'B',
            'Different batch',
            'The same medicine with another batch number.',
          ],
          ['C', 'Damaged label', 'Some of the printed details are unreadable.'],
        ].map(([id, title, description]) => (
          <div className="sample" key={id}>
            <img
              src={'./samples/' + id + '.png'}
              alt={'Fictional sample pack ' + id}
            />
            <div>
              <strong>
                Pack {id} · {title}
              </strong>
              <p>{description}</p>
              <a
                href={'./samples/' + id + '.png'}
                download={'MedVerify-demo-' + id + '.png'}
              >
                Download image
              </a>
            </div>
            <button
              className="btn secondary compact"
              onClick={() => select(id)}
            >
              Use pack {id}
            </button>
          </div>
        ))}
      </div>
      <button className="text-btn" onClick={custom}>
        Upload a demo image
      </button>
    </>
  )
}
