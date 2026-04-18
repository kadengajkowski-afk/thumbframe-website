# ThumbFrame — Complete Website Blueprint
# Feed this entire file to Claude Code. Nothing else needed.

---

## CLAUDE CODE: DO THIS FIRST

```bash
# 1. Read these skills before writing ANY code
cat /mnt/skills/public/frontend-design/SKILL.md
cat /mnt/skills/examples/theme-factory/SKILL.md
cat /mnt/skills/examples/web-artifacts-builder/SKILL.md

# 2. Install community skills
claude skill install antigravity

# 3. Install dependencies
npm install framer-motion @phosphor-icons/react

# 4. Download Satoshi font from fontshare.com/fonts/satoshi
# Place Satoshi-Variable.woff2 in public/fonts/

# 5. If Firecrawl MCP is available, scrape these for design inspiration:
# linear.app, supabase.com, vercel.com, raycast.com

# 6. If Playwright MCP is available, screenshot every page after building
# to verify it looks human-designed, not AI-generated
```

---

## THE DESIGN DIRECTION

**"Creator Dark"** — Black and orange. Dramatic. Energetic. A tool built by a creator, for creators. Think Linear's depth meets Stripe's confidence, but with ThumbFrame's orange energy.

The site has an **animated particle background** on the homepage — flowing orange curves, drifting connected particles, and pulsing glow orbs on a near-black canvas. This creates visual drama without using generic template decorations.

---

## DESIGN SYSTEM

### Font
```css
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Variable.woff2') format('woff2');
  font-weight: 300 900;
  font-display: swap;
}
```
**DO NOT use Inter, Roboto, Arial, or system fonts for headings.** Satoshi only.

### Typography Scale
```css
h1 { font-size: clamp(3rem, 5.5vw, 5.2rem); font-weight: 900; line-height: 0.98; letter-spacing: -0.045em; }
h2 { font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 800; line-height: 1.08; letter-spacing: -0.03em; }
h3 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
body, p { font-size: 16px; font-weight: 420; line-height: 1.6; color: var(--gray); }
```

### Colors
```css
:root {
  --black: #050507;
  --surface: #0c0c0f;
  --elevated: #141418;
  --subtle: #1e1e24;
  --orange: #FF6B00;
  --orange-hover: #FF8533;
  --orange-glow: rgba(255, 107, 0, 0.25);
  --orange-subtle: rgba(255, 107, 0, 0.07);
  --white: #f0f0f3;
  --gray: #8a8a93;
  --dim: #55555e;
  --border: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(255, 255, 255, 0.12);
}
```
**ONE accent color: orange. Used only for CTAs, highlights, and key moments. Everything else is neutral grays on black.**

### Grain Overlay (add to body::after)
```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.022;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### Animated Background (HOMEPAGE ONLY)
The homepage has a full-screen `<canvas>` element behind all content with three layers:

**Layer 1 — Space spiral:** A galaxy-like spiral on the RIGHT side of the hero area. 3 spiral arms made of ~600 small orange particles orbiting a center point. Each arm follows a logarithmic spiral path (r = dist * e^(b*theta)). The spiral is horizontally stretched (1.3x) and vertically compressed (0.7x) to create a tilted galaxy perspective. Particles vary in hue from 18-40 (orange range) and brightness (0.05-0.35 opacity). The entire spiral rotates slowly.

**Layer 2 — Core glow:** A radial gradient at the spiral center (orange, 0.09 opacity at center fading to transparent). Plus a larger nebula glow around it (0.025 opacity, 500px radius). Creates the "bright center of the galaxy" effect.

**Layer 3 — Orbiting stars:** ~200 individual stars orbiting the spiral center at various distances. They twinkle (opacity oscillates with sin wave). Some have warm orange tint, some are nearly white. 3 arms, various depths (z value affects size and brightness).

**Layer 4 — Background stars:** 80 tiny static dots scattered across the entire page with very low opacity (0.03-0.18), creating a star field. They subtly twinkle.

**Layer 5 — Flow lines:** 4 subtle sinusoidal curves in the LOWER sections of the page (below the hero) that drift horizontally. These provide visual continuity as users scroll past the spiral into the content sections.

```javascript
// Canvas setup
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = document.documentElement.scrollHeight;
// Position: fixed, inset: 0, z-index: 0, pointer-events: none

// Particle class — each has: x, y, size (0.3-2px), speedX/Y, opacity, 
// hue (20-40 = orange range), sine-wave drift, fade in/out lifecycle

// Flow lines — 5 curves using nested sin/cos with slow phase increment
// Orbs — radial gradients with pulsing opacity via sin(time)

// All layers account for scroll offset via window.scrollY parallax
// requestAnimationFrame loop
```

The full implementation is in the preview file. Copy the entire `<script>` block.

### Animations (Framer Motion)
```jsx
// Stagger entrance — use on every section
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

<motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
  <motion.h2 variants={fadeUp}>...</motion.h2>
</motion.section>
```

### Custom Easing (NEVER use default `ease`)
```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-snap: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.68, -0.6, 0.32, 1.6);
```

### Icons: Phosphor (NOT Lucide)
```jsx
import { Lightning, Eye, Palette, ArrowRight, Scissors, TextT } from '@phosphor-icons/react';
```

---

## PAGE-BY-PAGE SPECIFICATION

### Navbar (all public pages)
```
[🟠T ThumbFrame]   Features  Gallery  Pricing  About     [Log in]  [🟠 Get Started →]
```
- `position: sticky`, glassmorphism: `backdrop-filter: blur(24px); background: rgba(5,5,7,0.7)`
- Border-bottom: `1px solid rgba(255,255,255,0.05)`
- "Get Started →" = solid orange gradient button with glow shadow
- When logged in: replace right side with avatar circle → dropdown (Account, Editor, Log out)
- Mobile: hamburger → full-screen overlay

### Homepage (/)
This is the hero page with the animated canvas background.

**Section 1: Hero (asymmetric left-right layout — NOT centered)**
- Layout: `display: flex; gap: 60px; align-items: center;` Left = text, Right = visual
- LEFT SIDE:
  - Badge pill: `Built for YouTube creators` with pulsing orange dot
  - Headline: `CREATE THUMBNAILS THAT GET CLICKED.` — massive Satoshi 900, "GET CLICKED" in orange with text-shadow glow
  - Thin subline: `/ the Photoshop replacement for creators /` (weight 400, gray, smaller)
  - Body text + CTA buttons + micro-copy
- RIGHT SIDE:
  - Editor mockup card (dark bg, rounded, mock toolbar + sidebar + thumbnail canvas)
  - 3 floating glassmorphism cards overlapping the mockup at staggered delays:
    - "A/B Testing" feature card (top-right)
    - "2x faster" stat card (vs Photoshop)
    - "AI Cutout" mini card (mid-right)
- The animated space spiral fills the background BEHIND both sides

**Section 2: Marquee**
- Scrolling horizontal ticker: `AI Background Removal · Smart Text · A/B Testing · One-Click Export · YouTube Optimized · Brush Tools · Layer System · Clone Stamp`
- Orange dots between items
- `animation: marquee 30s linear infinite`
- Subtle border-top and border-bottom

**Section 3: Features (Bento Grid)**
- Section label: `FEATURES` (orange, uppercase, small)
- Section title: `Everything you need. Nothing you don't.`
- Bento grid layout (NOT identical cards):
  - Wide card (2 columns): Professional editor
  - Regular card: AI background removal (Pro tag)
  - Regular card: Smart text engine (Free tag)
  - Regular card: A/B testing (Pro tag)
  - Regular card: 12 brush tools (Free tag)
- Each card: icon box (orange-subtle bg), tag pill, title, description
- Hover: border goes orange-tinted, translateY(-4px), subtle box-shadow
- Some cards have a radial orange glow in the corner

**Section 4: Stats**
- 3 stats centered: `50+` Active creators / `2,400+` Thumbnails created / `15 min` Avg creation time
- Numbers in large orange with text-shadow glow

**Section 5: Testimonials**
- Section label: `What creators are saying` (small, muted, uppercase)
- 2-column grid of quote cards
- These should feel like real people typing casually — NOT polished marketing quotes:

```
"lol i used to spend like 2 hours per thumbnail in photoshop. 
made one in thumbframe in 20 min last night and it lowkey 
looks better??"
— @creativewithcass · 8K subs

"the background remover is actually insane. 
tried it on a super messy background and it 
just... worked. no cleanup needed."
— u/editjunkie42 · r/NewTubers

"ok real talk i was skeptical bc $15/mo but my CTR 
went from like 4% to 8% in two weeks. the A/B testing 
feature is the reason."
— @jakeplaysgames · 34K subs

"i literally cancelled my photoshop subscription. 
this does everything i was using it for and the 
interface doesn't make me want to cry"
— @daniielcreates · 5K subs
```

- First card gets a subtle orange-tinted left border to draw the eye
- Show platform origin (@ for twitter/youtube, u/ for reddit) — makes it feel real and verifiable
- Cards use same dark surface style as bento cards

**Section 6: Final CTA**
- `Stop overthinking your thumbnails.`
- `Join 50+ creators who make better thumbnails in less time.`
- `[🟠 Create Your First Thumbnail — Free]`
- Orange glow orb behind

**Section 7: Footer**
- 4-column grid: ThumbFrame (brand + description) / Product / Resources / Company
- `© 2024-2026 ThumbFrame. Built with ☕ by Kaden.`

### Pricing (/pricing)
- Title: `Simple, honest pricing.`
- Subtitle: `Free to start. Upgrade when you're ready. Cancel anytime.`
- Two cards side by side:
  - **Starter** — $0/forever, basic features, ghost "Get Started" button
  - **Pro** — $15/mo, orange border, "Most Popular" badge, orange "Upgrade to Pro" button, glow shadow
- Feature checklist with ✓ on each
- FAQ accordion below
- ALL upgrade/pro buttons call `handleUpgrade()`

### Features (/features)
- Bento grid of all features with icons, descriptions, Free/Pro tags
- Same card style as homepage bento but more items

### About (/about)
- Kaden's real story: built ThumbFrame because making Minecraft thumbnails was painful
- Written in first person, casual voice
- Mission, what's next, roadmap

### Gallery (/gallery)
- **Logged in:** User's saved projects as clickable cards (thumbnail preview, name, last edited)
- **Logged out:** Example thumbnail placeholders with "Sign up to save your projects" CTA

### Login (/login)
- Dark centered card with subtle orange glow behind
- Fields: Email, Password
- Orange "Log in" button
- `— or —` divider
- Google OAuth button
- "Don't have an account? Sign up →"
- On success: `localStorage.setItem('thumbframe_token', token)` + redirect to /editor

### Signup (/signup)
- Same layout as login but with Confirm Password field
- On success: create account, store token, redirect to /editor

### Account (/account) — Protected route
- **Profile:** Email, member since
- **Subscription:** Current plan badge (Free or Pro), next billing date if Pro
  - If Free: `[🟠 Upgrade to Pro — $15/mo]` → `handleUpgrade()`
  - If Pro: `[Manage Subscription]` → opens Stripe Customer Portal
- **Usage:** Exports this month, projects saved
- **Danger Zone:** Log out, Delete account

### 404 Page
- Fun "thumbnail not found" message
- Link back to homepage

---

## STRIPE CHECKOUT (fixes "checkout failed")

### The ONE checkout function (every Pro button uses this):
```javascript
// src/utils/checkout.js
export async function handleUpgrade() {
  const token = localStorage.getItem('thumbframe_token');
  if (!token) { window.location.href = '/signup?redirect=pricing'; return; }

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { alert('Checkout failed — please try again.'); return; }
    const { url } = await res.json();
    window.location.href = url;
  } catch (err) { alert('Unable to start checkout.'); }
}
```

**EVERY button that says Pro, Upgrade, Go Pro, or Unlock calls `handleUpgrade()`. One function. Everywhere. No exceptions.**

### Backend:
```javascript
// CRITICAL: webhook BEFORE express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  switch (event.type) {
    case 'checkout.session.completed':
      // Save stripeCustomerId, set plan='pro', status='active'
      break;
    case 'customer.subscription.deleted':
      // Set plan='free', status='canceled'
      break;
    case 'invoice.payment_failed':
      // Set status='past_due'
      break;
  }
  res.json({ received: true });
});

app.use(express.json()); // AFTER webhook

app.post('/api/create-checkout-session', auth, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    customer: req.user.stripeCustomerId || undefined,
    customer_email: !req.user.stripeCustomerId ? req.user.email : undefined,
    success_url: `${process.env.FRONTEND_URL}/account?checkout=success`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing`,
    metadata: { userId: req.user.id },
    subscription_data: { metadata: { userId: req.user.id } },
  });
  res.json({ url: session.url });
});

app.post('/api/create-portal-session', auth, async (req, res) => {
  const session = await stripe.billingPortal.sessions.create({
    customer: req.user.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/account`,
  });
  res.json({ url: session.url });
});
```

### CORS (Vercel frontend ↔ Railway backend):
```javascript
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
```

### Environment Variables:
**Railway:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` (price_1TDBAZ3mqlVOEamgeLLrXeoW), `FRONTEND_URL` (https://thumbframe.com, no trailing slash), `JWT_SECRET`
**Vercel:** `VITE_API_URL` (Railway URL, no trailing slash), `VITE_STRIPE_PUBLISHABLE_KEY`
**CRITICAL:** If secret key is `sk_test_*`, price ID must be test-mode. If `sk_live_*`, price must be live-mode. Mixing = "checkout failed" every time.

---

## AUTH PERSISTENCE (fixes login not staying)

```javascript
// AuthProvider — wraps ENTIRE app
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('thumbframe_token');
    const saved = localStorage.getItem('thumbframe_user');
    if (token && saved) {
      setUser(JSON.parse(saved));
      fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(u => { setUser(u); localStorage.setItem('thumbframe_user', JSON.stringify(u)); })
        .catch(() => { localStorage.clear(); setUser(null); })
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  const logout = () => { localStorage.clear(); setUser(null); };
  if (loading) return <LoadingSpinner />;
  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}
```

**Login/signup success must do:**
```javascript
localStorage.setItem('thumbframe_token', data.token);
localStorage.setItem('thumbframe_user', JSON.stringify(data.user));
```

**Backend needs `/api/me`:**
```javascript
app.get('/api/me', auth, async (req, res) => {
  const user = await getUserById(req.user.id);
  res.json({ id: user.id, email: user.email, plan: user.plan || 'free', stripeCustomerId: user.stripeCustomerId, createdAt: user.createdAt });
});
```

**Router structure:**
```jsx
<AuthProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/features" element={<Features />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
</AuthProvider>
```

---

## COPY GUIDELINES

**Never use:** delve, harness, leverage, seamlessly, cutting-edge, game-changer, empower, best-in-class, all-in-one, next-generation, robust, scalable, innovative, revolutionary, unlock your potential

**Write like Kaden — a 20-year-old creator talking to other creators:**
- "Stop wasting hours on thumbnails" NOT "Optimize your content workflow"
- "Built this because Photoshop is overkill for a 1280×720 image" NOT "We identified a market gap"
- "Free. For real." NOT "Experience our generous freemium offering"

---

## DO NOT TOUCH

- The editor (canvas, tools, panels, toolbar, workspace)
- Brush.js and all paint tools
- Rim Light (works perfectly)
- Liquify, Remove BG, Smart Cutout, Lasso Mask
- The ThumbFrame logo (orange background, white "T")

---

## EXECUTION ORDER

```
Phase 0: Read skills + install deps
  → Read all skill files listed above
  → Install framer-motion, @phosphor-icons/react
  → Download Satoshi font
  → Set up CSS variables and grain overlay
  → COMMIT: "setup: design system, Satoshi font, dependencies"

Phase 1: Fix auth
  → AuthProvider with localStorage + loading state
  → /api/me endpoint
  → Wrap entire app in AuthProvider
  → VERIFY: login → refresh → still logged in
  → COMMIT: "fix: auth persistence"

Phase 2: Fix Stripe
  → CORS config
  → Webhook route BEFORE express.json()
  → Create handleUpgrade() in src/utils/checkout.js
  → Wire ALL pro buttons to handleUpgrade()
  → Portal endpoint
  → VERIFY: click Pro → Stripe opens → payment succeeds
  → COMMIT: "fix: Stripe checkout"

Phase 3: Build functional pages
  → Login (stores token, redirects)
  → Signup (creates account, stores token, redirects)
  → Account (plan, usage, manage sub)
  → VERIFY with Playwright screenshots
  → COMMIT: "feat: auth pages and account"

Phase 4: Build public pages with animated background
  → Animated canvas background (particles + flow lines + orbs)
  → Navbar with glassmorphism
  → Homepage (hero + marquee + bento features + stats + CTA + footer)
  → Pricing page
  → Features page
  → About page (Kaden's story)
  → Gallery page
  → 404 page
  → VERIFY each page with Playwright at 1440px + 375px
  → COMMIT per page

Phase 5: Polish
  → Mobile responsive (375px, 768px, 1024px, 1440px)
  → SEO meta tags + Open Graph
  → Performance (WebP, lazy load, font-display: swap)
  → Test full flow: visit → signup → login → editor → go pro → manage sub
  → COMMIT: "polish: responsive, SEO, performance"
```

Every page uses the same design system. Every Pro button calls the same function. The editor is off-limits. Read the skills first.
