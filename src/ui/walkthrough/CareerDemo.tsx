import { useEffect, useState } from 'react'
import { ArrowRight, Bookmark, Check, MapPin, RotateCcw, Search, Square, Play } from 'lucide-react'
import { Stage, Window, Field, Button, Badge, Card, Row, Segmented, Roll, Bar, States, type Act } from './vendor/index.js'
import type { ReactNode } from 'react'
import './career-demo.css'

type Scene = { query: string; focused: boolean; located: boolean; page: number; saved: boolean; status: number }
const initial: Scene = { query: '', focused: false, located: false, page: 0, saved: false, status: 0 }
const poster: Scene = { query: 'Frontend Developer', focused: false, located: true, page: 2, saved: true, status: 2 }
const statuses = ['Saved', 'Preparing', 'Applied']

async function journey(a: Act<Scene>) {
  a.mark('search')
  await a.wait(700)
  await a.click({ at: 'search', x: .8, y: .5 })
  await a.set({ focused: true })
  await a.type('query', 'Frontend Developer', { interval: 42 })
  await a.wait(250)
  await a.click({ at: 'bengaluru', x: .86, y: .5 })
  await a.set({ located: true, focused: false })
  a.mark('filtered')
  await a.wait(650)
  await a.click({ at: 'role', x: .9, y: .5 })
  await a.set({ page: 1 })
  a.mark('requirements')
  await a.move('rest')
  await a.wait(1300)
  await a.click({ at: 'save', x: .85, y: .5 })
  await a.set({ saved: true })
  a.mark('saved')
  await a.wait(650)
  await a.click({ at: 'tracker', x: .85, y: .5 })
  await a.set({ page: 2 })
  a.mark('tracker')
  await a.wait(850)
  await a.click({ at: 'preparing', x: .85, y: .5 })
  await a.set({ status: 1 })
  a.mark('preparing')
  await a.wait(900)
  await a.click({ at: 'applied', x: .85, y: .5 })
  await a.set({ status: 2 })
  a.mark('applied')
  await a.move('rest')
  await a.wait(2200)
}

function SampleJob({ main = false }: { main?: boolean }) {
  return <Card pad="large" className="cr-demo-job">
    <Row pad={0} title={main ? 'Frontend Developer' : 'Frontend Engineer'} subtitle="Example company" />
    <div className="cr-demo-tags"><Badge>Onsite</Badge><Badge>React</Badge><Badge>TypeScript</Badge></div>
    <div className="cr-demo-job-foot"><span><MapPin size={14} /> Bengaluru, India</span>{main && <Button variant="ghost" data-target="role" data-cursor="hand" trailingIcon={<ArrowRight size={14} />}>View role</Button>}</div>
  </Card>
}

export default function CareerDemo() {
  const [replay, setReplay] = useState(0)
  const [still, setStill] = useState(false)
  const [compactPointer, setCompactPointer] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)')
    const update = () => setCompactPointer(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <>
    <div className="cr-demo-illustration" aria-hidden="true" {...{ inert: '' }}>
      <Stage key={`${replay}-${still}`} width={1000} height={520} compact={{ below: 700, width: 358, height: 520 }}
        initial={initial} poster={poster} {...(still ? {} : { script: journey })} play="once"
        cursor={{ at: { wide: { x: 880, y: 92 }, compact: { x: 300, y: 90 } }, style: compactPointer ? 'touch' : 'real', idle: 1300 }}
        accent="#15372f" fidelity="realistic" className="cr-demo"
        tokens={{ '--ss-font': '"DM Sans", ui-sans-serif, system-ui, sans-serif', '--ss-text-strong': '#15372f', '--ss-text': '#58665f', '--ss-text-faint': '#69716b', '--ss-canvas': '#f4f1e8', '--ss-well': 'transparent', '--ss-radius-md': '12px', '--ss-radius-lg': '20px', '--ss-radius-sm': '999px', '--ss-control': '38px' }}>
        {(s, _rect, layout) => <DemoFrame compact={layout === 'compact'}>
          <div className="cr-demo-nav"><img src="/careerradar-logo.png" alt="" width={22} height={22} /><b>careerradar</b><span className="cr-demo-nav-note">Example preview</span><span data-target="rest" className="cr-demo-rest" /></div>
          <div className="cr-demo-pages" data-page={s.page}>
            <div className="cr-demo-page cr-demo-discover" data-visible={s.page === 0}>
              <aside className="cr-demo-filters">
                <div className="cr-demo-serif">Filters</div>
                <Field label="Search jobs" value={s.query} placeholder="Job title or skill" focused={s.focused} leading={<Search size={16} />} box={{ 'data-target': 'search', 'data-typing': true }} />
                <div className="cr-demo-location"><div className="cr-demo-label">Location</div><Button data-target="bengaluru" data-cursor="hand" variant={s.located ? 'primary' : 'secondary'} icon={<MapPin size={14} />}>Bengaluru</Button></div>
                <div className="cr-demo-extra-filters"><Field label="Workplace" value="Any workplace" /><Field label="Experience" value="All experience levels" /></div>
              </aside>
              <main className="cr-demo-results"><div className="cr-demo-results-head"><div className="cr-demo-serif">Latest roles</div><span><Roll>{s.located ? 'Bengaluru' : 'Explore opportunities'}</Roll></span></div><SampleJob main /><SampleJob /><div className="cr-demo-filler" aria-hidden="true"><Bar w={190} h={8} /><Bar w={120} h={6} /></div></main>
            </div>
            <div className="cr-demo-page cr-demo-details" data-visible={s.page === 1}>
              <div className="cr-demo-detail-main"><span className="cr-demo-label">Jobs / Example company</span><div className="cr-demo-role-title">Frontend Developer</div><span className="cr-demo-muted">Bengaluru, India · Onsite</span><div className="cr-demo-rule" /><div className="cr-demo-serif cr-demo-section-title">About this role</div><p>Build thoughtful, accessible web experiences.</p><b className="cr-demo-subtitle">Requirements</b><ul><li>React and TypeScript</li><li>Responsive, accessible interfaces</li></ul></div>
              <Card pad="large" className="cr-demo-save-card"><div className="cr-demo-serif">Keep it on your radar.</div><p>Save the role. Return when you’re ready.</p><Button size="large" variant="primary" data-target="save" data-cursor="hand" icon={<States value={s.saved ? 'saved' : 'save'} states={{ saved: <Check size={16} />, save: <Bookmark size={16} /> }} />}>{s.saved ? 'Saved to tracker' : 'Save role'}</Button><Button size="large" data-target="tracker" data-cursor="hand" trailingIcon={<ArrowRight size={16} />}>Open tracker</Button></Card>
            </div>
            <div className="cr-demo-page cr-demo-tracker" data-visible={s.page === 2}>
              <div className="cr-demo-tracker-head"><div><div className="cr-demo-serif">Your next move, in view.</div><p>You update the stage as you go.</p></div><Badge tone="accent" icon={<Bookmark size={14} />}>Your tracker</Badge></div>
              <Card pad="large" className="cr-demo-tracked-role"><Row pad={0} title="Frontend Developer" subtitle="Example company · Bengaluru" /><div className="cr-demo-rule" /><div className="cr-demo-label">Application stage</div><Segmented items={statuses} value={s.status} targets={['saved-stage', 'preparing', 'applied']} cursor="hand" /><p className="cr-demo-manual">Update after applying on the employer’s site.</p></Card>
              <div className="cr-demo-timeline"><span data-done={s.status >= 0}><Bookmark size={16} /> Saved</span><i /><span data-done={s.status >= 1}><Check size={16} /> Preparing</span><i /><span data-done={s.status >= 2}><Check size={16} /> Applied</span></div>
              <div className="cr-demo-filler" aria-hidden="true"><Bar w={220} h={8} /><Bar w={150} h={6} /></div>
            </div>
          </div>
        </DemoFrame>}
      </Stage>
    </div>
    <div className="cr-walkthrough-footer"><p id="career-demo-description">Example content. Find a role, review its requirements, save it, then update your tracker. Applications happen on the employer’s site.</p><div className="cr-walkthrough-playback"><button type="button" onClick={() => { setStill(false); setReplay(n => n + 1) }}><RotateCcw size={15} />Replay</button><button type="button" aria-pressed={still} onClick={() => setStill(v => !v)}>{still ? <Play size={15} /> : <Square size={13} />}{still ? 'Play preview' : 'Show still'}</button></div></div>
  </>
}

function DemoFrame({ compact, children }: { compact: boolean; children: ReactNode }) {
  return compact ? <Card flush pad="small" className="cr-demo-mobile">{children}</Card> : <Window url="careerradar · example walkthrough" lights="grey" className="cr-demo-browser">{children}</Window>
}
