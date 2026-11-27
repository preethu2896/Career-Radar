import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, ExternalLink, LockKeyhole, MapPin, Search, Check, BriefcaseBusiness } from 'lucide-react'
import { Stage, Window, Field, Button, Badge, Card, Row, Roll, Bar, States, type Act } from './vendor/index.js'
import './career-demo.css'

type Scene = { query: string; focused: boolean; located: boolean; page: number; unlocked: boolean; resetting: boolean }
const initial: Scene = { query: '', focused: false, located: false, page: 0, unlocked: false, resetting: false }
const poster: Scene = { ...initial, query: 'Frontend Developer', located: true, page: 4, unlocked: true }

async function journey(a: Act<Scene>) {
  a.mark('search')
  await a.wait(550)
  await a.click({ at: 'search', x: .86, y: .5 })
  await a.set({ focused: true })
  await a.type('query', 'Frontend Developer', { interval: 32 })
  await a.click({ at: 'bengaluru', x: .86, y: .5 })
  await a.set({ located: true, focused: false })
  await a.wait(400)
  await a.click({ at: 'role', x: .88, y: .5 })
  await a.set({ page: 1 })
  a.mark('role')
  await a.move('rest')
  await a.wait(950)
  await a.click({ at: 'apply', x: .85, y: .5 })
  await a.set({ page: 2 })
  a.mark('sign-in')
  await a.wait(700)
  await a.click({ at: 'sign-in', x: .85, y: .5 })
  await a.set({ page: 3 })
  a.mark('access')
  await a.move('rest')
  await a.wait(1100)
  await a.click({ at: 'unlock', x: .86, y: .5 })
  await a.set({ unlocked: true })
  a.mark('unlocked')
  await a.wait(650)
  await a.click({ at: 'employer', x: .86, y: .5 })
  await a.set({ page: 4 })
  a.mark('employer')
  await a.move('rest')
  await a.wait(2200)
  // Restart behind a brief body fade. Chrome stays as the visual anchor;
  // neither search text nor access entitlement rewinds while visible.
  await a.set({ resetting: true })
  a.mark('reset')
  await a.wait(300)
  await a.snap({ ...initial, resetting: true }, 'workflow-body')
  a.place('rest')
  await a.wait(80)
  await a.set({ resetting: false })
  await a.wait(300)
}

function JobCard({ main = false }: { main?: boolean }) {
  return <Card pad="large" className="cr-demo-job">
    <Row pad={0} title={main ? 'Frontend Developer' : 'Frontend Engineer'} subtitle="Company careers" />
    <div className="cr-demo-tags"><Badge>Onsite</Badge><Badge>React</Badge><Badge>TypeScript</Badge></div>
    <div className="cr-demo-job-foot"><span><MapPin size={14} /> Bengaluru, India</span>{main && <Button variant="ghost" data-target="role" data-cursor="hand" trailingIcon={<ArrowRight size={14} />}><span>View role</span></Button>}</div>
  </Card>
}

export default function CareerDemo() {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)')
    const update = () => setTouch(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <div className="cr-demo-illustration" aria-hidden="true" {...{ inert: '' }}>
    <Stage width={1000} height={520} compact={{ below: 700, width: 358, height: 560 }}
      initial={initial} poster={poster} script={journey} play="loop"
      cursor={{ at: 'rest', style: touch ? 'touch' : 'real', idle: 1100 }}
      accent="#15372f" fidelity="realistic" className="cr-demo"
      tokens={{ '--ss-font': '"DM Sans", ui-sans-serif, system-ui, sans-serif', '--ss-text-strong': '#15372f', '--ss-text': '#58665f', '--ss-text-faint': '#69716b', '--ss-canvas': '#f4f1e8', '--ss-well': 'transparent', '--ss-radius-md': '12px', '--ss-radius-lg': '20px', '--ss-radius-sm': '999px', '--ss-control': '38px' }}>
      {(s, _rect, layout) => <DemoFrame compact={layout === 'compact'} employer={s.page === 4}>
        <div className="cr-demo-nav"><States value={s.page === 4 ? 'employer' : 'radar'} states={{ employer: <BriefcaseBusiness size={22} />, radar: <img src="/careerradar-logo.png" alt="" width={22} height={22} /> }} /><b><States value={s.page === 4 ? 'employer' : 'radar'} states={{ employer: 'Company careers', radar: 'careerradar' }} align="start" /></b><span className="cr-demo-nav-note"><States value={s.page === 4 ? 'employer' : 'radar'} states={{ employer: 'Application', radar: 'Jobs · Companies' }} align="end" /></span><span data-target="rest" className="cr-demo-rest" /></div>
        <div className="cr-demo-pages" data-target="workflow-body" data-page={s.page} data-resetting={s.resetting}>
          <div className="cr-demo-page cr-demo-discover" data-visible={s.page === 0}>
            <aside className="cr-demo-filters"><div className="cr-demo-serif">Filters</div>
              <Field label="Search jobs" value={s.query} placeholder="Job title or skill" focused={s.focused} leading={<Search size={16} />} box={{ 'data-target': 'search', 'data-typing': true }} />
              <div className="cr-demo-location"><div className="cr-demo-label">Location</div><Button data-target="bengaluru" data-cursor="hand" variant={s.located ? 'primary' : 'secondary'} icon={<MapPin size={14} />}><span>Bengaluru</span></Button></div>
              <div className="cr-demo-extra-filters"><Field label="Workplace" value="Any workplace" /><Field label="Experience" value="All experience levels" /></div>
            </aside>
            <main className="cr-demo-results"><div className="cr-demo-results-head"><div className="cr-demo-serif">Latest roles</div><span><Roll>{s.located ? 'Bengaluru' : 'Explore opportunities'}</Roll></span></div><JobCard main /><JobCard /><div className="cr-demo-filler"><Bar w={190} h={8} /><Bar w={120} h={6} /></div></main>
          </div>
          <div className="cr-demo-page cr-demo-details" data-visible={s.page === 1}>
            <div className="cr-demo-detail-main"><span className="cr-demo-label">Jobs / Company careers</span><div className="cr-demo-role-title">Frontend Developer</div><span className="cr-demo-muted">Bengaluru, India · Onsite</span><div className="cr-demo-rule" /><div className="cr-demo-serif cr-demo-section-title">About this role</div><p>Build thoughtful, accessible web experiences.</p><b className="cr-demo-subtitle">Requirements</b><ul><li>React and TypeScript</li><li>Responsive, accessible interfaces</li></ul></div>
            <Card pad="large" className="cr-demo-apply-card"><div className="cr-demo-serif">Apply for this role</div><p>Get the direct link to the employer’s application.</p><Button size="large" variant="primary" data-target="apply" data-cursor="hand" icon={<LockKeyhole size={16} />}><span>Sign in to apply</span></Button></Card>
          </div>
          <div className="cr-demo-page cr-demo-auth" data-visible={s.page === 2}>
            <div className="cr-demo-auth-copy"><div className="cr-demo-serif">Your next step starts here.</div><p>One account to unlock application links.</p><div className="cr-demo-auth-role"><BriefcaseBusiness size={20} /><div><b>Frontend Developer</b><span>Bengaluru, India</span></div></div></div>
            <Card pad="large" className="cr-demo-signin"><div className="cr-demo-serif">Welcome to CareerRadar</div><p>Sign in or create your account.</p><Button size="large" variant="primary" data-target="sign-in" data-cursor="hand" trailingIcon={<ArrowRight size={16} />}><span>Continue with Google</span></Button></Card>
          </div>
          <div className="cr-demo-page cr-demo-access" data-visible={s.page === 3}>
            <div className="cr-demo-access-heading"><div className="cr-demo-serif">Go straight to the source.</div><p>Get the direct link to the company’s original opening.</p></div>
            <Card pad="large" gap={8} className="cr-demo-link-card"><Row pad={0} title="Frontend Developer" subtitle="Bengaluru, India · Company careers" /><div className="cr-demo-rule" /><p>Continue your application with the employer.</p><Button size="large" variant="primary" data-target="unlock" data-cursor="hand" icon={<States value={s.unlocked ? 'open' : 'locked'} states={{ open: <Check size={16} />, locked: <ExternalLink size={16} /> }} />}><States value={s.unlocked ? 'ready' : 'get'} states={{ ready: 'Apply link ready', get: 'Get apply link' }} /></Button></Card>
            <div className="cr-demo-employer-link" data-visible={s.unlocked}><Button size="large" data-target="employer" data-cursor="hand" trailingIcon={<ExternalLink size={16} />}><span>Go to employer’s site</span></Button></div>
          </div>
          <div className="cr-demo-page cr-demo-handoff" data-visible={s.page === 4}>
            <div className="cr-demo-handoff-copy"><div className="cr-demo-serif">Apply directly.<br />With the employer.</div><p>Complete your application on the company’s own careers page.</p><Badge tone="accent" icon={<ExternalLink size={14} />}>Company career portal</Badge></div>
            <Card pad="large" className="cr-demo-portal"><span className="cr-demo-label">Company careers</span><Row pad={0} title="Frontend Developer" subtitle="Bengaluru, India" /><div className="cr-demo-rule" /><Field label="Full name" value="" placeholder="Your full name" /><Field label="Email address" value="" placeholder="Your email address" /><Button size="large" trailingIcon={<ArrowRight size={16} />}><span>Start your application</span></Button></Card>
          </div>
        </div>
      </DemoFrame>}
    </Stage>
  </div>
}

function DemoFrame({ compact, employer, children }: { compact: boolean; employer: boolean; children: ReactNode }) {
  return compact ? <Card flush pad="small" className="cr-demo-mobile">{children}</Card> : <Window url={<States value={employer ? 'employer' : 'radar'} states={{ employer: 'Company career portal / application', radar: 'careerradar / jobs' }} align="start" />} lights="grey" className="cr-demo-browser">{children}</Window>
}
