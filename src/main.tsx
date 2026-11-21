import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BookOpen,
  FlaskConical,
  LockKeyhole,
  Menu,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import {
  Brand,
  DemoPicker,
  GuideSteps,
  Home,
  Modal,
  Privacy,
  Sources,
  WorkflowSteps,
} from './ui'
import { Capture } from './Capture'
import { Review, type FieldOrigins } from './Review'
import { Result } from './Result'
import {
  checkPack,
  emptyFields,
  isAlertDataset,
  type AlertDataset,
  type DatasetKind,
  type FieldKey,
  type Finding,
} from './evidence'
import { prepareImage, readPack, type PackRead } from './reader'
import './style.css'

type Page = 'home' | 'capture' | 'review' | 'result'
type Dialog = 'sources' | 'privacy' | 'demos' | 'how' | 'menu' | null
async function loadSnapshot(kind: DatasetKind) {
  try {
    const res = await fetch('./data/' + kind + '.json', { cache: 'no-store' })
    if (!res.ok) return null
    const json: unknown = await res.json()
    return isAlertDataset(json, kind) ? json : null
  } catch {
    return null
  }
}
function App() {
  const [page, setPage] = useState<Page>('home'),
    [dialog, setDialog] = useState<Dialog>(null),
    [kind, setKind] = useState<DatasetKind>('official')
  const [sourceData, setSourceData] = useState<AlertDataset | null | undefined>(
      undefined,
    ),
    [offline, setOffline] = useState(!navigator.onLine)
  const [session, setSession] = useState(0)
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [read, setRead] = useState<PackRead | null>(null)
  const [fields, setFields] = useState(emptyFields),
    [origins, setOrigins] = useState<FieldOrigins>({}),
    [uncertain, setUncertain] = useState<FieldKey[]>([])
  const [busy, setBusy] = useState(''),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [finding, setFinding] = useState<Finding | null>(null)
  const ticket = useRef(0),
    controller = useRef<AbortController | null>(null),
    main = useRef<HTMLElement>(null),
    first = useRef(true)
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
  }, [page])
  useEffect(() => {
    if (dialog !== 'sources') return
    let live = true
    setSourceData(undefined)
    loadSnapshot('official').then((x) => {
      if (live) setSourceData(x)
    })
    return () => {
      live = false
    }
  }, [dialog])
  function reset(target: Page = 'home', collection: DatasetKind = 'official') {
    ++ticket.current
    controller.current?.abort()
    setSession((i) => i + 1)
    setKind(collection)
    setDialog(null)
    setPreview('')
    setFile(null)
    setRead(null)
    setFields(emptyFields())
    setOrigins({})
    setUncertain([])
    setError('')
    setProgress(0)
    setBusy('')
    setFinding(null)
    setPage(target)
  }
  function message(e: unknown) {
    return e instanceof Error
      ? e.message
      : 'The image could not be read. Try another photo or enter the details manually.'
  }
  async function pick(f: File) {
    const n = ++ticket.current
    setError('')
    setBusy('Preparing photo…')
    setFinding(null)
    setFile(null)
    try {
      const result = await prepareImage(f)
      if (n === ticket.current) setFile(result)
    } catch (e) {
      if (n === ticket.current) setError(message(e))
    } finally {
      if (n === ticket.current) setBusy('')
    }
  }
  async function sample(id: string) {
    reset('capture', 'demo')
    const n = ticket.current
    setBusy('Loading demo photo…')
    try {
      const res = await fetch('./samples/' + id + '.png')
      if (!res.ok)
        throw new Error(
          'This sample could not be loaded. Choose another image.',
        )
      const blob = await res.blob()
      if (n === ticket.current)
        await pick(new File([blob], 'demo.png', { type: 'image/png' }))
    } catch (e) {
      if (n === ticket.current) {
        setBusy('')
        setError(message(e))
      }
    }
  }
  async function extract() {
    if (!file) return
    const n = ++ticket.current,
      abort = new AbortController()
    controller.current = abort
    setBusy('Reading text and codes…')
    setProgress(0)
    setError('')
    try {
      const r = await readPack(
        file,
        (p) => {
          if (n === ticket.current) setProgress(p)
        },
        abort.signal,
      )
      if (n !== ticket.current) return
      setRead(r)
      setFields(r.fields)
      setOrigins(r.origins)
      setUncertain(r.uncertain)
      setPage('review')
    } catch (e) {
      if (n === ticket.current) setError(message(e))
    } finally {
      if (n === ticket.current) setBusy('')
    }
  }
  function invalidate() {
    ++ticket.current
    setBusy('')
    setFinding(null)
  }
  function change(key: FieldKey, value: string) {
    invalidate()
    setFields((prev) => ({ ...prev, [key]: value }))
    setOrigins((prev) => ({ ...prev, [key]: 'user' }))
    setUncertain((prev) => prev.filter((k) => k !== key))
    setFinding(null)
  }
  async function check() {
    const n = ++ticket.current
    setBusy('Checking records…')
    setError('')
    const data = await loadSnapshot(kind)
    if (n !== ticket.current) return
    setFinding(
      checkPack(fields, data, {
        expectedKind: kind,
        uncertain,
        conflicts: read?.conflicts,
      }),
    )
    setBusy('')
    setPage('result')
  }
  function how() {
    setDialog(null)
    if (page === 'home')
      document
        .getElementById('how-it-works')
        ?.scrollIntoView({ behavior: 'auto' })
    else setDialog('how')
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="header-inner">
          <button
            className="brand-button"
            aria-label="MedVerify home"
            onClick={() => reset()}
          >
            <Brand />
          </button>
          <nav aria-label="Main navigation">
            <button className="nav-current" onClick={() => reset()}>
              Pack check
            </button>
            <button onClick={how}>How it works</button>
            <button onClick={() => setDialog('sources')}>Alert sources</button>
          </nav>
          <button className="local-badge" onClick={() => setDialog('privacy')}>
            <span className="status-dot" />
            On-device processing
          </button>
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setDialog('menu')}
          >
            <Menu />
          </button>
        </div>
      </header>
      {offline && (
        <div className="offline-strip">
          <WifiOff size={16} />
          Offline · Local tools and the bundled snapshot work while the local
          server is running.
        </div>
      )}
      <main
        ref={main}
        id="main"
        className={page === 'home' ? 'container home' : 'container workspace'}
        tabIndex={-1}
      >
        {page === 'home' ? (
          <Home
            scan={() => reset('capture')}
            manual={() => reset('review')}
            demo={() => setDialog('demos')}
          />
        ) : (
          <>
            <div className="workflow-top">
              <WorkflowSteps
                stage={page === 'capture' ? 0 : page === 'review' ? 1 : 2}
              />
              <div className="collection-tag">
                {kind === 'demo' ? (
                  <>
                    <FlaskConical size={15} />
                    Fictional demo{' '}
                    <button onClick={() => reset('capture')}>
                      Check a real pack
                    </button>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    Official records
                  </>
                )}
              </div>
            </div>
            {page === 'capture' && (
              <Capture
                key={session}
                preview={preview}
                busy={busy}
                progress={progress}
                error={error}
                demo={kind === 'demo'}
                pick={pick}
                read={extract}
                clear={() => reset('capture', kind)}
                manual={() => reset('review', kind)}
                cancel={() => reset()}
              />
            )}
            {page === 'review' && (
              <Review
                fields={fields}
                origins={origins}
                read={read}
                preview={preview}
                uncertain={uncertain}
                change={change}
                confirm={(key) => {
                  invalidate()
                  setUncertain((prev) => prev.filter((k) => k !== key))
                }}
                check={check}
                replace={() => reset('capture', kind)}
                checking={!!busy}
                error={error}
              />
            )}
            {page === 'result' && finding && (
              <Result
                finding={finding}
                fields={fields}
                origins={origins}
                uncertain={uncertain}
                read={read}
                edit={() => {
                  setFinding(null)
                  setPage('review')
                }}
                retry={check}
                start={() => reset('capture')}
                source={() => setDialog('sources')}
              />
            )}
          </>
        )}
      </main>
      <footer>
        <div className="container foot-inner">
          <div>
            <img src="./mark.svg" width="22" height="22" alt="" />
            <b>MedVerify</b>
            <span className="foot-divider" />
            Medicine pack screening
          </div>
          <button onClick={() => setDialog('sources')}>
            <BookOpen size={15} />
            Alert sources
          </button>
          <button onClick={() => setDialog('privacy')}>
            <LockKeyhole size={15} />
            Privacy
          </button>
        </div>
      </footer>
      {dialog && (
        <Modal
          key={dialog}
          title={
            {
              sources: 'Alert sources',
              privacy: 'On-device privacy',
              demos: 'Try a demo pack',
              how: 'How a pack check works',
              menu: 'Navigation',
            }[dialog]
          }
          close={() => setDialog(null)}
        >
          {dialog === 'sources' ? (
            <Sources data={sourceData} />
          ) : dialog === 'privacy' ? (
            <Privacy />
          ) : dialog === 'demos' ? (
            <DemoPicker
              select={sample}
              custom={() => reset('capture', 'demo')}
            />
          ) : dialog === 'how' ? (
            <GuideSteps />
          ) : (
            <div className="menu-list">
              <button onClick={() => reset()}>Pack check</button>
              <button onClick={how}>How it works</button>
              <button onClick={() => setDialog('sources')}>
                Alert sources
              </button>
              <button onClick={() => setDialog('privacy')}>Privacy</button>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
