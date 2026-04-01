// ── LandingPage — Dark Mode, $1M-ARR SaaS Aesthetic ─────────────────────────
// UI/UX Skill: Style #7 Dark Mode (OLED) + Pattern #32 Hero-Centric
//              + Pattern #3 Product Demo + Pattern #8 Pricing

// ── Dark palette ─────────────────────────────────────────────────────────────
const D = {
  bg:      '#0d0d0d',
  bg2:     '#111111',
  bg3:     '#141414',
  card:    '#1a1a1a',
  border:  '#262626',
  border2: '#333333',
  text:    '#f0f0f0',
  text2:   '#c8c8c8',
  muted:   '#888888',
  accent:  '#c45c2e',
  accent2: '#f7a642',
};

const grad    = 'linear-gradient(135deg, #c45c2e 0%, #f7a642 100%)';
const gradBox = '0 4px 28px rgba(196,92,46,0.40)';


// ── [S1] Hero ─────────────────────────────────────────────────────────────────
function Hero({ setPage }) {
  return (
    <section style={{ background: D.bg, paddingTop: 96, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 64, alignItems: 'center',
        }}>

          {/* ── Left copy ── */}
          <div>
            {/* Beta badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 14px', borderRadius: 20,
              border: `1px solid ${D.border2}`,
              background: 'rgba(196,92,46,0.08)',
              marginBottom: 28, fontSize: 12, color: D.muted, fontWeight: '500',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
              Now in Beta · Free to start
            </div>

            {/* H1 */}
            <h1 style={{
              fontSize: 'clamp(34px, 4.2vw, 58px)',
              fontWeight: '900',
              lineHeight: 1.06,
              letterSpacing: '-2.5px',
              marginBottom: 24,
              color: D.text,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
              Stop Losing Views<br />
              to{' '}
              <span style={{
                background: grad,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Bad Thumbnails.
              </span>
            </h1>

            {/* Subheadline */}
            <p style={{
              fontSize: 17, color: D.text2, lineHeight: 1.7,
              marginBottom: 38, maxWidth: 460,
            }}>
              YouTube's algorithm rewards CTR. ThumbFrame generates{' '}
              <strong style={{ color: D.text }}>3 psychological A/B variants</strong>{' '}
              of your thumbnail instantly — test before you publish and let the data decide.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                onClick={() => setPage('signup')}
                style={{
                  padding: '14px 28px', borderRadius: 9, border: 'none',
                  background: grad, color: '#fff',
                  cursor: 'pointer', fontSize: 15, fontWeight: '800',
                  boxShadow: gradBox,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(196,92,46,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradBox; }}
              >
                Start Designing Free →
              </button>
              <a
                href="#pricing"
                style={{
                  padding: '14px 28px', borderRadius: 9,
                  border: `1.5px solid ${D.border2}`,
                  background: 'transparent', color: D.text2,
                  cursor: 'pointer', fontSize: 15, fontWeight: '600',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                  transition: 'border-color 0.15s, color 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = D.accent; e.currentTarget.style.color = D.accent2; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = D.border2; e.currentTarget.style.color = D.text2; }}
              >
                See Pro Features ↓
              </a>
            </div>
            <p style={{ fontSize: 12, color: D.muted }}>No credit card. No catch.</p>
          </div>

          {/* ── Right: YouTube mock ── */}
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${D.border}`,
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            background: '#0f0f0f',
          }}>
            {/* Browser chrome */}
            <div style={{ padding: '9px 14px', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: 6, background: '#161616' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => (
                <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
              ))}
              <div style={{ flex: 1, height: 22, borderRadius: 5, background: '#1a1a1a', marginLeft: 8, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                <span style={{ fontSize: 10, color: '#444' }}>youtube.com/feed</span>
              </div>
            </div>

            {/* Feed */}
            <div style={{ background: '#0f0f0f', padding: '16px 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#ff0000', fontWeight: '800' }}>▶ YouTube</span>
                {['Home','Shorts','Subscriptions'].map((t, i) => (
                  <span key={i} style={{ fontSize: 10, color: i === 0 ? '#fff' : '#555', fontWeight: i === 0 ? '600' : '400' }}>{t}</span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>

                {/* Viral card */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '100%', aspectRatio: '16/9', borderRadius: 7, overflow: 'hidden',
                    position: 'relative',
                    background: 'linear-gradient(135deg, #0a0a0a, #1a1a2e 40%, #4a1a6e)',
                    boxShadow: '0 6px 24px rgba(196,92,46,0.4)',
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
                    {/* CTR badge */}
                    <div style={{ position:'absolute', top:6, left:6, background:'rgba(0,0,0,0.85)', border:'1px solid rgba(196,92,46,0.6)', borderRadius:5, padding:'2px 6px' }}>
                      <span style={{ fontSize:8, fontWeight:'800', color:'#f7a642' }}>+34% CTR</span>
                    </div>
                    <div style={{ position:'absolute', bottom:4, right:4, padding:'1px 4px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace', fontWeight:'700' }}>12:47</div>
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:6 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:'linear-gradient(135deg,#c45c2e,#e8784a)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:'800' }}>Y</div>
                    <div>
                      <div style={{ fontSize:8, color:'#fff', fontWeight:'600', lineHeight:1.3 }}>I Can't Believe This Worked...</div>
                      <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
                        <span style={{ fontSize:9, color:'#fff', fontWeight:'800' }}>2.4M</span>
                        <span style={{ fontSize:7, color:'#aaa' }}>views</span>
                        <span style={{ fontSize:7, color:'#555' }}>•</span>
                        <span style={{ fontSize:7, color:'#c45c2e', fontWeight:'700' }}>🔥 TRENDING</span>
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
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:8, color:'#fff', fontWeight:'600', lineHeight:1.3 }}>Results After 30 Days...</div>
                    <div style={{ fontSize:7, color:'#aaa', marginTop:1 }}>847K views</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div>
                  <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:7, background:'linear-gradient(135deg,#2c2c54,#3d3d80)', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 70% 40%, rgba(255,215,0,0.2), transparent)' }}/>
                    <div style={{ position:'absolute', top:7, left:7, fontSize:10, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000', letterSpacing:1 }}>EPIC WIN</div>
                    <div style={{ position:'absolute', bottom:4, right:4, padding:'1px 4px', borderRadius:2, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace' }}>6:03</div>
                  </div>
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:8, color:'#fff', fontWeight:'600', lineHeight:1.3 }}>The Most Epic Win Ever</div>
                    <div style={{ fontSize:7, color:'#aaa', marginTop:1 }}>5.1M views</div>
                  </div>
                </div>

              </div>

              <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #1a1a1a', textAlign:'center' }}>
                <span style={{ fontSize:9, color:'#555' }}>Your thumbnail could be here. </span>
                <span
                  onClick={() => setPage('signup')}
                  style={{ fontSize:9, color:'#c45c2e', fontWeight:'700', cursor:'pointer' }}
                >Make it now →</span>
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
    { stat: '1280×720',    desc: 'exact YouTube export spec' },
  ];
  return (
    <div style={{
      background: D.bg2,
      borderTop: `1px solid ${D.border}`,
      borderBottom: `1px solid ${D.border}`,
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '28px 24px',
        display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12,
      }}>
        {stats.map(({ stat, desc }, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '6px 16px' }}>
            <div style={{
              fontSize: 17, fontWeight: '800', marginBottom: 3,
              background: grad,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>{stat}</div>
            <div style={{ fontSize: 12, color: D.muted }}>{desc}</div>
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
      headlineColor: '#a78bfa',
      headline: 'THE SECRET',
      sub: 'they hide from you',
      glowColor: 'rgba(124,58,237,0.45)',
      badgeColor: '#a78bfa',
      desc: 'Leaves a knowledge gap the viewer must close by clicking.',
    },
    {
      label: 'Variant B',
      trigger: 'Social Proof',
      ctrLift: '+28% avg CTR',
      bg: 'linear-gradient(135deg, #0a1a0a 0%, #1a3a1a 50%, #1a5c1a 100%)',
      headlineColor: '#86efac',
      headline: '2.4M WATCHED',
      sub: "here's what happened",
      glowColor: 'rgba(22,163,74,0.4)',
      badgeColor: '#86efac',
      desc: 'Leverages crowd behavior — if millions watched, it must be worth it.',
    },
    {
      label: 'Variant C',
      trigger: 'Urgency / FOMO',
      ctrLift: '+37% avg CTR',
      bg: 'linear-gradient(135deg, #1a0000 0%, #4a0000 50%, #7f1d1d 100%)',
      headlineColor: '#fca5a5',
      headline: 'LAST CHANCE',
      sub: "WATCH BEFORE IT'S GONE",
      glowColor: 'rgba(220,38,38,0.45)',
      badgeColor: '#fca5a5',
      desc: 'Fear of missing out triggers an immediate, instinctive click.',
    },
  ];

  return (
    <section style={{ background: D.bg, maxWidth: 1100, margin: '0 auto', padding: '90px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: '700',
          letterSpacing: '1.2px', textTransform: 'uppercase',
          background: grad, WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          marginBottom: 14,
        }}>
          The A/B Variant Engine
        </div>
        <h2 style={{
          fontSize: 'clamp(26px, 3.2vw, 42px)', fontWeight: '900',
          letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16, color: D.text,
        }}>
          Generate 3 High-Stakes Variants.<br />Instantly.
        </h2>
        <p style={{ fontSize: 16, color: D.muted, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
          Each variant targets a different psychological trigger. Run them all.
          Keep the winner. Your CTR does the deciding.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
        {variants.map((v, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12, overflow: 'hidden',
              border: `1px solid ${D.border}`,
              background: D.card,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${v.glowColor}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Thumbnail mock */}
            <div style={{
              aspectRatio: '16/9', background: v.bg,
              position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 60%, ${v.glowColor}, transparent 70%)` }}/>
              <div style={{ position:'relative', textAlign:'center', zIndex:1, padding:'0 12px' }}>
                <div style={{ fontSize:17, fontWeight:'900', color:v.headlineColor, fontFamily:'Impact, sans-serif', textShadow:`2px 2px 0 rgba(0,0,0,0.9), 0 0 18px ${v.glowColor}`, letterSpacing:1, lineHeight:1.1 }}>
                  {v.headline}
                </div>
                <div style={{ fontSize:9, fontWeight:'700', color:'rgba(255,255,255,0.7)', fontFamily:'sans-serif', marginTop:4, textShadow:'1px 1px 0 rgba(0,0,0,0.9)', letterSpacing:0.5 }}>
                  {v.sub}
                </div>
              </div>
              {/* CTR badge */}
              <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.88)', border:`1px solid ${v.badgeColor}44`, borderRadius:6, padding:'3px 8px' }}>
                <span style={{ fontSize:9, fontWeight:'800', color:v.badgeColor }}>{v.ctrLift}</span>
              </div>
              <div style={{ position:'absolute', bottom:5, right:5, padding:'1px 5px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:7, color:'#fff', fontFamily:'monospace', fontWeight:'700' }}>12:47</div>
            </div>

            {/* Card body */}
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:'700', color:D.accent, background:`${D.accent}18`, padding:'2px 8px', borderRadius:8 }}>{v.label}</span>
                <span style={{ fontSize:11, fontWeight:'700', color:'#4ade80' }}>{v.ctrLift}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:'800', color:D.text, marginBottom:6, letterSpacing:'-0.3px' }}>{v.trigger}</div>
              <div style={{ fontSize:12, color:D.muted, lineHeight:1.6 }}>{v.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign:'center', marginTop:36 }}>
        <button
          onClick={() => setPage('signup')}
          style={{ padding:'13px 28px', borderRadius:9, border:'none', background:grad, color:'#fff', cursor:'pointer', fontSize:14, fontWeight:'800', boxShadow:gradBox, fontFamily:'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(196,92,46,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradBox; }}
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
      title: 'Supabase-Backed Brand Kit',
      desc: "Store your channel's fonts, colors, and logo once. They auto-apply to every thumbnail you create — no re-uploading, no re-selecting. Your brand, always consistent.",
    },
    {
      icon: '✂️',
      title: '1-Click Subject Injection',
      desc: 'Drop in your photo. Background removed by AI in under 3 seconds. Subject placed and scaled for maximum CTR. The shocked-face placement that gets clicks — done for you.',
    },
    {
      icon: '🔤',
      title: 'High-CTR Typography',
      desc: 'Impact. Contrast. Hierarchy. The exact type system used by channels with 1M+ views. Pre-configured text styles proven to stop the scroll and force the click.',
    },
  ];

  return (
    <section style={{
      background: D.bg2,
      borderTop: `1px solid ${D.border}`,
      borderBottom: `1px solid ${D.border}`,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '90px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: '700',
            letterSpacing: '1.2px', textTransform: 'uppercase',
            background: grad, WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: 14,
          }}>
            Pro Workflow
          </div>
          <h2 style={{
            fontSize: 'clamp(26px, 3.2vw, 42px)', fontWeight: '900',
            letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 14, color: D.text,
          }}>
            Built for creators who ship every week.
          </h2>
          <p style={{ fontSize: 16, color: D.muted, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Every Pro feature eliminates a task you were doing manually. Spend your time on content.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                padding: 28, borderRadius: 12,
                border: `1px solid ${D.border}`,
                background: D.card,
                position: 'relative',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#c45c2e66'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = D.border; }}
            >
              {/* PRO badge */}
              <div style={{
                position: 'absolute', top: 16, right: 16,
                fontSize: 9, background: grad, color: '#fff',
                padding: '2px 8px', borderRadius: 10, fontWeight: '800', letterSpacing: '0.5px',
              }}>PRO</div>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: '800', color: D.text, marginBottom: 8, letterSpacing: '-0.3px' }}>{f.title}</div>
              <div style={{ fontSize: 13, color: D.muted, lineHeight: 1.65 }}>{f.desc}</div>
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
    <section id="pricing" style={{ background: D.bg, maxWidth: 840, margin: '0 auto', padding: '90px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: '700',
          letterSpacing: '1.2px', textTransform: 'uppercase',
          background: grad, WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          marginBottom: 14,
        }}>
          Pricing
        </div>
        <h2 style={{
          fontSize: 'clamp(26px,3.2vw,42px)', fontWeight: '900',
          letterSpacing: '-1.5px', marginBottom: 12, color: D.text,
        }}>
          Two tiers. No tricks.
        </h2>
        <p style={{ fontSize: 16, color: D.muted }}>Start free. Upgrade when you're ready to win.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* Starter */}
        <div style={{ padding: 32, borderRadius: 14, border: `1px solid ${D.border}`, background: D.card }}>
          <div style={{ fontSize: 11, color: D.muted, fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Starter</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 44, fontWeight: '900', letterSpacing: '-2px', color: D.text }}>$0</span>
          </div>
          <div style={{ fontSize: 13, color: D.muted, marginBottom: 24 }}>free forever</div>
          <button
            onClick={() => setPage('signup')}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: `1.5px solid ${D.border2}`, background: 'transparent', color: D.text, cursor: 'pointer', fontSize: 14, fontWeight: '700', marginBottom: 24, transition: 'border-color 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = D.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = D.border2}
          >
            Start for free
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Full editor',
              'All shapes & text tools',
              'Mobile stamp test',
              'YouTube safe zones overlay',
              'Background remover',
              'PNG & JPG export at 1280×720',
              'Unlimited designs',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: D.text2 }}>
                <span style={{ color: '#4ade80', fontSize: 11, fontWeight: '800' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>

        {/* Pro Creator */}
        <div style={{ padding: 32, borderRadius: 14, border: `2px solid ${D.accent}`, background: D.card, position: 'relative', overflow: 'hidden' }}>
          {/* Top gradient bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
          <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, background: grad, color: '#fff', padding: '3px 9px', borderRadius: 10, fontWeight: '800' }}>MOST POPULAR</div>

          <div style={{ fontSize: 11, color: D.accent2, fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Pro Creator</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 44, fontWeight: '900', letterSpacing: '-2px', color: D.text }}>$15</span>
            <span style={{ fontSize: 14, color: D.muted }}>/month</span>
          </div>
          <div style={{ fontSize: 13, color: D.muted, marginBottom: 24 }}>cancel anytime</div>
          <button
            onClick={onCheckout}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: grad, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: '800', marginBottom: 24, boxShadow: gradBox, transition: 'transform 0.15s, box-shadow 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(196,92,46,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradBox; }}
          >
            Go Pro →
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Everything in Starter',
              'A/B Variant Engine (3 variants)',
              'Full Supabase Brand Kit',
              '1-click subject injection',
              'High-CTR typography system',
              'Priority support',
              'Early access to new features',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: D.text2 }}>
                <span style={{ color: D.accent2, fontSize: 11, fontWeight: '800' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>

      </div>

      <div style={{ marginTop: 20, padding: '18px 24px', borderRadius: 9, background: D.bg2, border: `1px solid ${D.border}`, textAlign: 'center', fontSize: 13, color: D.muted }}>
        Both plans include unlimited designs and no hidden fees. Ever.
      </div>
    </section>
  );
}

// ── [S6] Final CTA ────────────────────────────────────────────────────────────
function FinalCTA({ setPage }) {
  return (
    <section style={{ background: D.bg2, borderTop: `1px solid ${D.border}` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{
          borderRadius: 16,
          border: `1px solid ${D.border}`,
          background: D.card,
          padding: '64px 40px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle glow behind */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:200, background:'radial-gradient(ellipse, rgba(196,92,46,0.12), transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>🎯</div>
            <h2 style={{
              fontSize: 'clamp(24px,3vw,38px)', fontWeight: '900',
              letterSpacing: '-1.2px', marginBottom: 14, color: D.text,
            }}>
              Your next video deserves a thumbnail<br />that gets clicked.
            </h2>
            <p style={{ fontSize: 15, color: D.muted, marginBottom: 36, maxWidth: 400, margin: '0 auto 36px', lineHeight: 1.7 }}>
              Stop guessing. Start testing. ThumbFrame puts the data in your hands before you hit publish.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPage('signup')}
                style={{ padding:'14px 30px', borderRadius:9, border:'none', background:grad, color:'#fff', cursor:'pointer', fontSize:15, fontWeight:'800', boxShadow:gradBox, transition:'transform 0.15s, box-shadow 0.15s', fontFamily:'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(196,92,46,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = gradBox; }}
              >
                Start Designing Free →
              </button>
              <button
                onClick={() => setPage('login')}
                style={{ padding:'14px 28px', borderRadius:9, border:`1.5px solid ${D.border2}`, background:'transparent', color:D.text2, cursor:'pointer', fontSize:15, fontWeight:'600', transition:'border-color 0.15s, color 0.15s', fontFamily:'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = D.accent; e.currentTarget.style.color = D.accent2; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = D.border2; e.currentTarget.style.color = D.text2; }}
              >
                Log in
              </button>
            </div>
            <p style={{ fontSize: 12, color: D.muted, marginTop: 16 }}>No credit card. No catch. Cancel Pro anytime.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function LandingPage({ setPage, onCheckout }) {
  return (
    <div style={{
      background: D.bg,
      minHeight: '100vh',
      color: D.text,
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
