import { noticeHref } from './noticeHref'
import {
  BookOpen,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  FileSearch,
  FileText,
  Info,
  ListChecks,
  PencilLine,
  Printer,
  RotateCcw,
  ScanLine,
} from 'lucide-react'
import { cdsco, dateLabel, labels, order } from './ui'
import {
  originText,
  type FieldOrigins,
  Codes,
  ReviewedCodeDifferences,
} from './Review'
import type {
  AlertRecord,
  EvidenceHit,
  FieldKey,
  Finding,
  PackFields,
} from './evidence'
import type { PackRead } from './transcription'

interface PrintedRecord extends AlertRecord {
  printedProduct?: string
  printedManufacturer?: string
  reason?: string
  remarks?: string
}
function EvidenceTable({ hit }: { hit: EvidenceHit }) {
  const r = hit.record as PrintedRecord,
    n = hit.notice
  return (
    <article className="evidence-card">
      <div className="evidence-heading">
        <div>
          <div className="section-kicker">
            <BookOpen size={16} />
            Source evidence
          </div>
          <h2>{r.classification}</h2>
        </div>
        <span className="locator">
          Page {r.page} · Row {r.row}
        </span>
      </div>
      {r.remarks && <p className="notice-remark">{r.remarks}</p>}
      {!!hit.attention.length && (
        <p className="alert-text">
          Check {hit.attention.map((k) => labels[k].toLowerCase()).join(', ')}{' '}
          against the original pack.
        </p>
      )}
      <table className="comparison">
        <caption className="sr-only">
          Comparison of reviewed details with notice page {r.page}, row {r.row}
        </caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Your pack</th>
            <th scope="col">Published notice</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              'product',
              'batch',
              'strength',
              'manufacturer',
              'mfg',
              'expiry',
            ] as FieldKey[]
          ).map((key) => {
            const c = hit.fields.find((f) => f.field === key)!,
              attention = hit.attention.includes(key)
            const tag = attention
              ? 'Check detail'
              : {
                  match: 'Agrees',
                  similar: 'Check detail',
                  different: 'Differs',
                  missing: 'Missing on pack',
                  unavailable: 'Not listed',
                }[c.status]
            return (
              <tr className={attention ? 'row-attention' : ''} key={key}>
                <th scope="row">{labels[key]}</th>
                <td>
                  <span className={key === 'batch' ? 'mono' : ''}>
                    {c.yourValue || 'Not supplied'}
                  </span>
                </td>
                <td>
                  <span className={key === 'batch' ? 'mono' : ''}>
                    {c.noticeValue || 'Not specified'}
                  </span>
                  <small
                    className={
                      'compare-tag ' + (tag === 'Agrees' ? 'agree' : '')
                    }
                  >
                    {tag === 'Agrees' ? <Check size={12} /> : null}
                    {tag}
                  </small>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="citation">
        <strong>{n.title}</strong>
        <p>
          {n.authority} · Published {dateLabel(n.date)} · Page {r.page}, row{' '}
          {r.row}
        </p>
        {r.printedProduct && (
          <p>
            <b>Product cell as printed</b> {r.printedProduct}
          </p>
        )}
        {r.printedManufacturer && (
          <p>
            <b>Manufacturer cell as printed</b> {r.printedManufacturer}
          </p>
        )}
        {r.reason && (
          <p>
            <b>Published reason</b> {r.reason}
          </p>
        )}
        <a
          className="source-link"
          href={noticeHref(n.url) + (n.url.endsWith('.pdf') ? '#page=' + r.page : '')}
          target="_blank"
          rel="noreferrer"
        >
          Open original notice <ExternalLink size={14} />
        </a>
        {n.localPdf && (
          <a
            className="source-link local-copy"
            target="_blank"
            rel="noreferrer"
            href={noticeHref(n.localPdf) + '#page=' + r.page}
          >
            View offline PDF
          </a>
        )}
        <span className="print-url">{noticeHref(n.url)}</span>
      </div>
    </article>
  )
}
export function Result({
  finding,
  fields,
  origins,
  uncertain,
  read,
  edit,
  retry,
  start,
  source,
}: {
  finding: Finding
  fields: PackFields
  origins: FieldOrigins
  uncertain: FieldKey[]
  read: PackRead | null
  edit: () => void
  retry: () => void
  start: () => void
  source: () => void
}) {
  const f = finding,
    warning = ['match', 'possible'].includes(f.state),
    missing = order.filter((k) => !fields[k].trim())
  const Icon = warning ? CircleAlert : f.state === 'none' ? FileSearch : Info
  return (
    <section className="report">
      <div className="report-kicker section-kicker">
        <ClipboardList size={16} />
        {f.coverage.kind === 'demo'
          ? 'Fictional demo report'
          : 'Medicine pack report'}
      </div>
      <div className={'finding ' + (warning ? 'attention' : '')}>
        <span className="finding-icon">
          <Icon size={28} />
        </span>
        <div>
          <h1>{f.title}</h1>
          <p>{f.explanation}</p>
        </div>
      </div>
      {f.hits.map((h) => (
        <EvidenceTable
          key={h.notice.id + '-' + h.record.page + '-' + h.record.row}
          hit={h}
        />
      ))}
      <div className="next-step">
        <div>
          <h2>Next step</h2>
          <p>{f.nextStep}</p>
          {f.state === 'insufficient' && f.missing.length > 0 && (
            <p>
              Review{' '}
              {f.missing.map((k) => labels[k].toLowerCase()).join(' and ')}.
            </p>
          )}
          {f.state === 'unavailable' && (
            <a href={cdsco} target="_blank" rel="noreferrer">
              Open CDSCO alerts index
            </a>
          )}
        </div>
        <div className="actions">
          {f.state === 'unavailable' && (
            <button className="btn secondary" onClick={retry}>
              <RotateCcw />
              Retry check
            </button>
          )}
          <button className="btn primary" onClick={() => window.print()}>
            <Printer />
            Print or save report
          </button>
          <button className="btn secondary" onClick={edit}>
            <PencilLine />
            Edit details
          </button>
        </div>
      </div>
      <div className="report-grid">
        <section className="report-part">
          <h2>
            <CalendarDays />
            Expiry and uncertainties
          </h2>
          <p className={f.expiry.state === 'expired' ? 'alert-text' : ''}>
            <strong>
              {f.expiry.state === 'expired' ? 'Expired pack. ' : ''}
            </strong>
            {f.expiry.message}
          </p>
          {missing.length > 0 && (
            <p>
              <strong>Missing fields</strong> ·{' '}
              {missing.map((k) => labels[k]).join(', ')}
            </p>
          )}
          {uncertain.filter((k) => fields[k]).length > 0 && (
            <p>
              <strong>Unconfirmed readings</strong> ·{' '}
              {uncertain
                .filter((k) => fields[k])
                .map((k) => labels[k])
                .join(', ')}
            </p>
          )}
          {f.conflicts.map((c, i) => (
            <p className="alert-text" key={i}>
              <b>{labels[c.field]} differs in the code.</b> Printed:{' '}
              {c.printed || 'unreadable'}. Encoded: {c.encoded}.
            </p>
          ))}
          <ReviewedCodeDifferences fields={fields} read={read} />
          <p>
            Packaging and public alerts alone cannot establish whether this
            individual pack is authentic.
          </p>
        </section>
        <section className="report-part">
          <h2>
            <BookOpen />
            Source coverage
          </h2>
          <p>
            <b>
              {f.coverage.kind === 'demo'
                ? 'Fictional demo collection'
                : 'CDSCO · India'}
            </b>
          </p>
          <p>
            {f.coverage.noticeCount}{' '}
            {f.coverage.noticeCount === 1 ? 'notice' : 'notices'} ·{' '}
            {f.coverage.recordCount} selected{' '}
            {f.coverage.recordCount === 1 ? 'row' : 'rows'} · Snapshot{' '}
            {dateLabel(f.coverage.snapshotDate)}
          </p>
          <p>{f.coverage.note}</p>
          {f.coverage.kind === 'official' && (
            <button className="text-btn" onClick={source}>
              View official sources
            </button>
          )}
        </section>
        <section className="report-part">
          <h2>
            <FileText />
            Reviewed fields
          </h2>
          <dl className="reviewed-list">
            {order.map((k) => (
              <div key={k}>
                <dt>{labels[k]}</dt>
                <dd>
                  <span className={k === 'batch' ? 'mono' : ''}>
                    {fields[k] || 'Not supplied'}
                  </span>
                  {fields[k] && origins[k] && (
                    <small>{originText[origins[k]!]}</small>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="report-part">
          <h2>
            <ListChecks />
            Checks performed
          </h2>
          <ul>
            {f.checks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p>
            Checked{' '}
            {new Intl.DateTimeFormat('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Kolkata',
            }).format(new Date(f.checkedAt))}{' '}
            IST
          </p>
          {read && <Codes read={read} />}
        </section>
      </div>
      <div className="report-actions">
        <button className="btn secondary" onClick={start}>
          <ScanLine />
          Check a new pack
        </button>
      </div>
    </section>
  )
}
