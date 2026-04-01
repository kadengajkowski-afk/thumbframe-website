// React import — no hooks needed; all state lives in App.js

// ── Palette (mirrors App.js) ──────────────────────────────────────────────────
const C = {
  bg:      '#f5f0e8',
  bg2:     '#ede8dc',
  bg3:     '#e4ddd0',
  panel:   '#faf7f2',
  border:  '#d9d0c0',
  border2: '#c9bfaa',
  text:    '#1a1612',
  text2:   '#3d3530',
  muted:   '#8a7d6e',
  accent:  '#c45c2e',
  accent2: '#a34a22',
  accent3: '#e8784a',
  success: '#4a7c59',
  cream:   '#fdf9f4',
};

// ── Shared micro-styles ───────────────────────────────────────────────────────
const gradientBg  = 'linear-gradient(135deg, #c45c2e 0%, #f7a642 100%)';
const gradientBox = `0 4px 24px rgba(196,92,46,0.38)`;

function Label({ children }) {
  return (
    <div style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: '700', letterSpacing: '1.2px',
      textTransform: 'uppercase', color: C.accent,
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

// ── [S1] Hero ─────────────────────────────────────────────────────────────────
function Hero({ setPage }) {
  return (
    <section style={{
      background: C.bg,
      paddingTop: 100,
      paddingBottom: 80,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'center',
        }}>

          {/* Left copy */}
          <div>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 14px', borderRadius: 20,
              border: `1px solid ${C.border2}`, background: C.bg2,
              marginBottom: 28, fontSize: 12, color: C.muted, fontWeight: '500',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.success }} />
              Free to start — no credit card
            </div>

            {/* H1 */}
            <h1 style={{
              fontSize: 'clamp(34px, 4.2vw, 58px)',
              fontWeight: '900',
              lineHeight: 1.08,
              letterSpacing: '-2px',
              marginBottom: 22,
              color: C.text,
            }}>
              Stop Losing Views<br />
              to{' '}
              <span style={{
                background: gradientBg,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Bad Thumbnails.
              </span>
            </h1>

            {/* Subheadline */}
            <p style={{
              fontSize: 17, color: C.text2, lineHeight: 1.65,
              marginBottom: 36, maxWidth: 460,
            }}>
              YouTube's algorithm rewards CTR. ThumbFrame generates{' '}
              <strong style={{ color: C.text }}>3 high-stakes psychological variants</strong>{' '}
              of your thumbnail instantly — so you can A/B test before you publish and let the data decide.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                onClick={() => setPage('signup')}
                style={{
                  padding: '14px 28px', borderRadius: 9, border: 'none',
                  background: gradientBg, color: '#fff',
                  cursor: 'pointer', fontSize: 15, fontWeight: '800',
                  boxShadow: gradientBox,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(196,92,46,0.48)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradientBox; }}
              >
                Start Designing Free →
              </button>
              <a
                href="#pricing"
                style={{
                  padding: '14px 28px', borderRadius: 9,
                  border: `1.5px solid ${C.border2}`,
                  background: 'transparent', color: C.text2,
                  cursor: 'pointer', fontSize: 15, fontWeight: '600',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
              >
                See Pro Features ↓
              </a>
            </div>
            <p style={{ fontSize: 12, color: C.muted }}>No credit card. No catch.</p>
          </div>

          {/* Right — YouTube mock */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            border: `1px solid ${C.border}`,
            boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
            background: '#0f0f0f',
          }}>
            {/* Browser bar */}
            <div style={{ padding: '9px 14px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: 6, background: '#161616' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
              <div style={{ flex: 1, height: 22, borderRadius: 5, background: '#1a1a1a', marginLeft: 8, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                <span style={{ fontSize: 10, color: '#444' }}>youtube.com/feed</span>
              </div>
            </div>

            {/* YouTube-style feed */}
            <div style={{ background: '#0f0f0f', padding: '18px 18px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#ff0000', fontWeight: '800', letterSpacing: '-0.5px' }}>▶ YouTube</div>
                {['Home','Shorts','Subscriptions'].map((t, i) => (
                  <div key={i} style={{ fontSize: 10, color: i === 0 ? '#fff' : '#555', fontWeight: i === 0 ? '600' : '400' }}>{t}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>

                {/* Hero card — the viral one */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '100%', aspectRatio: '16/9', borderRadius: 7,
                    overflow: 'hidden', position: 'relative',
                    background: 'linear-gradient(135deg, #0a0a0a, #1a1a2e 40%, #4a1a6e)',
                    boxShadow: '0 6px 24px rgba(196,92,46,0.35)',
                    border: '2px solid rgba(196,92,46,0.5)',
                  }}>
                    <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,100,0,0.4), transparent)' }}/>
                    <div style={{ position:'absolute', bottom:0, left:'15%', width:50, height:78, background:'linear-gradient(to top, #c45c2e, #e8784a)', borderRadius:'50% 50% 0 0 / 40% 40% 0 0', opacity:0.9 }}/>
                    <div style={{ position:'absolute', bottom:58, left:'22%', width:25, height:25, borderRadius:'50%', background:'linear-gradient(135deg, #e8c19a, #c4956a)' }}/>
                    <div style={{ position:'absolute', top:8, right:6, left:'44%' }}>
                      <div style={{ fontSize:10, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000', lineHeight:1.1 }}>I CAN'T</div>
                      <div style={{ fontSize:10, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000', lineHeight:1.1 }}>BELIEVE</div>
                      <div style={{ fontSize:8, fontWeight:'900', color:'#ff4444', fontFamily:'Impact, sans-serif', textShadow:'1px 1px 0 #000', marginTop:1 }}>THIS WORKED</div>
                    </div>
                    <div style={{ position:'absolute', bottom:4, right:4, padding:'2px 5px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace', fontWeight:'700' }}>12:47</div>
                  </div>
                  <div style={{ display:'flex', gap:7, marginTop:7, alignItems:'flex-start' }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#c45c2e,#e8784a)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:'800' }}>Y</div>
                    <div>
                      <div style={{ fontSize:9, color:'#fff', fontWeight:'600', lineHeight:1.3 }}>I Can't Believe This Worked...</div>
                      <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
                        <span style={{ fontSize:10, color:'#fff', fontWeight:'800' }}>2.4M</span>
                        <span style={{ fontSize:8, color:'#aaa' }}>views</span>
                      </div>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:2, marginTop:2, background:'rgba(196,92,46,0.2)', border:'1px solid rgba(196,92,46,0.4)', borderRadius:8, padding:'1px 5px' }}>
                        <span style={{ fontSize:6, color:'#c45c2e', fontWeight:'800' }}>🔥 TRENDING</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div>
                  <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:7, background:'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', bottom:8, left:8 }}>
                      <div style={{ fontSize:9, fontWeight:'900', color:'#fff', fontFamily:'Impact, sans-serif', textShadow:'1px 1px 0 #000' }}>RESULTS AFTER</div>
                      <div style={{ fontSize:9, fontWeight:'900', color:'#00ff88', fontFamily:'Impact, sans-serif', textShadow:'1px 1px 0 #000' }}>30 DAYS</div>
                    </div>
                    <div style={{ position:'absolute', bottom:4, right:4, padding:'1px 4px', borderRadius:2, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace' }}>8:21</div>
                  </div>
                  <div style={{ marginTop:7 }}>
                    <div style={{ fontSize:9, color:'#fff', fontWeight:'600', lineHeight:1.3 }}>Results After 30 Days...</div>
                    <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
                      <span style={{ fontSize:9, color:'#ddd', fontWeight:'700' }}>847K</span>
                      <span style={{ fontSize:8, color:'#aaa' }}>views</span>
                    </div>
                  </div>
                </div>

                {/* Card 3 */}
                <div>
                  <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:7, background:'linear-gradient(135deg,#2c2c54,#3d3d80)', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 70% 40%, rgba(255,215,0,0.2), transparent)' }}/>
                    <div style={{ position:'absolute', top:7, left:7 }}>
                      <div style={{ fontSize:10, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000', letterSpacing:1 }}>EPIC WIN</div>
                    </div>
                    <div style={{ position:'absolute', bottom:4, right:4, padding:'1px 4px', borderRadius:2, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace' }}>6:03</div>
                  </div>
                  <div style={{ marginTop:7 }}>
                    <div style={{ fontSize:9, color:'#fff', fontWeight:'600', lineHeight:1.3 }}>The Most Epic Win Ever</div>
                    <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
                      <span style={{ fontSize:9, color:'#ddd', fontWeight:'700' }}>5.1M</span>
                      <span style={{ fontSize:8, color:'#aaa' }}>views</span>
                    </div>
                  </div>
                </div>

              </div>

              <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid #1a1a1a', textAlign:'center' }}>
                <span style={{ fontSize:9, color:'#555' }}>Your thumbnail could be here. </span>
                <span onClick={() => setPage('signup')} style={{ fontSize:9, color:'#c45c2e', fontWeight:'700', cursor:'pointer' }}>Make it now →</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ── [S2] Social Proof Strip ───────────────────────────────────────────────────
function SocialProofStrip() {
  const stats = [
    { stat: '< 2 seconds', desc: 'how long viewers decide to click' },
    { stat: '3 variants',  desc: 'generated from one design, instantly' },
    { stat: 'Brand Kit',   desc: 'your fonts & colors, auto-applied' },
    { stat: '1280×720',    desc: 'exact YouTube export spec, always' },
  ];
  return (
    <div style={{ background: C.bg2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
        {stats.map(({ stat, desc }, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '6px 16px' }}>
            <div style={{ fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 3 }}>{stat}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── [S3] A/B Engine Showcase ──────────────────────────────────────────────────
function ABEngineSection({ setPage }) {
  const variants = [
    {
      label: 'Variant A',
      trigger: 'Curiosity Gap',
      ctrLift: '+31% avg CTR',
      bg: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #2d1b69 100%)',
      textColor: '#a78bfa',
      headline: 'THE SECRET',
      sub: 'they hide from you',
      accentColor: '#7c3aed',
      glowColor: 'rgba(124,58,237,0.4)',
    },
    {
      label: 'Variant B',
      trigger: 'Social Proof',
      ctrLift: '+28% avg CTR',
      bg: 'linear-gradient(135deg, #1a3a1a 0%, #2d6a2d 50%, #1a5c1a 100%)',
      textColor: '#86efac',
      headline: '2.4M WATCHED',
      sub: 'here\'s what happened',
      accentColor: '#16a34a',
      glowColor: 'rgba(22,163,74,0.4)',
    },
    {
      label: 'Variant C',
      trigger: 'Urgency / FOMO',
      ctrLift: '+37% avg CTR',
      bg: 'linear-gradient(135deg, #3d0000 0%, #7f1d1d 50%, #c0392b 100%)',
      textColor: '#fca5a5',
      headline: 'LAST CHANCE',
      sub: 'WATCH BEFORE IT\'S GONE',
      accentColor: '#dc2626',
      glowColor: 'rgba(220,38,38,0.45)',
    },
  ];

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '90px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <Label>The A/B Variant Engine</Label>
        <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 42px)', fontWeight: '900', letterSpacing: '-1.2px', lineHeight: 1.1, marginBottom: 16, color: C.text }}>
          Generate 3 High-Stakes Variants.<br />Instantly.
        </h2>
        <p style={{ fontSize: 16, color: C.muted, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
          Each variant targets a different psychological trigger. Run them all.
          Keep the winner. Your CTR does the deciding.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {variants.map((v, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12, overflow: 'hidden',
              border: `1px solid ${C.border}`,
              background: C.panel,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.14)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Thumbnail mock */}
            <div style={{
              aspectRatio: '16/9',
              background: v.bg,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Glow */}
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 60%, ${v.glowColor}, transparent 70%)`, pointerEvents:'none' }}/>
              {/* Text */}
              <div style={{ position:'relative', textAlign:'center', zIndex:1, padding:'0 12px' }}>
                <div style={{ fontSize: 18, fontWeight:'900', color: v.textColor, fontFamily:'Impact, sans-serif', textShadow:`2px 2px 0 rgba(0,0,0,0.8), 0 0 20px ${v.accentColor}`, letterSpacing:1, lineHeight:1.1 }}>
                  {v.headline}
                </div>
                <div style={{ fontSize: 10, fontWeight:'700', color:'rgba(255,255,255,0.75)', fontFamily:'sans-serif', marginTop:4, textShadow:'1px 1px 0 rgba(0,0,0,0.9)', letterSpacing:0.5 }}>
                  {v.sub}
                </div>
              </div>
              {/* CTR badge */}
              <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.85)', border:`1px solid ${v.accentColor}66`, borderRadius:6, padding:'3px 8px' }}>
                <span style={{ fontSize:9, fontWeight:'800', color: v.textColor }}>{v.ctrLift}</span>
              </div>
              <div style={{ position:'absolute', bottom:5, right:5, padding:'1px 5px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace', fontWeight:'700' }}>12:47</div>
            </div>

            {/* Card footer */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:'700', color: C.accent, background:`${C.accent}14`, padding:'2px 8px', borderRadius:8 }}>{v.label}</span>
                <span style={{ fontSize:11, fontWeight:'700', color: C.success }}>{v.ctrLift}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:'700', color:C.text, marginBottom:2 }}>{v.trigger}</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>
                {v.trigger === 'Curiosity Gap' && 'Leaves a knowledge gap the viewer must close by clicking.'}
                {v.trigger === 'Social Proof' && 'Leverages crowd behavior — if millions watched, it must be worth it.'}
                {v.trigger === 'Urgency / FOMO' && 'Fear of missing out triggers an immediate click response.'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign:'center', marginTop:36 }}>
        <button
          onClick={() => setPage('signup')}
          style={{ padding:'13px 28px', borderRadius:9, border:'none', background:gradientBg, color:'#fff', cursor:'pointer', fontSize:14, fontWeight:'800', boxShadow:gradientBox }}
        >
          Try the A/B Engine Free →
        </button>
      </div>
    </section>
  );
}

// ── [S4] Pro Workflow Features ────────────────────────────────────────────────
function ProWorkflowSection() {
  const features = [
    {
      icon: '🎨',
      tag: 'PRO',
      title: 'Supabase-Backed Brand Kit',
      desc: 'Store your channel\'s fonts, colors, and logo once. They auto-apply to every thumbnail you create — no re-uploading, no re-selecting. Your brand, always consistent.',
    },
    {
      icon: '✂️',
      tag: 'PRO',
      title: '1-Click Subject Injection',
      desc: 'Drop in your photo. Background removed by AI in under 3 seconds. Subject placed and scaled for maximum CTR. The shocked-face placement that gets clicks — done for you.',
    },
    {
      icon: '🔤',
      tag: 'PRO',
      title: 'High-CTR Typography',
      desc: 'Impact. Contrast. Hierarchy. The exact type system used by channels with 1M+ views. Pre-configured text styles proven to stop the scroll and force the click.',
    },
  ];

  return (
    <section style={{ background: C.bg2, borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'90px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <Label>Pro Workflow</Label>
          <h2 style={{ fontSize:'clamp(26px,3.2vw,42px)', fontWeight:'900', letterSpacing:'-1.2px', lineHeight:1.1, marginBottom:14, color:C.text }}>
            Built for creators who ship every week.
          </h2>
          <p style={{ fontSize:16, color:C.muted, maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
            Every Pro feature eliminates a task you were doing manually. Spend your time on content, not tooling.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding:28, borderRadius:12,
              border:`1px solid ${C.border}`, background:C.panel,
              position:'relative',
              transition:'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ position:'absolute', top:16, right:16, fontSize:9, background:gradientBg, color:'#fff', padding:'2px 8px', borderRadius:10, fontWeight:'800', letterSpacing:'0.5px' }}>
                {f.tag}
              </div>
              <div style={{ fontSize:28, marginBottom:14 }}>{f.icon}</div>
              <div style={{ fontSize:15, fontWeight:'800', color:C.text, marginBottom:8, letterSpacing:'-0.3px' }}>{f.title}</div>
              <div style={{ fontSize:13, color:C.muted, lineHeight:1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── [S5] Pricing Grid ─────────────────────────────────────────────────────────
function PricingSection({ setPage, onCheckout }) {
  return (
    <section id="pricing" style={{ maxWidth:800, margin:'0 auto', padding:'90px 24px' }}>
      <div style={{ textAlign:'center', marginBottom:48 }}>
        <Label>Pricing</Label>
        <h2 style={{ fontSize:'clamp(26px,3.2vw,42px)', fontWeight:'900', letterSpacing:'-1.2px', marginBottom:12, color:C.text }}>
          Two tiers. No tricks.
        </h2>
        <p style={{ fontSize:16, color:C.muted }}>Start free. Upgrade when you're ready to win.</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

        {/* Starter — Free */}
        <div style={{ padding:32, borderRadius:14, border:`1px solid ${C.border}`, background:C.panel }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:'700', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8 }}>Starter</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
            <span style={{ fontSize:44, fontWeight:'900', letterSpacing:'-2px', color:C.text }}>$0</span>
          </div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:24 }}>free forever</div>
          <button
            onClick={() => setPage('signup')}
            style={{ width:'100%', padding:'12px', borderRadius:8, border:`1.5px solid ${C.border2}`, background:'transparent', color:C.text, cursor:'pointer', fontSize:14, fontWeight:'700', marginBottom:24, transition:'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border2}
          >
            Start for free
          </button>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              'Full editor',
              'All shapes & text tools',
              'Mobile stamp test',
              'YouTube safe zones overlay',
              'Background remover',
              'PNG & JPG export at 1280×720',
              'Unlimited designs',
            ].map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.text2 }}>
                <span style={{ color:C.success, fontSize:11, fontWeight:'800' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>

        {/* Pro Creator — $15/mo */}
        <div style={{ padding:32, borderRadius:14, border:`2px solid ${C.accent}`, background:C.panel, position:'relative', overflow:'hidden' }}>
          {/* Top accent line */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:gradientBg }} />
          <div style={{ position:'absolute', top:14, right:14, fontSize:9, background:gradientBg, color:'#fff', padding:'3px 9px', borderRadius:10, fontWeight:'800' }}>MOST POPULAR</div>

          <div style={{ fontSize:11, color:C.accent, fontWeight:'700', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8 }}>Pro Creator</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
            <span style={{ fontSize:44, fontWeight:'900', letterSpacing:'-2px', color:C.text }}>$15</span>
            <span style={{ fontSize:14, color:C.muted }}>/month</span>
          </div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:24 }}>cancel anytime</div>
          <button
            onClick={onCheckout}
            style={{ width:'100%', padding:'12px', borderRadius:8, border:'none', background:gradientBg, color:'#fff', cursor:'pointer', fontSize:14, fontWeight:'800', marginBottom:24, boxShadow:gradientBox, transition:'box-shadow 0.15s, transform 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(196,92,46,0.48)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradientBox; }}
          >
            Go Pro →
          </button>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              'Everything in Starter',
              'A/B Variant Engine (3 variants)',
              'Full Supabase Brand Kit',
              '1-click subject injection',
              'High-CTR typography system',
              'Priority support',
              'Early access to new features',
            ].map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.text2 }}>
                <span style={{ color:C.accent, fontSize:11, fontWeight:'800' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>

      </div>

      <div style={{ marginTop:20, padding:'18px 24px', borderRadius:9, background:C.bg2, border:`1px solid ${C.border}`, textAlign:'center', fontSize:13, color:C.muted }}>
        Both plans include unlimited designs and no hidden fees. Ever.
      </div>
    </section>
  );
}

// ── [S6] Final CTA Banner ─────────────────────────────────────────────────────
function FinalCTA({ setPage }) {
  return (
    <section style={{ background: C.bg2, borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'80px 24px 100px' }}>
        <div style={{
          borderRadius:14, border:`1px solid ${C.border}`, background:C.panel,
          padding:'60px 40px', textAlign:'center',
          boxShadow:'0 4px 40px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize:40, marginBottom:18 }}>🎯</div>
          <h2 style={{ fontSize:'clamp(24px,3vw,38px)', fontWeight:'900', letterSpacing:'-1px', marginBottom:14, color:C.text }}>
            Your next video deserves a thumbnail<br />that gets clicked.
          </h2>
          <p style={{ fontSize:15, color:C.muted, marginBottom:36, maxWidth:400, margin:'0 auto 36px', lineHeight:1.7 }}>
            Stop guessing. Start testing. ThumbFrame puts the data in your hands before you hit publish.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <button
              onClick={() => setPage('signup')}
              style={{ padding:'14px 30px', borderRadius:9, border:'none', background:gradientBg, color:'#fff', cursor:'pointer', fontSize:15, fontWeight:'800', boxShadow:gradientBox, transition:'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(196,92,46,0.48)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradientBox; }}
            >
              Start Designing Free →
            </button>
            <button
              onClick={() => setPage('login')}
              style={{ padding:'14px 28px', borderRadius:9, border:`1.5px solid ${C.border2}`, background:'transparent', color:C.text2, cursor:'pointer', fontSize:15, fontWeight:'600', transition:'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border2}
            >
              Log in
            </button>
          </div>
          <p style={{ fontSize:12, color:C.muted, marginTop:16 }}>No credit card. No catch. Cancel Pro anytime.</p>
        </div>
      </div>
    </section>
  );
}

// ── LandingPage (root export) ─────────────────────────────────────────────────
export default function LandingPage({ setPage, onCheckout }) {
  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      color: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Hero               setPage={setPage} />
      <SocialProofStrip />
      <ABEngineSection    setPage={setPage} />
      <ProWorkflowSection />
      <PricingSection     setPage={setPage} onCheckout={onCheckout} />
      <FinalCTA           setPage={setPage} />
    </div>
  );
}
