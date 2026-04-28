require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const Replicate  = require('replicate');
const { v4: uuidv4 } = require('uuid');
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe     = require('stripe')(stripeSecretKey);
const fetch      = require('node-fetch');
const FormData   = require('form-data');
const fs         = require('fs');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const OpenAI     = require('openai');
const Anthropic  = require('@anthropic-ai/sdk');
const sharp      = require('sharp');
const { google } = require('googleapis');
const { Resend } = require('resend');
const supabase   = require('./supabaseAdminClient');
const createBrandKitRouter = require('./routes/brandKit');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'thumbframe-secret-2024';

// ── Admin config ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kadengajkowski@gmail.com';

// ── Claude model config ─────────────────────────────────────────────────────────
const CLAUDE_MODEL      = process.env.CLAUDE_MODEL      || 'claude-opus-4-20250514';
const CLAUDE_FAST_MODEL = process.env.CLAUDE_FAST_MODEL || 'claude-opus-4-5';

// ── Simple async mutex for users.json operations ────────────────────────────────
let _usersMutex = Promise.resolve();
function withUsersMutex(fn) {
  _usersMutex = _usersMutex.then(fn).catch(fn);
  return _usersMutex;
}

// ── Simple in-memory rate limiter for auth endpoints ───────────────────────────
const authAttempts = new Map();
function authRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;
  const attempts = authAttempts.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > attempts.resetAt) { attempts.count = 0; attempts.resetAt = now + windowMs; }
  attempts.count++;
  authAttempts.set(ip, attempts);
  if (attempts.count > maxAttempts) {
    return res.status(429).json({ error: 'Too many attempts, try again later' });
  }
  next();
}

const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend     = new Resend(process.env.RESEND_API_KEY);
const replicate  = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

console.log('[INIT] Supabase admin client ready:', !!process.env.SUPABASE_URL && !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY));
console.log('[INIT] Resend client ready:', !!process.env.RESEND_API_KEY);

const allowedOrigins = [
  'https://thumbframe.com',
  'https://www.thumbframe.com',
  'https://editor.thumbframe.com',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL?.trim(),
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

app.options('*', cors());

app.post('/webhook', express.raw({ type:'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Helper: given a Stripe customer ID, resolve email then update Supabase + users.json
  async function grantPro(customerEmail) {
    if (!customerEmail) return;
    const email = customerEmail.toLowerCase().trim();
    // 1. Supabase profiles — also select the user ID for step 2
    const { data: updatedRows, error: sbErr } = await supabase
      .from('profiles')
      .update({ is_pro: true, subscription_active: true })
      .ilike('email', email)
      .select('id');
    if (sbErr) console.error('[WEBHOOK] Supabase profiles grantPro failed:', email, sbErr.message);
    // 2. Supabase auth user_metadata — this is what authMiddleware reads for plan
    const userId = updatedRows?.[0]?.id;
    if (userId) {
      const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, { user_metadata: { is_pro: true } });
      if (metaErr) console.error('[WEBHOOK] user_metadata grantPro failed:', metaErr.message);
      else console.log('[WEBHOOK] grantPro: user_metadata.is_pro=true for', email, 'userId:', userId);
    } else {
      console.warn('[WEBHOOK] grantPro: no profile row found for', email, '— user_metadata not updated');
    }
    // 3. users.json (cache layer — plan also updated here for usage-count tracking)
    await withUsersMutex(() => {
      const users = loadUsers();
      if (users[email]) users[email].plan = 'pro';
      else users[email] = { email, plan: 'pro', aiUsage: { count: 0, resetAt: 0 }, created: new Date().toISOString() };
      saveUsers(users);
      console.log('[WEBHOOK] grantPro: users.json plan=pro for', email);
    });
  }

  async function revokePro(customerId) {
    if (!customerId) return;
    // 1. Look up profile (get email + id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('stripe_customer_id', customerId)
      .single();
    const email = profile?.email?.toLowerCase().trim();
    const userId = profile?.id;
    // 2. Supabase profiles
    const { error: sbErr } = await supabase
      .from('profiles')
      .update({ is_pro: false, subscription_active: false })
      .eq('stripe_customer_id', customerId);
    if (sbErr) console.error('[WEBHOOK] Supabase revokePro failed:', customerId, sbErr.message);
    // 3. Supabase auth user_metadata
    if (userId) {
      const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, { user_metadata: { is_pro: false } });
      if (metaErr) console.error('[WEBHOOK] user_metadata revokePro failed:', metaErr.message);
      else console.log('[WEBHOOK] revokePro: user_metadata.is_pro=false for', email);
    }
    // 4. users.json
    if (email) {
      await withUsersMutex(() => {
        const users = loadUsers();
        if (users[email]) { users[email].plan = 'free'; saveUsers(users); }
        console.log('[WEBHOOK] revokePro: users.json plan=free for', email);
      });
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    console.log('[WEBHOOK] checkout.session.completed — email:', email, 'mode:', session.mode);
    if (session.mode === 'subscription' && email) {
      await grantPro(email);
    }
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const status = sub.status;
    console.log('[WEBHOOK] customer.subscription.updated — status:', status, 'customer:', sub.customer);
    if (status === 'active' || status === 'trialing') {
      // Resolve email from Stripe customer object
      try {
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer?.email) await grantPro(customer.email);
      } catch (e) { console.error('[WEBHOOK] stripe.customers.retrieve failed:', e.message); }
    } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
      await revokePro(sub.customer);
    }
  } else if (event.type === 'customer.subscription.deleted') {
    console.log('[WEBHOOK] customer.subscription.deleted — customer:', event.data.object.customer);
    await revokePro(event.data.object.customer);
  }

  return res.send({ received: true });
});

app.use(express.json({ limit:'50mb' }));
app.use(express.urlencoded({ limit:'50mb', extended:true }));

// ── Serve React Frontend (MUST be before API routes) ──────────────────────────
app.use(express.static(path.join(__dirname, 'build'), {
  maxAge: 0,
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// ── Version Test Route ─────────────────────────────────────────────────────────
app.get('/version-test', (req, res) => res.send('API VERSION 2.1 IS LIVE'));

// ── File storage ───────────────────────────────────────────────────────────────
const KEYS_FILE     = path.join(__dirname,'keys.json');
const USERS_FILE    = path.join(__dirname,'users.json');
const DESIGNS_FILE  = path.join(__dirname,'designs.json');
const TEAMS_FILE    = path.join(__dirname,'teams.json');
const COMMENTS_FILE = path.join(__dirname,'comments.json');
const VERSIONS_FILE = path.join(__dirname,'versions.json');

function loadKeys(){ try{ return JSON.parse(fs.readFileSync(KEYS_FILE,'utf8')); }catch(e){ return {}; } }
function saveKeys(k){ fs.writeFileSync(KEYS_FILE,JSON.stringify(k,null,2)); }
function loadUsers(){ try{ return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }catch(e){ return {}; } }
function saveUsers(u){ fs.writeFileSync(USERS_FILE,JSON.stringify(u,null,2)); }
function loadDesigns(){ try{ return JSON.parse(fs.readFileSync(DESIGNS_FILE,'utf8')); }catch(e){ return {}; } }
function saveDesigns(d){ fs.writeFileSync(DESIGNS_FILE,JSON.stringify(d,null,2)); }
function loadTeams(){ try{ return JSON.parse(fs.readFileSync(TEAMS_FILE,'utf8')); }catch(e){ return {}; } }
function saveTeams(t){ fs.writeFileSync(TEAMS_FILE,JSON.stringify(t,null,2)); }
function loadComments(){ try{ return JSON.parse(fs.readFileSync(COMMENTS_FILE,'utf8')); }catch(e){ return {}; } }
function saveComments(c){ fs.writeFileSync(COMMENTS_FILE,JSON.stringify(c,null,2)); }
function loadVersions(){ try{ return JSON.parse(fs.readFileSync(VERSIONS_FILE,'utf8')); }catch(e){ return {}; } }
function saveVersions(v){ fs.writeFileSync(VERSIONS_FILE,JSON.stringify(v,null,2)); }
function validateKey(key){ const keys=loadKeys(); return keys[key]||null; }

async function getSupabaseUserFromRequest(req){
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if(!accessToken) return { user:null, error:'Missing authorization token' };

  const { data:{ user }, error } = await supabase.auth.getUser(accessToken);
  if(error || !user) return { user:null, error:'Invalid authorization token' };

  return { user, error:null };
}

async function authMiddleware(req,res,next){
  try{
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if(!token){
      console.error('[AUTH] No token in Authorization header');
      return res.status(401).json({error:'Missing authorization token'});
    }

    const { data:{ user }, error } = await supabase.auth.getUser(token);
    
    if(error || !user){
      console.error('[AUTH] Token verification failed:', error?.message);
      return res.status(401).json({error: `Token verification failed: ${error?.message || 'Unknown error'}`});
    }
    
    // Fast path: user_metadata.is_pro (set by webhook / force-pro for subscribers)
    let isPro = user.user_metadata?.is_pro === true;
    // Fallback: profiles table (covers users whose metadata was never written)
    if (!isPro) {
      // Try by UUID first; if schema has id as bigint this returns an error — fall back to email
      const { data: profileById, error: errById } = await supabase
        .from('profiles').select('is_pro').eq('id', user.id).maybeSingle();
      if (errById) {
        console.warn('[AUTH] profiles.id query failed (schema mismatch?):', errById.message, '— trying email');
        const { data: profileByEmail, error: errByEmail } = await supabase
          .from('profiles').select('is_pro').ilike('email', user.email).maybeSingle();
        if (errByEmail) console.warn('[AUTH] profiles.email query also failed:', errByEmail.message);
        isPro = profileByEmail?.is_pro === true;
      } else {
        isPro = profileById?.is_pro === true;
      }
      // Self-heal: stamp user_metadata so future requests skip this DB call
      if (isPro) {
        supabase.auth.admin.updateUserById(user.id, { user_metadata: { is_pro: true } })
          .then(() => console.log('[AUTH] Self-healed user_metadata.is_pro for', user.email))
          .catch(() => {});
      }
      console.log('[AUTH] profiles fallback for', user.email, '— isPro:', isPro, errById ? '(used email fallback)' : '(used id)');
    }
    req.user = { email: user.email, id: user.id, plan: isPro ? 'pro' : 'free' };
    req.userId = user.id;
    console.log('[AUTH] Middleware verified user:', user.email, 'plan:', req.user.plan);
    next();
  }catch(err){
    console.error('[AUTH] Middleware error:', err.message);
    res.status(401).json({error: `Authentication error: ${err.message}`});
    return;
  }
}

// ── AI Quota System ────────────────────────────────────────────────────────────
function getPlanQuota(plan){
  switch((plan||'free').toLowerCase()){
    case 'pro':  return{limit:150, period:'month'};
    default:     return{limit:3,   period:'day'};
  }
}

// Read-only quota check — throws if exceeded, returns remaining info
function checkQuota(email){
  const users=loadUsers();
  let user=users[email];
  if(!user){
    user={email,plan:'free',aiUsage:{count:0,resetAt:0},created:new Date().toISOString()};
  }
  const {limit,period}=getPlanQuota(user.plan);
  if(limit===Infinity) return{ok:true,remaining:Infinity};

  const now=Date.now();
  let usage=user.aiUsage||{count:0,resetAt:0};
  if(now>=(usage.resetAt||0)){
    usage={count:0,resetAt:0};
  }
  if(usage.count>=limit){
    const planLabel=(user.plan||'free').charAt(0).toUpperCase()+(user.plan||'free').slice(1);
    const msg=(!user.plan||user.plan==='free')
      ?'Free plan: 3 AI actions per day used. Upgrade to Pro for 150/month.'
      :`Pro plan limit (${limit}/${period}) reached. Contact support to discuss higher usage.`;
    return{ok:false,message:msg,code:'QUOTA_EXCEEDED'};
  }
  return{ok:true,remaining:limit-usage.count};
}

// Decrement quota after a successful AI call
function decrementQuota(email){
  return withUsersMutex(()=>{
    const users=loadUsers();
    let user=users[email];
    if(!user){
      user={email,plan:'free',aiUsage:{count:0,resetAt:0},created:new Date().toISOString()};
      users[email]=user;
    }
    const {limit,period}=getPlanQuota(user.plan);
    if(limit===Infinity) return{ok:true};

    const now=Date.now();
    let usage=user.aiUsage||{count:0,resetAt:0};
    if(now>=(usage.resetAt||0)){
      const next=new Date();
      if(period==='day'){next.setDate(next.getDate()+1);next.setHours(0,0,0,0);}
      else{next.setMonth(next.getMonth()+1);next.setDate(1);next.setHours(0,0,0,0);}
      usage={count:0,resetAt:next.getTime()};
    }
    usage.count++;
    users[email]={...user,aiUsage:usage};
    saveUsers(users);
    return{ok:true,remaining:Math.max(0,limit-usage.count)};
  });
}

// plan param comes from req.user.plan (set by authMiddleware from Supabase user_metadata)
// users.json is only used for usage counts — plan is always the authoritative value passed in
function checkAndDecrementQuota(email, plan='free'){
  const users=loadUsers();
  let user=users[email]||{email,plan,aiUsage:{count:0,resetAt:0},created:new Date().toISOString()};
  console.log('[QUOTA]',email,'plan:',plan,'usage:',user.aiUsage?.count||0);

  const {limit,period}=getPlanQuota(plan);
  if(limit===Infinity) return{ok:true};

  const now=Date.now();
  let usage=user.aiUsage||{count:0,resetAt:0};

  if(now>=(usage.resetAt||0)){
    const next=new Date();
    if(period==='day'){next.setDate(next.getDate()+1);next.setHours(0,0,0,0);}
    else{next.setMonth(next.getMonth()+1);next.setDate(1);next.setHours(0,0,0,0);}
    usage={count:0,resetAt:next.getTime()};
  }

  if(usage.count>=limit){
    const msg=plan==='free'
      ?'Free plan: 3 AI actions per day used. Upgrade to Pro for 150/month.'
      :`Pro plan limit (${limit}/${period}) reached. Contact support to discuss higher usage.`;
    return{ok:false,message:msg,code:'QUOTA_EXCEEDED'};
  }

  usage.count++;
  users[email]={...user,plan,aiUsage:usage};
  saveUsers(users);
  return{ok:true,remaining:limit-usage.count};
}

// Middleware: Pro plan required (uses req.user.plan from authMiddleware — no disk read)
function agencyMiddleware(req,res,next){
  const isPro=req.user?.plan==='pro'||req.user?.email===ADMIN_EMAIL;
  if(!isPro) return res.status(403).json({success:false,error:'Pro plan required',code:'PRO_REQUIRED'});
  next();
}

// ── Sync user quota record on login ───────────────────────────────────────────
app.post('/api/sync-user', authMiddleware, async(req,res)=>{
  const email=req.user.email;
  let resolvedPlan='free';
  try{
    const {data:profileData}=await supabase.from('profiles').select('is_pro').ilike('email',email).single();
    resolvedPlan=profileData?.is_pro?'pro':'free';
  }catch(e){ console.warn('[SYNC-USER] Supabase plan fetch failed for',email,':',e.message); }

  await withUsersMutex(()=>{
    const users=loadUsers();
    const existing=users[email];
    const prevPlan=existing?.plan||'(none)';
    if(!existing){
      users[email]={email,plan:resolvedPlan,aiUsage:{count:0,resetAt:0},created:new Date().toISOString()};
      console.log('[SYNC-USER] Created record for',email,'plan:',resolvedPlan);
    } else if(existing.plan!==resolvedPlan){
      users[email]={...existing,plan:resolvedPlan};
      console.log('[SYNC-USER] Updated plan for',email,':',prevPlan,'->',resolvedPlan);
    } else {
      console.log('[SYNC-USER] Plan already correct for',email,':',resolvedPlan);
    }
    saveUsers(users);
  });
  const users=loadUsers();
  res.json({success:true,plan:users[email]?.plan||'free',email});
});

// ── Debug: show exactly what authMiddleware reads from the token ───────────────
app.get('/api/debug-token', authMiddleware, (req,res)=>{
  res.json({ user: req.user });
});

// ── Admin: force-set a user to Pro — accepts JWT auth OR a server-side secret key ──
app.post('/api/admin/force-pro', async(req,res)=>{
  // Allow either: valid admin JWT, or secret key in header/body for terminal use
  const serverSecret = process.env.ADMIN_SECRET || 'tf-admin-2024';
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  let callerEmail = null;
  if(providedSecret === serverSecret){
    callerEmail = ADMIN_EMAIL; // trusted
  } else {
    // Fall back to JWT auth
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if(token){
      const { data:{ user }, error } = await supabase.auth.getUser(token);
      if(!error && user?.email === ADMIN_EMAIL) callerEmail = user.email;
    }
  }
  if(!callerEmail) return res.status(403).json({error:'Admin only — provide admin JWT or x-admin-secret header'});
  const targetEmail=(req.body.email||'').toLowerCase().trim();
  if(!targetEmail) return res.status(400).json({error:'email required'});
  // 1. Supabase profiles
  const {data:rows,error:sbErr}=await supabase.from('profiles')
    .update({is_pro:true,subscription_active:true})
    .ilike('email',targetEmail).select('id');
  if(sbErr) console.error('[FORCE-PRO] profiles error:',sbErr.message);
  // 2. Supabase auth user_metadata
  const userId=rows?.[0]?.id;
  if(userId){
    const {error:metaErr}=await supabase.auth.admin.updateUserById(userId,{user_metadata:{is_pro:true}});
    if(metaErr) console.error('[FORCE-PRO] user_metadata error:',metaErr.message);
  }
  // 3. users.json
  await withUsersMutex(()=>{
    const users=loadUsers();
    if(users[targetEmail]) users[targetEmail].plan='pro';
    else users[targetEmail]={email:targetEmail,plan:'pro',aiUsage:{count:0,resetAt:0},created:new Date().toISOString()};
    saveUsers(users);
  });
  console.log('[FORCE-PRO]',targetEmail,'-> pro, userId:',userId||'(not found in profiles)');
  res.json({success:true,email:targetEmail,userId:userId||null,note:'User must log out and back in for the new token to reflect the plan change'});
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/',(req,res)=>res.json({status:'ThumbFrame API running',version:'3.0'}));

app.use('/brand-kit', createBrandKitRouter({ supabase, authMiddleware }));

// ── Proxy image (CORS fix) ─────────────────────────────────────────────────────
const PROXY_ALLOWED_DOMAINS = [
  'fonts.gstatic.com','fonts.googleapis.com','storage.googleapis.com',
  'i.imgur.com','images.unsplash.com','replicate.delivery',
  'oaidalleapiprodscus.blob.core.windows.net',
];
app.get('/proxy-image', authMiddleware, async(req,res)=>{
  try{
    const {url}=req.query;
    if(!url) return res.status(400).json({error:'No URL'});
    let hostname;
    try{ hostname=new URL(url).hostname; }catch(e){ return res.status(400).json({error:'Invalid URL'}); }
    if(!PROXY_ALLOWED_DOMAINS.some(d=>hostname===d||hostname.endsWith('.'+d))){
      return res.status(403).json({error:'Domain not allowed'});
    }
    const response=await fetch(url);
    const buffer=Buffer.from(await response.arrayBuffer());
    res.set('Content-Type',response.headers.get('content-type')||'image/png');
    res.set('Access-Control-Allow-Origin','*');
    res.send(buffer);
  }catch(err){
    console.error('Proxy error:',err);
    res.status(500).json({error:'Proxy failed'});
  }
});

// ── Image generation helpers ────────────────────────────────────────────────────
async function generateWithDallE3(prompt, size, style) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const validSize = ['1024x1024','1792x1024','1024x1792'].includes(size) ? size : '1792x1024';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: validSize, style: style || 'vivid', response_format: 'url' }),
      signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`DALL-E 3 HTTP ${response.status}: ${err?.error?.message || 'Unknown error'}`);
  }
  const data = await response.json();
  if (!data?.data?.[0]?.url) throw new Error('DALL-E 3 returned no image URL');
  return { imageUrl: data.data[0].url };
}

async function generateWithReplicateFlux(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not set');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json', 'Prefer': 'wait=60' },
      body: JSON.stringify({ input: { prompt, aspect_ratio: '16:9', output_format: 'webp', num_outputs: 1 } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Replicate Flux HTTP ${response.status}: ${err?.detail || JSON.stringify(err)}`);
    }
    const data = await response.json();
    if (data.output?.[0]) return { imageUrl: data.output[0] };
    // Poll if still processing
    if (data.id) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, { headers: { 'Authorization': `Token ${apiKey}` } });
        const pd = await poll.json();
        if (pd.status === 'succeeded' && pd.output?.[0]) return { imageUrl: pd.output[0] };
        if (pd.status === 'failed') throw new Error(`Replicate Flux failed: ${pd.error || 'Unknown'}`);
      }
    }
    throw new Error('Replicate Flux returned no output');
  } finally { clearTimeout(timeout); }
}

async function generateWithReplicateSDXL(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not set');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch('https://api.replicate.com/v1/models/stability-ai/sdxl/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json', 'Prefer': 'wait=60' },
      body: JSON.stringify({ input: { prompt, width: 1024, height: 576, num_outputs: 1, num_inference_steps: 25, guidance_scale: 7.5 } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Replicate SDXL HTTP ${response.status}: ${err?.detail || JSON.stringify(err)}`);
    }
    const data = await response.json();
    if (data.output?.[0]) return { imageUrl: data.output[0] };
    if (data.id) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, { headers: { 'Authorization': `Token ${apiKey}` } });
        const pd = await poll.json();
        if (pd.status === 'succeeded' && pd.output?.[0]) return { imageUrl: pd.output[0] };
        if (pd.status === 'failed') throw new Error(`Replicate SDXL failed: ${pd.error || 'Unknown'}`);
      }
    }
    throw new Error('Replicate SDXL returned no output');
  } finally { clearTimeout(timeout); }
}

// ── POST /api/generate-image — multi-provider fallback pipeline ────────────────
app.post('/api/generate-image', authMiddleware, async (req, res) => {
  const { prompt, size = '1792x1024', style = 'vivid' } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });

  const quota = checkAndDecrementQuota(req.user.email, req.user.plan);
  if (!quota.ok) return res.status(429).json({ success: false, error: quota.message, code: quota.code });

  const providers = [
    { name: 'dall-e-3',       fn: () => generateWithDallE3(prompt, size, style) },
    { name: 'replicate-flux', fn: () => generateWithReplicateFlux(prompt) },
    { name: 'replicate-sdxl', fn: () => generateWithReplicateSDXL(prompt) },
  ];

  for (const provider of providers) {
    try {
      console.log(`[generate-image] Trying ${provider.name} for ${req.user.email}...`);
      const result = await provider.fn();
      console.log(`[generate-image] ${provider.name} succeeded`);
      return res.json({ success: true, image: result.imageUrl, format: 'url', provider: provider.name });
    } catch (err) {
      console.error(`[generate-image] ${provider.name} failed:`, err.message);
    }
  }

  return res.status(500).json({ success: false, error: 'Image generation is temporarily unavailable. Please try again in a few minutes.' });
});

app.post('/ai-generate', async (req, res) => {
  try {
    const { prompt, face_image_url } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid authorization token' });

    const userEmail = user.email;
    if (!userEmail) return res.status(401).json({ error: 'User email missing in token' });

    const { data: profile } = await supabase.from('profiles').select('is_pro').ilike('email', user.email).single();

    if (!profile?.is_pro) {
      console.log(`[AI-GENERATE] ❌ Access denied for ${userEmail} - isPro: ${profile?.is_pro === true}`);
      return res.status(403).json({
        error: 'Upgrade to Pro',
        message: 'AI generation is a Pro feature. Upgrade to unlock unlimited AI-powered thumbnails.'
      });
    }

    console.log(`[AI-GENERATE] ✅ Access granted for ${userEmail} - isPro: true`);

    // C2: quota check
    const quota=checkAndDecrementQuota(userEmail, req.user.plan);
    if(!quota.ok){
      return res.status(429).json({error:quota.message,code:quota.code});
    }

    let finalPrompt = prompt;
    let faceUrl = null;

    const { data: kit } = await supabase
      .from('brand_kits')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (kit) {
      finalPrompt = `${prompt}. Cinematic YouTube thumbnail, 8k resolution. Deeply integrate these hex colors into the background lighting, shadows, and accents: Primary ${kit.primary_color}, Secondary ${kit.secondary_color}.`;
      faceUrl = kit.face_image_url;
    }

    if (!faceUrl && face_image_url) {
      faceUrl = face_image_url;
    }

    const model = "black-forest-labs/flux-schnell";
    const fluxPulidModel = "bytedance/flux-pulid";
    const fluxPulidVersion = '8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b';

    console.log('Generating via Replicate...', { finalPrompt, faceUrl, model: faceUrl ? fluxPulidModel : model });

    const generateImage = async ({ brandKitFace, userPrompt }) => {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: fluxPulidVersion,
          input: {
            main_face_image: brandKitFace,
            prompt: userPrompt,
            id_weight: 1.0,
            num_steps: 20,
            start_step: 0,
            guidance_scale: 4,
          },
        }),
      });

      const prediction = await response.json();
      if (!response.ok) {
        throw new Error(prediction?.detail || prediction?.error || `Replicate request failed: ${response.status}`);
      }

      const pollUrl = prediction?.urls?.get;
      if (!pollUrl) {
        throw new Error('Replicate response missing prediction polling URL');
      }

      for (let i = 0; i < 60; i += 1) {
        const pollRes = await fetch(pollUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });
        const pollData = await pollRes.json();

        if (!pollRes.ok) {
          throw new Error(pollData?.detail || pollData?.error || `Replicate polling failed: ${pollRes.status}`);
        }

        if (pollData.status === 'succeeded') {
          return pollData.output;
        }

        if (pollData.status === 'failed' || pollData.status === 'canceled') {
          throw new Error(pollData.error || `Prediction ${pollData.status}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      throw new Error('Replicate prediction timed out');
    };

    const input = { prompt: finalPrompt, aspect_ratio: "16:9", output_format: "png" };
    if (faceUrl) input.main_face_image = faceUrl; 

    let output;
    try {
      if (faceUrl) {
        output = await generateImage({ brandKitFace: faceUrl, userPrompt: finalPrompt });
      } else {
        output = await replicate.run(model, { input });
      }
    } catch (replicateErr) {
      console.error('Replicate prediction error message:', replicateErr?.message);
      throw replicateErr;
    }

    const firstOutput = Array.isArray(output) ? output[0] : output;
    const imageUrl = typeof firstOutput === 'string'
      ? firstOutput
      : (firstOutput?.url?.() || firstOutput?.toString?.());
    if (!imageUrl) throw new Error('Replicate returned no output URL');

    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    
    res.json({ image: `data:image/png;base64,${buffer.toString('base64')}` });
  } catch (err) {
    console.error('Replicate error:', err);
    res.status(500).json({ error: `Generation failed: ${err.message}` });
  }
});

// ── AI Command bar (Claude) ────────────────────────────────────────────────────
app.post('/ai-command', authMiddleware, async(req,res)=>{
  try{
    const { command, canvasState } = req.body;
    if(!command) return res.status(400).json({error:'No command'});

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({error:quota.message,code:quota.code});

    const system = `You are an AI assistant for ThumbFrame, a YouTube thumbnail editor.
The user gives you a plain-English command and the current canvas state.
Respond ONLY with valid JSON — no explanation, no markdown fences.
If a single action is needed return the action object directly.
If multiple actions are needed return { "actions": [...] }.

Canvas state: ${JSON.stringify(canvasState)}

Available actions:

updateLayer      — { action:"updateLayer", id, updates:{opacity,blendMode,brightness,contrast,saturation,hue,blur,x,y,width,height,rotation,visible} }
updateBackground — { action:"updateBackground", updates:{bgColor} }
addText          — { action:"addText", text, fontSize, fontFamily, fontWeight, textColor, strokeColor, strokeWidth, x, y, shadow, shadowColor, shadowBlur }
deleteLayer      — { action:"deleteLayer", id }
moveLayer        — { action:"moveLayer", id, x, y }
resizeLayer      — { action:"resizeLayer", id, width, height }
setBlendMode     — { action:"setBlendMode", id, mode }
adjustBrightness — { action:"adjustBrightness", value }  (value: -100 to 100)
adjustContrast   — { action:"adjustContrast", value }    (value: -100 to 100)
adjustSaturation — { action:"adjustSaturation", value }  (value: -100 to 100)
adjustHue        — { action:"adjustHue", value }         (value: -180 to 180)
adjustBlur       — { action:"adjustBlur", id, value }    (value: 0 to 20)
setOpacity       — { action:"setOpacity", id, value }    (value: 0 to 1)
duplicateLayer   — { action:"duplicateLayer", id }
reorderLayer     — { action:"reorderLayer", id, index }
message          — { action:"message", message:"..." }   (use when command is ambiguous or impossible)

Rules:
- For color changes always use hex strings like "#ff0000"
- For "make text bigger" increase fontSize by 20-40%
- For "darken/brighten" use adjustBrightness with -30 to -60 / +30 to +60
- For "more vibrant/saturated" use adjustSaturation with +40 to +80
- For "increase contrast" use adjustContrast with +30 to +60
- For "add glow" duplicate the text layer then set blendMode:"screen" and blur:6 on the copy
- When the user says "the text" or "the image" and there is only one such layer, use its id
- x/y positions are percentages of canvas width/height (0–100)`;

    const message = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 800,
      system,
      messages:[{ role:'user', content:command }],
    });

    const raw    = message.content[0].text.trim();
    const clean  = raw.replace(/```json|```/g,'').trim();
    console.log('AI command:', clean);

    try{
      const parsed = JSON.parse(clean);
      res.json({ result:parsed, raw:clean });
    }catch(e){
      res.json({ result:null, raw:clean, error:'Could not parse response' });
    }

  }catch(err){
    console.error('AI command error:',err.message);
    res.status(500).json({error:`Command failed: ${err.message}`});
  }
});

// ── Background remover ─────────────────────────────────────────────────────────
app.post('/remove-bg', authMiddleware, async(req,res)=>{
  try{
    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({error:quota.message,code:quota.code});

    const imageInput = (req.body?.image || req.body?.imageUrl || '').toString().trim();
    if(!imageInput){
      console.error('[REMOVE BG] 400 Missing image payload. Expected body.image (or imageUrl fallback).');
      return res.status(400).json({error:'Missing image data. Expected { image: <base64-or-url> }'});
    }

    if(!process.env.REMOVEBG_API_KEY){
      console.error('[REMOVE BG] 400 Missing REMOVEBG_API_KEY env var.');
      return res.status(400).json({error:'remove.bg API key is not configured on the server'});
    }

    let imageBuffer;
    if(imageInput.startsWith('data:')){
      const base64Part = imageInput.split(',')[1] || '';
      if(!base64Part){
        console.error('[REMOVE BG] 400 Invalid base64 payload: missing data segment.');
        return res.status(400).json({error:'Invalid image data URL payload'});
      }
      imageBuffer=Buffer.from(base64Part,'base64');
    }else{
      const r=await fetch(imageInput);
      if(!r.ok){
        console.error(`[REMOVE BG] 400 Image URL fetch failed: status=${r.status}`);
        return res.status(400).json({error:'Could not fetch image URL for background removal'});
      }
      imageBuffer=Buffer.from(await r.arrayBuffer());
    }

    if(!imageBuffer || imageBuffer.length===0){
      console.error('[REMOVE BG] 400 Image buffer is empty after payload processing.');
      return res.status(400).json({error:'Image payload could not be processed'});
    }

    const formData=new FormData();
    formData.append('image_file',imageBuffer,{filename:'image.png'});
    formData.append('size','auto');
    const response=await fetch('https://api.remove.bg/v1.0/removebg',{
      method:'POST',
      headers:{'X-Api-Key':process.env.REMOVEBG_API_KEY,...formData.getHeaders()},
      body:formData,
    });
    if(!response.ok){
      const errText=await response.text();
      console.error('remove.bg error:',response.status,errText);
      if(response.status===400){
        return res.status(400).json({error:'remove.bg rejected the image payload'});
      }
      if(response.status===401||response.status===403){
        return res.status(400).json({error:'Invalid remove.bg API key'});
      }
      return res.status(500).json({error:'remove.bg failed'});
    }
    const buffer=Buffer.from(await response.arrayBuffer());
    res.json({image:`data:image/png;base64,${buffer.toString('base64')}`});
  }catch(err){
    console.error('Remove BG error:',err.message,err.type,err.code);
    res.status(500).json({error:`AI tool timed out. ${err.message}`});
  }
});

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/auth/signup', authRateLimit, async(req,res)=>{
  try{
    const {email,password,name}=req.body;
    if(!email||!password) return res.status(400).json({error:'Email and password required'});
    const users=loadUsers();
    if(users[email]) return res.status(400).json({error:'Email already exists'});
    const hash=await bcrypt.hash(password,10);
    users[email]={email,name:name||email.split('@')[0],hash,created:new Date().toISOString(),plan:'free'};
    saveUsers(users);
    const token=jwt.sign({email,name:users[email].name},JWT_SECRET,{expiresIn:'30d'});

    // Send welcome email
    try{
      await resend.emails.send({
        from:    'ThumbFrame <hello@thumbframe.com>',
        to:      email,
        subject: 'Welcome to ThumbFrame 🎨',
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:28px;font-weight:800;color:#1a1612;margin-bottom:8px">
              Welcome to ThumbFrame, ${name||email.split('@')[0]}! 🎨
            </h1>
            <p style="color:#666;font-size:15px;line-height:1.6">
              You now have access to the full ThumbFrame thumbnail editor — completely free.
            </p>
            <div style="margin:24px 0;padding:20px;background:#f5f0e8;border-radius:10px">
              <p style="margin:0;font-weight:700;color:#1a1612;margin-bottom:12px">What you can do:</p>
              <ul style="color:#555;line-height:2;margin:0;padding-left:20px">
                <li>Remove backgrounds with AI</li>
                <li>Add rim lighting like Minecraft thumbnails</li>
                <li>Check your CTR score before posting</li>
                <li>Preview how your thumbnail looks on mobile</li>
                <li>Export PNG, JPG, or WebP</li>
              </ul>
            </div>
            <a href="${process.env.FRONTEND_URL || 'https://thumbframe.com'}/editor"
               style="display:inline-block;padding:14px 28px;background:#c45c2e;color:#fff;
                      text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">
              Open ThumbFrame →
            </a>
            <p style="margin-top:32px;color:#999;font-size:12px">
              Built for YouTubers who care about their craft.
            </p>
          </div>
        `,
      });
    }catch(emailErr){
      console.log('Email send failed (non-critical):',emailErr.message);
    }

    res.json({token,user:{email,name:users[email].name,plan:'free'}});
  }catch(err){
    console.error('Signup error:',err);
    res.status(500).json({error:'Signup failed'});
  }
});

app.post('/auth/login', authRateLimit, async(req,res)=>{
  try{
    const {email,password}=req.body;
    if(!email||!password) return res.status(400).json({error:'Email and password required'});
    const users=loadUsers();
    const user=users[email];
    if(!user) return res.status(400).json({error:'No account with that email'});
    const valid=await bcrypt.compare(password,user.hash);
    if(!valid) return res.status(400).json({error:'Incorrect password'});
    const token=jwt.sign({email,name:user.name},JWT_SECRET,{expiresIn:'30d'});
    res.json({token,user:{email,name:user.name,plan:user.plan||'free'}});
  }catch(err){
    console.error('Login error:',err);
    res.status(500).json({error:'Login failed'});
  }
});

app.get('/auth/me', authMiddleware, async(req,res)=>{
  const email=req.user.email;
  // plan is authoritative from user_metadata (set by authMiddleware) — no extra Supabase call
  const plan=req.user.plan;
  // Keep users.json in sync for usage-count tracking
  await withUsersMutex(()=>{
    const users=loadUsers();
    if(!users[email]) users[email]={email,plan,aiUsage:{count:0,resetAt:0},created:new Date().toISOString()};
    else users[email]={...users[email],plan};
    saveUsers(users);
  });
  const name=loadUsers()[email]?.name||email.split('@')[0];
  console.log('[AUTH/ME]',email,'plan:',plan);
  res.json({email,name,plan});
});

app.post('/brand-kit/upload-face', authMiddleware, async(req,res)=>{
  try{
    const {imageData}=req.body;
    if(!imageData) return res.status(400).json({error:'No image data'});

    const base64Data=imageData.replace(/^data:image\/\w+;base64,/,'');
    const buffer=Buffer.from(base64Data,'base64');
    const fileName=`${req.user.email}-${Date.now()}.png`;

    const {data,error}=await supabase.storage
      .from('brand_assets')
      .upload(fileName,buffer,{
        contentType:'image/png',
        upsert:true,
      });

    if(error) throw error;

    const {data:{publicUrl}}=supabase.storage
      .from('brand_assets')
      .getPublicUrl(fileName);

    res.json({url:publicUrl});
  }catch(err){
    console.error('Face upload error:',err);
    res.status(500).json({error:'Upload failed'});
  }
});

// ── Password reset ─────────────────────────────────────────────────────────────

app.post('/auth/forgot-password', authRateLimit, async(req,res)=>{
  try{
    const {email}=req.body;
    const users=loadUsers();
    if(!users[email]) return res.json({success:true}); // Don't reveal if email exists
    const token=uuidv4();
    // M2: store reset token in users.json instead of in-memory
    await withUsersMutex(()=>{
      const u=loadUsers();
      if(u[email]) u[email].resetToken={token,expires:Date.now()+3600000};
      saveUsers(u);
    });
    try{
      await resend.emails.send({
        from:    'ThumbFrame <hello@thumbframe.com>',
        to:      email,
        subject: 'Reset your ThumbFrame password',
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:24px;font-weight:800;color:#1a1612">Reset your password</h1>
            <p style="color:#666;font-size:15px;line-height:1.6">
              Click the button below to reset your password. This link expires in 1 hour.
            </p>
            <a href="${process.env.FRONTEND_URL || 'https://thumbframe.com'}/reset-password?token=${token}"
               style="display:inline-block;padding:14px 28px;background:#c45c2e;color:#fff;
                      text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">
              Reset password →
            </a>
            <p style="margin-top:24px;color:#999;font-size:12px">
              If you didn't request this, ignore this email.
            </p>
          </div>
        `,
      });
    }catch(emailErr){
      console.log('Reset email failed:',emailErr.message);
    }
    res.json({success:true,message:'If that email exists you will receive a reset link'});
  }catch(err){
    res.status(500).json({error:'Reset failed'});
  }
});

app.post('/auth/reset-password', async(req,res)=>{
  try{
    const {token,password}=req.body;
    // M2: read reset token from users.json
    const users=loadUsers();
    const userRecord=Object.values(users).find(u=>u.resetToken?.token===token);
    const reset=userRecord?.resetToken;
    if(!reset||reset.expires<Date.now())
      return res.status(400).json({error:'Invalid or expired token'});
    if(!users[userRecord.email]) return res.status(400).json({error:'User not found'});
    await withUsersMutex(()=>{
      const u=loadUsers();
      u[userRecord.email].hash=bcrypt.hashSync(password,10);
      delete u[userRecord.email].resetToken;
      saveUsers(u);
    });
    res.json({success:true});
  }catch(err){
    res.status(500).json({error:'Reset failed'});
  }
});

// ── Designs ────────────────────────────────────────────────────────────────────
app.post('/designs/save', authMiddleware, async (req,res)=>{
  try{
    const user = { email: req.user.email, id: req.userId };
    console.log('[AUTH] Token verified. User:', user.email, 'UID:', user.id);

    const body = req.body || {};
    console.log('[SAVE] body keys:', Object.keys(body));
    console.log('[SAVE] thumbnail field:', body.thumbnail ? `present (${String(body.thumbnail).length} chars)` : `MISSING/FALSY (value: ${JSON.stringify(body.thumbnail)})`);
    console.log('[SAVE] Content-Length header:', req.headers['content-length']);

    const jsonData = (body.json_data && typeof body.json_data === 'object')
      ? body.json_data
      : { name: body.name || 'Untitled', platform: body.platform || 'youtube' };

    const upsertRow = {
      ...(body.id ? { id: body.id } : {}),
      user_id:      user.id,
      user_email:   user.email,
      name:         jsonData.name || body.name || 'Untitled',
      platform:     jsonData.platform || body.platform || 'youtube',
      json_data:    jsonData,
      last_edited:  new Date().toISOString(),
    };

    if(typeof body.thumbnail === 'string'){
      upsertRow.thumbnail = body.thumbnail;
    }

    console.log('[STORAGE] Upserting row for user:', user.email, '| id:', upsertRow.id || '(new)', '| name:', upsertRow.name, '| thumbnail:', upsertRow.thumbnail ? `present (${String(upsertRow.thumbnail).length} chars)` : 'NULL');

    const { data, error:saveError } = await supabase
      .from('thumbnails')
      .upsert(upsertRow, { onConflict:'id' })
      .select('id,last_edited,json_data')
      .single();

    if(saveError){
      console.error('[Supabase Error]:', saveError.message);
      return res.status(500).json({ error: saveError.message });
    }

    console.log('[STORAGE] Design successfully saved:', data?.id, 'for user:', user.email);
    const savedId = Array.isArray(data) ? data?.[0]?.id : data?.id;
    return res.status(200).json({ success: true, message: 'Saved successfully', id: savedId });
  }catch(err){
    console.error('[STORAGE] Unhandled error in /designs/save route:', err.message, err.stack);
    return res.status(500).json({error: `Server error: ${err.message}`});
  }
});

app.get('/designs/list', authMiddleware, async (req, res) => {
  try {
    // C4: always use the authenticated user's email, ignore query param
    const email = req.user.email;

    const { data, error } = await supabase
      .from('thumbnails')
      .select('id, name, user_email, platform, thumbnail, last_edited, json_data')
      .eq('user_email', email)
      .order('last_edited', { ascending: false });

    if (error) {
      console.error('Design list fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch designs list' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Design list route error:', err);
    res.status(500).json({ error: 'Failed to fetch designs list' });
  }
});

app.get('/designs/load', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  const design=(designs[req.user.email]||[]).find(d=>d.id===req.query.id);
  if(!design) return res.status(404).json({error:'Not found'});
  res.json({design});
});

app.get('/designs', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  const list=(designs[req.user.email]||[]).map(d=>({
    id:d.id,name:d.name,platform:d.platform,
    created:d.created,updated:d.updated,thumbnail:d.thumbnail,
  }));
  res.json({designs:list});
});

app.get('/designs/:id', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  const design=(designs[req.user.email]||[]).find(d=>d.id===req.params.id);
  if(!design) return res.status(404).json({error:'Not found'});
  res.json({design});
});

// Body-based delete alias — accepts { id } in the request body.
// Must be registered BEFORE /designs/:id so Express doesn't swallow 'delete' as a param.
app.delete('/designs/delete', authMiddleware, async (req,res)=>{
  try{
    const designId = ((req.body && req.body.id) || '').toString().trim();
    if(!designId){
      return res.status(400).json({error:'Missing design ID'});
    }

    console.log('[DELETE] /designs/delete — ID:', designId, 'for user:', req.user.email);

    const { error } = await supabase
      .from('thumbnails')
      .delete()
      .eq('id', designId)
      .eq('user_email', req.user.email);

    if(error){
      console.error('[DELETE] Supabase delete error:', error.message);
      return res.status(500).json({error:`Delete failed: ${error.message}`});
    }

    console.log('[DELETE] Successfully deleted design:', designId);
    res.json({success:true});
  }catch(err){
    console.error('[DELETE] Unhandled error:', err.message);
    res.status(500).json({error:`Server error: ${err.message}`});
  }
});

app.delete('/designs/:id', authMiddleware, async (req,res)=>{
  try{
    const designId = (req.params.id || '').toString().trim();
    if(!designId){
      return res.status(400).json({error:'Missing design ID'});
    }

    console.log('[DELETE] Deleting design ID:', designId, 'for user:', req.user.email);

    const { error } = await supabase
      .from('thumbnails')
      .delete()
      .eq('id', designId)
      .eq('user_id', req.userId)
      .eq('user_email', req.user.email);

    if(error){
      console.error('[DELETE] Supabase delete error:', error.message);
      return res.status(500).json({error:`Delete failed: ${error.message}`});
    }

    console.log('[DELETE] Successfully deleted design:', designId);
    res.json({success:true});
  }catch(err){
    console.error('[DELETE] Unhandled error:', err.message);
    res.status(500).json({error:`Server error: ${err.message}`});
  }
});

// ── Stripe checkout ────────────────────────────────────────────────────────────
app.post('/checkout', authMiddleware, async(req,res)=>{
  try{
    console.log('[checkout] request started', {
      body: req.body,
      origin: req.headers.origin,
    });
    console.log('[checkout] STRIPE_SECRET_KEY found:', !!stripeSecretKey);

    const {email}=req.body;
    const priceId=process.env.STRIPE_PRO_PRICE_ID?.trim();

    console.log('[checkout] priceId:', priceId);

    if(!stripeSecretKey){
      throw new Error('Missing STRIPE_SECRET_KEY');
    }

    if(!stripeSecretKey.startsWith('sk_')){
      throw new Error('Invalid STRIPE_SECRET_KEY format. Expected a secret key starting with sk_.');
    }

    if(!priceId){
      throw new Error('Missing STRIPE_PRO_PRICE_ID');
    }

    if(!priceId.startsWith('price_')){
      console.error('ERROR: Invalid Price ID format in Environment Variables.');
      throw new Error('ERROR: Invalid Price ID format in Environment Variables.');
    }

    const session=await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      mode:'subscription',
      allow_promotion_codes:true,
      ...(email && email.trim() ? {customer_email: email.trim()} : {}),
      line_items:[{price:priceId,quantity:1}],
      success_url: `https://thumbframe.com/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://thumbframe.com/pricing`,
    });

    console.log('[checkout] session created:', session.id);
    res.json({url:session.url});
  }catch(err){
    console.error('[checkout] error:', err);
    res.status(500).json({
      error: err.message || 'Checkout failed',
    });
  }
});

app.post('/billing/portal', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;
    console.log('[billing/portal] request for:', userEmail);

    // 1. Try to find stripe_customer_id in the profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('email', userEmail)
      .single();

    let customerId = profile?.stripe_customer_id || null;

    // 2. If no stored customer ID, search Stripe by email (or create)
    if (!customerId) {
      console.log('[billing/portal] No stored customer ID — searching Stripe by email:', userEmail);
      const existing = await stripe.customers.search({ query: `email:'${userEmail}'` });

      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        console.log('[billing/portal] Found existing Stripe customer:', customerId);
      } else {
        const newCustomer = await stripe.customers.create({ email: userEmail });
        customerId = newCustomer.id;
        console.log('[billing/portal] Created new Stripe customer:', customerId);
      }

      // Persist customer ID back to profile if the column exists
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('email', userEmail);
    }

    const returnUrl = `${(process.env.FRONTEND_URL || 'https://thumbframe.com').replace(/\/$/, '')}/dashboard`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    console.log('[billing/portal] Portal session created:', portalSession.id);
    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[billing/portal] error:', err);
    res.status(500).json({ error: err.message || 'Failed to create billing portal session' });
  }
});

app.get('/validate-key',(req,res)=>{
  const apiKey=req.headers['x-api-key'];
  const keyData=validateKey(apiKey);
  if(!keyData) return res.status(401).json({valid:false});
  res.json({valid:true,plan:keyData.plan,email:keyData.email});
});

app.get('/success',(req,res)=>res.send(`
  <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f5f0e8;color:#1a1612">
    <h1 style="color:#4a7c59">✅ Payment successful!</h1>
    <p>Your Pro account is now active. Check your email for confirmation.</p>
    <a href="/" style="color:#c45c2e;font-weight:700">← Back to ThumbFrame</a>
  </body></html>
`));

// Keep Railway awake
setInterval(()=>{
  fetch(`https://thumbframe-api-production.up.railway.app/`)
    .then(()=>{})
    .catch(()=>{});
}, 14 * 60 * 1000);

// L2: /api/analyze-face removed (was mock data only)

// ── Smart Subject Detection — SAM 2 via Replicate ─────────────────────────────
app.post('/api/segment', authMiddleware, async(req,res)=>{
  try{
    const {image}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Invalid image data',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    let masks=null;

    try{
      console.log('[SEGMENT] Running SAM 2...');
      const output=await replicate.run('meta/sam-2',{
        input:{
          image,
          points_per_side:        16,
          pred_iou_thresh:        0.86,
          stability_score_thresh: 0.92,
          min_mask_region_area:   500,
        },
      });

      if(Array.isArray(output)&&output.length>0){
        console.log(`[SEGMENT] SAM 2 returned ${output.length} masks`);
        masks=await Promise.all(
          output.slice(0,8).map(async(maskUrl)=>{
            const r=await fetch(maskUrl);
            const buf=Buffer.from(await r.arrayBuffer());
            return`data:image/png;base64,${buf.toString('base64')}`;
          })
        );
      }
    }catch(sam2Err){
      console.warn('[SEGMENT] SAM 2 failed:',sam2Err.message);
    }

    if(!masks||masks.length===0){
      try{
        console.log('[SEGMENT] Falling back to RMBG-2.0...');
        const output=await replicate.run('briaai/rmbg-2.0',{input:{image}});
        const maskUrl=typeof output==='string'?output:output?.[0];
        if(maskUrl){
          const r=await fetch(maskUrl);
          const buf=Buffer.from(await r.arrayBuffer());
          masks=[`data:image/png;base64,${buf.toString('base64')}`];
          console.log('[SEGMENT] RMBG-2.0 fallback succeeded');
        }
      }catch(rmbgErr){
        console.error('[SEGMENT] RMBG-2.0 also failed:',rmbgErr.message);
      }
    }

    if(!masks||masks.length===0){
      return res.status(500).json({success:false,error:'No objects detected. Try a clearer thumbnail.',code:'API_FAILURE'});
    }

    res.json({success:true,masks});
  }catch(err){
    console.error('[SEGMENT] Error:',err.message);
    res.status(500).json({success:false,error:`Segmentation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── AI Expression Enhancement ─────────────────────────────────────────────────
app.post('/api/enhance-expression', authMiddleware, async(req,res)=>{
  try{
    const{faceCrop,mask,instruction}=req.body;
    if(!faceCrop||!faceCrop.startsWith('data:image/')||!mask||!instruction){
      return res.status(400).json({success:false,error:'Missing faceCrop, mask, or instruction',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    const PROMPTS={
      'open mouth more':      'photorealistic portrait, same person, open mouth wide smile, excited energetic expression, sharp focus, high quality',
      'raise eyebrows':       'photorealistic portrait, same person, raised eyebrows, shocked surprised expression, wide eyes, high quality',
      'open eyes wider':      'photorealistic portrait, same person, wide open eyes, shocked surprised energetic expression, high quality',
      'excited expression':   'photorealistic portrait, same person, big smile open mouth raised eyebrows wide eyes, ultra excited expression, high quality',
      'shocked expression':   'photorealistic portrait, same person, shocked open mouth wide eyes raised eyebrows, surprised expression, high quality',
    };
    const prompt=PROMPTS[instruction]||`photorealistic portrait, same person, ${instruction}, high quality`;

    console.log(`[ENHANCE-EXPR] Running SD inpainting: "${instruction}"`);
    const output=await replicate.run('stability-ai/stable-diffusion-inpainting',{
      input:{
        prompt,
        negative_prompt:'blurry, low quality, cartoon, anime, painting, distorted face, ugly, bad anatomy, extra limbs',
        image:faceCrop,
        mask,
        num_inference_steps:20,
        guidance_scale:7.5,
        strength:0.8,
      },
    });

    const imageUrl=Array.isArray(output)?output[0]:output;
    if(!imageUrl) throw new Error('No image returned from model');

    const r=await fetch(imageUrl);
    const buf=Buffer.from(await r.arrayBuffer());
    res.json({success:true,image:`data:image/png;base64,${buf.toString('base64')}`});
  }catch(err){
    console.error('[ENHANCE-EXPR] Error:',err.message);
    res.status(500).json({success:false,error:`Enhancement failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Niche Profiles — Feature J ────────────────────────────────────────────────
const NICHE_PROFILES = {
  gaming: {
    label:'Gaming', emoji:'🎮',
    promptContext:'YouTube gaming channel. Audience is 13-34 male gamers who respond to high-energy reactions, intense competitive moments, shock/hype expressions, bold neon colors, and immediate visual excitement. Reference gaming terminology naturally.',
    defaultColorGrade:'neon',
    defaultBgHint:'dramatic gaming setup, RGB lighting, dark room with glowing monitors, epic gaming moment, no people',
    ctrWeights:{ face_prominence:1.2, text_readability:1.1, color_contrast:1.2, emotional_intensity:1.3, composition:0.9, niche_relevance:1.0 },
  },
  tech: {
    label:'Tech', emoji:'💻',
    promptContext:'YouTube tech channel covering reviews, tutorials, and product deep-dives. Audience values clarity, product close-ups, authoritative confident expressions, and clean modern aesthetics. Avoid hype language — prefer precision.',
    defaultColorGrade:'cool',
    defaultBgHint:'minimal tech workspace, clean desk, soft ambient lighting, modern electronics, subtle gradient, no people',
    ctrWeights:{ face_prominence:1.0, text_readability:1.2, color_contrast:1.0, emotional_intensity:0.9, composition:1.3, niche_relevance:1.2 },
  },
  vlog: {
    label:'Vlog', emoji:'🎥',
    promptContext:'YouTube lifestyle and vlog channel. Audience connects through authentic personal moments, genuine expressions, real locations, and story-driven emotional beats. Relatability beats perfection here.',
    defaultColorGrade:'warm',
    defaultBgHint:'lifestyle photography backdrop, natural outdoor setting, golden hour lighting, relatable everyday scene, no people',
    ctrWeights:{ face_prominence:1.4, text_readability:0.9, color_contrast:0.9, emotional_intensity:1.2, composition:1.1, niche_relevance:1.0 },
  },
  cooking: {
    label:'Cooking', emoji:'🍳',
    promptContext:'YouTube cooking and food channel. Audience responds to appetite-triggering visuals, delicious-looking results, creator reactions to tasting, and clear recipe outcomes. Warm tones and rich food colors are critical.',
    defaultColorGrade:'warm',
    defaultBgHint:'professional kitchen backdrop, warm ambient lighting, fresh colorful ingredients, steam rising from dish, vibrant food colors, no people',
    ctrWeights:{ face_prominence:0.9, text_readability:1.1, color_contrast:1.1, emotional_intensity:1.0, composition:1.2, niche_relevance:1.3 },
  },
  fitness: {
    label:'Fitness', emoji:'💪',
    promptContext:'YouTube fitness and workout channel. Audience responds to transformation results, intense training moments, aspirational physique goals, and motivational high-contrast imagery. Dramatic lighting and strong silhouettes work well.',
    defaultColorGrade:'cinematic',
    defaultBgHint:'modern gym backdrop, dramatic directional lighting, barbells and equipment, motivational atmosphere, strong contrast, no people',
    ctrWeights:{ face_prominence:1.2, text_readability:1.0, color_contrast:1.1, emotional_intensity:1.3, composition:1.0, niche_relevance:1.2 },
  },
  education: {
    label:'Education', emoji:'📚',
    promptContext:'YouTube educational and explainer channel. Audience values trustworthiness, clarity, immediate understanding of what they will learn, and credibility signals. Clean compositions with clear visual hierarchy outperform busy designs.',
    defaultColorGrade:'default',
    defaultBgHint:'clean academic setting, soft natural light, organized desk workspace, professional atmosphere, subtle books or whiteboards, no people',
    ctrWeights:{ face_prominence:1.0, text_readability:1.4, color_contrast:1.0, emotional_intensity:0.8, composition:1.2, niche_relevance:1.2 },
  },
};

function getUserNiche(email){
  const users=loadUsers();
  return users[email]?.niche||null;
}

function getNicheProfile(email){
  const niche=getUserNiche(email);
  return niche ? {niche, profile:NICHE_PROFILES[niche]||null} : {niche:null, profile:null};
}

app.get('/api/get-niche', authMiddleware, (req,res)=>{
  const {niche,profile}=getNicheProfile(req.user.email);
  res.json({success:true, niche, profile, nicheSet:!!niche});
});

app.post('/api/set-niche', authMiddleware, async(req,res)=>{
  const {niche}=req.body;
  if(!niche||!NICHE_PROFILES[niche]){
    return res.status(400).json({success:false,error:'Invalid niche. Must be one of: '+Object.keys(NICHE_PROFILES).join(', '),code:'INVALID_INPUT'});
  }
  await withUsersMutex(()=>{
    const users=loadUsers();
    if(!users[req.user.email]) return;
    users[req.user.email].niche=niche;
    saveUsers(users);
  });
  const users=loadUsers();
  if(!users[req.user.email]) return res.status(404).json({success:false,error:'User not found',code:'NOT_FOUND'});
  console.log(`[NICHE] ${req.user.email} set niche to "${niche}"`);
  res.json({success:true, niche, profile:NICHE_PROFILES[niche]});
});

// ── AI Text Engine — Feature D ─────────────────────────────────────────────────
app.post('/api/generate-text', authMiddleware, async(req,res)=>{
  try{
    const{title,niche,image}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    const[,rest]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    const {niche:storedNiche,profile:nicheProfile}=getNicheProfile(req.user.email);
    const effectiveNiche=niche||storedNiche||'general';
    const nicheCtx=nicheProfile?`\nChannel context: ${nicheProfile.promptContext}`:'';

    const prompt=`You are a YouTube thumbnail headline expert. Analyze this thumbnail${title?` for a video titled "${title}"`:''}${effectiveNiche&&effectiveNiche!=='general'?` in the ${effectiveNiche} niche`:''}${nicheCtx}.

Generate 5 punchy, click-worthy text overlays calibrated to this niche. For each, analyze the image to find the best high-contrast placement zone — avoid faces, busy detail areas, and any text already visible.

Return ONLY a valid JSON array — no markdown, no extra text — in exactly this shape:
[
  {
    "text": "<max 4 words, ALL CAPS, punchy and niche-specific>",
    "x": <0-100, percent from left edge of image>,
    "y": <0-100, percent from top edge of image>,
    "color": "<'light' or 'dark' — which gives better contrast at this zone>",
    "strokeWidth": <0-12 integer — heavier for busier backgrounds>,
    "fontFamily": "<'Anton' or 'Bebas Neue' or 'Oswald'>",
    "fontSize": <36-80 integer, relative to 1280x720 canvas>
  }
]

Rules:
- text: ALL CAPS always, max 4 words, high-energy click-bait phrasing for the niche, never generic
- x/y: exact percent positions identifying a clean region of the actual image
- color: 'light' = white text on dark zone, 'dark' = dark text on light zone
- strokeWidth: 0 for very clean zones, 4-6 for medium, 8-12 for busy
- fontFamily: Anton for blocky bold MrBeast energy, Bebas Neue for sleek cinematic, Oswald for clean editorial
- fontSize: 60-80 for 1-2 word punchy phrases, 42-58 for 3-4 word phrases
- Vary positions across the 5 options — top, bottom, left, right, corners — so they suit different layouts
- Make each text option meaningfully different in wording and energy level
Output only the JSON array.`;

    console.log(`[AITEXT] Generating headlines for ${req.user.email}${title?` — "${title}"`:''}${niche?` [${niche}]`:''}`);
    const response=await anthropic.messages.create({
      model:CLAUDE_MODEL,
      max_tokens:800,
      messages:[{
        role:'user',
        content:[
          {type:'image',source:{type:'base64',media_type,data:rest}},
          {type:'text',text:prompt},
        ],
      }],
    });

    const raw=response.content[0]?.text?.trim()||'';
    let options;
    try{
      const start=raw.indexOf('[');
      const end=raw.lastIndexOf(']');
      options=JSON.parse(raw.slice(start,end+1));
    }catch(e){
      console.error('[AITEXT] JSON parse failed:',raw.slice(0,300));
      throw new Error('Could not parse Claude response as JSON');
    }

    options=options.slice(0,5).map(o=>({
      text:   String(o.text||'HEADLINE').toUpperCase().slice(0,40),
      x:      Math.max(0,Math.min(100,Number(o.x)||10)),
      y:      Math.max(0,Math.min(100,Number(o.y)||10)),
      color:  o.color==='dark'?'dark':'light',
      strokeWidth: Math.max(0,Math.min(12,Math.round(Number(o.strokeWidth)||0))),
      fontFamily: ['Anton','Bebas Neue','Oswald'].includes(o.fontFamily)?o.fontFamily:'Anton',
      fontSize:   Math.max(36,Math.min(80,Math.round(Number(o.fontSize)||60))),
    }));

    res.json({success:true,options,remaining:quota.remaining});
  }catch(err){
    console.error('[AITEXT] Error:',err.message);
    res.status(500).json({success:false,error:`Text generation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Composition AI — Feature C ─────────────────────────────────────────────────
app.post('/api/analyze-composition', authMiddleware, async(req,res)=>{
  try{
    const{image,title}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    const[,rest]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    const {niche:userNicheComp,profile:nicheProfileComp}=getNicheProfile(req.user.email);
    const nicheCtxComp=nicheProfileComp?` This is a ${nicheProfileComp.label} channel. ${nicheProfileComp.promptContext}`:'';

    const prompt=`You are a YouTube thumbnail composition expert. Analyze this thumbnail${title?` for the video titled "${title}"`:''}${nicheCtxComp}.\n\nReturn ONLY valid JSON — no markdown, no explanation — in exactly this shape:\n{\n  "score": <integer 1-10>,\n  "face_placement": "<one sentence tip about face/subject positioning, or null if no face>",\n  "negative_space": "<one sentence assessment of empty/breathing room>",\n  "focal_point": "<one sentence about what the eye is drawn to first>",\n  "text_zones": [\n    {"label":"<short label>","x":<0-100 pct from left>,"y":<0-100 pct from top>,"w":<width pct>,"h":<height pct>}\n  ],\n  "crop_suggestion": {"x":<pct>,"y":<pct>,"w":<pct>,"h":<pct>},\n  "issues": [\n    "<actionable issue string>"\n  ]\n}\n\nRules:\n- score: 1=terrible, 10=perfect click-worthy composition\n- text_zones: mark 1-3 areas where text could go or already is. x/y/w/h in percent of image dimensions.\n- crop_suggestion: tightest crop that keeps the most important visual elements. If full frame is optimal, return {x:0,y:0,w:100,h:100}.\n- issues: 2-5 short, actionable problems.\n- Be honest and specific. Output only the JSON object.`;

    console.log(`[COMP] Analyzing composition for ${req.user.email}${title?` — "${title}"`:''}`);
    const response=await anthropic.messages.create({
      model:CLAUDE_MODEL,
      max_tokens:900,
      messages:[{
        role:'user',
        content:[
          {type:'image',source:{type:'base64',media_type,data:rest}},
          {type:'text',text:prompt},
        ],
      }],
    });

    const raw=response.content[0]?.text?.trim()||'';
    let parsed;
    try{
      const jsonStart=raw.indexOf('{');
      const jsonEnd=raw.lastIndexOf('}');
      parsed=JSON.parse(raw.slice(jsonStart,jsonEnd+1));
    }catch(e){
      console.error('[COMP] JSON parse failed:',raw.slice(0,200));
      throw new Error('Could not parse Claude response as JSON');
    }

    const score=Math.max(1,Math.min(10,Math.round(Number(parsed.score)||5)));
    res.json({
      success:true,
      score,
      face_placement:parsed.face_placement||null,
      negative_space:parsed.negative_space||null,
      focal_point:parsed.focal_point||null,
      text_zones:Array.isArray(parsed.text_zones)?parsed.text_zones:[],
      crop_suggestion:parsed.crop_suggestion||{x:0,y:0,w:100,h:100},
      issues:Array.isArray(parsed.issues)?parsed.issues:[],
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[COMP] Error:',err.message);
    res.status(500).json({success:false,error:`Composition analysis failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── CTR Prediction Score v2 — Feature H ───────────────────────────────────────
app.post('/api/ctr-score-v2', authMiddleware, async(req,res)=>{
  try{
    const{image,title,niche}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    const {niche:storedNicheCtr,profile:nicheProfileCtr}=getNicheProfile(req.user.email);
    const effectiveNicheCtr=niche||storedNicheCtr||'general';
    const nicheCtxCtr=nicheProfileCtr?`\n\nChannel context: This is a ${nicheProfileCtr.label} channel. ${nicheProfileCtr.promptContext}\nWeight these categories accordingly for this niche when scoring.`:'';

    const prompt=`You are a YouTube CTR expert with deep knowledge of what makes thumbnails click-worthy. Analyze this thumbnail${title?` for a video titled "${title}"`:''}${effectiveNicheCtr&&effectiveNicheCtr!=='general'?` in the ${effectiveNicheCtr} niche`:''}${nicheCtxCtr}.

Return ONLY valid JSON — no preamble, no markdown, no explanation — in this exact shape:
{
  "overall": <integer 0-100, overall CTR potential>,
  "predicted_ctr_low": <float, realistic lower-bound CTR % for YouTube, e.g. 3.5>,
  "predicted_ctr_high": <float, realistic upper-bound CTR %, e.g. 7.2>,
  "industry_avg": <float, typical CTR % for ${effectiveNicheCtr||'YouTube'} thumbnails, e.g. 3.1>,
  "categories": {
    "face_prominence":    { "score": <0-20>, "max": 20, "tip": "<specific tip referencing what you see>" },
    "text_readability":   { "score": <0-20>, "max": 20, "tip": "<specific tip referencing what you see>" },
    "color_contrast":     { "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" },
    "emotional_intensity":{ "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" },
    "composition":        { "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" },
    "niche_relevance":    { "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" }
  },
  "issues": ["<2-4 specific issues that hurt CTR>"],
  "wins":   ["<1-3 things already working well>"]
}

Be honest, specific, and reference exactly what you observe in this image. Output only the JSON object.`;

    console.log(`[CTRV2] Scoring for ${req.user.email}${title?` — "${title}"`:''}${niche?` [${niche}]`:''}`);
    const response=await anthropic.messages.create({
      model:CLAUDE_MODEL,
      max_tokens:900,
      messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type,data:imgBase64}},
        {type:'text',text:prompt},
      ]}],
    });

    const raw=response.content[0]?.text?.trim()||'';
    let parsed;
    try{
      const s=raw.indexOf('{'), e=raw.lastIndexOf('}');
      parsed=JSON.parse(raw.slice(s,e+1));
    }catch(err){
      console.error('[CTRV2] Parse failed:',raw.slice(0,200));
      throw new Error('Could not parse Claude response as JSON');
    }

    const cats=parsed.categories||{};
    const nw=nicheProfileCtr?.ctrWeights||{};
    const sanitizeCat=(key,max)=>{
      const rawScore=Math.max(0,Math.min(max,Math.round(Number(cats[key]?.score)||0)));
      const weight=nw[key]||1.0;
      const weighted=Math.max(0,Math.min(max,Math.round(rawScore*weight)));
      return{score:weighted, max, tip:String(cats[key]?.tip||'No tip available.').slice(0,200)};
    };
    const weightedTotal=
      sanitizeCat('face_prominence',20).score+sanitizeCat('text_readability',20).score+
      sanitizeCat('color_contrast',15).score+sanitizeCat('emotional_intensity',15).score+
      sanitizeCat('composition',15).score+sanitizeCat('niche_relevance',15).score;
    const weightedOverall=Math.round((weightedTotal/100)*100);

    res.json({
      success:true,
      overall:    Math.max(0,Math.min(100,nicheProfileCtr?weightedOverall:Math.round(Number(parsed.overall)||50))),
      predicted_ctr_low:  Math.round(Number(parsed.predicted_ctr_low||2)*10)/10,
      predicted_ctr_high: Math.round(Number(parsed.predicted_ctr_high||5)*10)/10,
      industry_avg:       Math.round(Number(parsed.industry_avg||3)*10)/10,
      categories:{
        face_prominence:    sanitizeCat('face_prominence',20),
        text_readability:   sanitizeCat('text_readability',20),
        color_contrast:     sanitizeCat('color_contrast',15),
        emotional_intensity:sanitizeCat('emotional_intensity',15),
        composition:        sanitizeCat('composition',15),
        niche_relevance:    sanitizeCat('niche_relevance',15),
      },
      issues: Array.isArray(parsed.issues)?parsed.issues.slice(0,5).map(s=>String(s).slice(0,120)):[],
      wins:   Array.isArray(parsed.wins)?parsed.wins.slice(0,4).map(s=>String(s).slice(0,120)):[],
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[CTRV2] Error:',err.message);
    res.status(500).json({success:false,error:`CTR analysis failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Face Score — Feature B ─────────────────────────────────────────────────────
app.post('/api/face-score', authMiddleware, async(req,res)=>{
  try{
    const{image}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,rest]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    const response=await anthropic.messages.create({
      model:CLAUDE_MODEL,
      max_tokens:400,
      messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type,data:rest}},
        {type:'text',text:`Analyze the human face in this YouTube thumbnail. Return ONLY valid JSON:\n{"score":<0-100 face impact score>,"emotion":"<detected emotion>","visibility":"<clear/partial/obscured/none>","size":"<large/medium/small/none>","tip":"<one sentence improvement tip>"}\nOutput only the JSON object.`},
      ]}],
    });

    const raw=response.content[0]?.text?.trim()||'{}';
    let parsed={score:50,emotion:'neutral',visibility:'partial',size:'medium',tip:'Face is visible.'};
    try{
      const s=raw.indexOf('{'),e=raw.lastIndexOf('}');
      parsed=JSON.parse(raw.slice(s,e+1));
    }catch(e){ /* use defaults */ }

    res.json({success:true,...parsed,remaining:quota.remaining});
  }catch(err){
    console.error('[FACE-SCORE] Error:',err.message);
    res.status(500).json({success:false,error:`Face score failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Auto Color Grade & Pop — Feature G ────────────────────────────────────────
const COLOR_GRADE_PRESETS = {
  default: {
    gamma:    1.05,
    linear:   [1.15, -18],
    modulate: {brightness:1.04, saturation:1.28, hue:0},
    recomb:   null,
  },
  warm: {
    gamma:    1.10,
    linear:   [1.10, -10],
    modulate: {brightness:1.07, saturation:1.22, hue:10},
    recomb:   [[1.07,0.02,-0.04],[0.01,1.01,-0.01],[-0.05,0.01,0.94]],
  },
  cool: {
    gamma:    0.88,
    linear:   [1.28, -28],
    modulate: {brightness:0.97, saturation:1.18, hue:-14},
    recomb:   [[0.91,0.03,0.05],[0.01,1.00,0.02],[0.03,0.03,1.09]],
  },
  cinematic: {
    gamma:    0.82,
    linear:   [1.18, -22],
    modulate: {brightness:1.05, saturation:0.82, hue:-5},
    recomb:   [[1.03,-0.02,0.04],[0.00,0.97,0.01],[-0.04,0.06,1.04]],
  },
  neon: {
    gamma:    1.0,
    linear:   [1.14, -20],
    modulate: {brightness:1.01, saturation:1.80, hue:6},
    recomb:   [[1.06,-0.02,0.04],[-0.01,1.04,-0.01],[0.04,-0.02,1.09]],
  },
};

async function runColorGradePipeline(imageBuf, presetName, intensity){
  const pr=COLOR_GRADE_PRESETS[presetName]||COLOR_GRADE_PRESETS.default;
  const t=Math.max(0,Math.min(100,intensity))/100;

  const gamma=1+(pr.gamma-1)*t;
  const [linA,linB]=pr.linear;
  const cA=1+(linA-1)*t;
  const cB=linB*t;
  const bMod=1+(pr.modulate.brightness-1)*t;
  const sMod=1+(pr.modulate.saturation-1)*t;
  const hMod=Math.round(pr.modulate.hue*t);

  let pipeline=sharp(imageBuf);

  if(Math.abs(gamma-1)>0.01) pipeline=pipeline.gamma(Math.max(0.3,Math.min(3.0,gamma)));
  pipeline=pipeline.linear(Math.max(0.4,Math.min(2.5,cA)),Math.round(cB));
  pipeline=pipeline.modulate({
    brightness:Math.max(0.5,Math.min(2.0,bMod)),
    saturation:Math.max(0.1,Math.min(3.5,sMod)),
    hue:hMod,
  });

  if(t>0.15){
    pipeline=pipeline.sharpen({sigma:1.5, m1:0.5*t, m2:0.7*t});
  }

  if(pr.recomb&&t>0.05){
    const id=[[1,0,0],[0,1,0],[0,0,1]];
    const lm=pr.recomb.map((row,i)=>row.map((v,j)=>id[i][j]+(v-id[i][j])*t));
    pipeline=pipeline.recomb(lm);
  }

  return pipeline.jpeg({quality:94}).toBuffer();
}

app.post('/api/color-grade', authMiddleware, async(req,res)=>{
  try{
    const{image,preset='default',intensity=80}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    if(!COLOR_GRADE_PRESETS[preset]){
      return res.status(400).json({success:false,error:`Unknown preset: ${preset}`,code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const imageBuf=Buffer.from(imgBase64,'base64');

    console.log(`[COLORGRADE] ${preset} @ ${intensity}% for ${req.user.email}`);
    const outBuf=await runColorGradePipeline(imageBuf,preset,intensity);

    res.json({
      success:true,
      image:`data:image/jpeg;base64,${outBuf.toString('base64')}`,
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[COLORGRADE] Error:',err.message);
    res.status(500).json({success:false,error:`Color grade failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── AI Background Generation — Feature F ──────────────────────────────────────
const NICHE_BG_PROMPTS = {
  gaming:    'neon-lit gaming arena with particle effects, dark atmospheric bokeh, dramatic RGB lighting, no people, no text',
  vlog:      'clean soft lifestyle background, warm bokeh, bright and airy, natural window light, minimal, no people, no text',
  tech:      'dark minimal workspace background, subtle circuit texture, cool-toned depth of field, dark background, no people, no text',
  cooking:   'warm kitchen bokeh background, soft natural light, steam atmosphere, wood and marble surfaces, cozy, no people, no text',
  fitness:   'gym with dramatic lighting, high contrast, motivational dark energy, weight equipment, no people, no text',
  education: 'clean bright whiteboard aesthetic, soft academic warmth, library shelves, open airy light, no people, no text',
};

app.post('/api/generate-background', authMiddleware, async(req,res)=>{
  try{
    const{niche,customPrompt,subject,intensity=100}=req.body;
    if(!niche&&!customPrompt){
      return res.status(400).json({success:false,error:'Provide a niche or custom prompt',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const {profile:bgNicheProfile}=getNicheProfile(req.user.email);
    const nicheBase=NICHE_BG_PROMPTS[niche]||(bgNicheProfile?.defaultBgHint)||'';
    const custom=customPrompt?.trim()||'';
    const fullPrompt=`YouTube thumbnail background: ${[nicheBase,custom].filter(Boolean).join(', ')}. Cinematic, high quality, no watermarks, no logos, no text overlays, no UI elements.`;

    console.log(`[BGGEN] Generating for ${req.user.email} — niche: ${niche||'stored/custom'}`);
    const aiRes=await openai.images.generate({
      model:'dall-e-3',
      prompt:fullPrompt,
      n:1,
      size:'1792x1024',
      quality:'standard',
      style:'vivid',
    });

    const imageUrl=aiRes.data[0].url;
    const imgFetch=await fetch(imageUrl);
    let bgBuf=Buffer.from(await imgFetch.arrayBuffer());

    bgBuf=await sharp(bgBuf).resize(1280,720,{fit:'cover'}).jpeg({quality:93}).toBuffer();

    let finalBuf=bgBuf;

    if(subject&&subject.startsWith('data:image/')){
      const[,subBase64]=subject.split(',');
      const subBuf=Buffer.from(subBase64,'base64');

      const bgStats=await sharp(bgBuf).stats();
      const[bgR,,,bgB]=bgStats.channels;
      const bgWarmth=(bgR.mean-bgB.mean)/255;
      const hueShift=Math.round(bgWarmth*18);

      const featheredSubject=await sharp(subBuf)
        .ensureAlpha()
        .modulate({hue:hueShift})
        .blur(0.8)
        .toBuffer();

      const subMeta=await sharp(featheredSubject).metadata();
      const scale=Math.min(1,720/(subMeta.height||720));
      const scaledW=Math.round((subMeta.width||400)*scale);
      const scaledH=Math.round((subMeta.height||720)*scale);
      const resizedSubject=await sharp(featheredSubject)
        .resize(scaledW,scaledH,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
        .toBuffer();

      const left=Math.round(1280*0.05);
      const top=720-scaledH;
      finalBuf=await sharp(bgBuf)
        .composite([{input:resizedSubject,blend:'over',left:Math.max(0,left),top:Math.max(0,top)}])
        .jpeg({quality:93})
        .toBuffer();
    }

    res.json({
      success:true,
      image:`data:image/jpeg;base64,${finalBuf.toString('base64')}`,
      prompt:fullPrompt,
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[BGGEN] Error:',err.message);
    res.status(500).json({success:false,error:`Background generation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Style Transfer — Feature E ─────────────────────────────────────────────────
const STYLE_PRESETS = {
  mrbeast:   {label:'MrBeast',          mood:'Punchy & Viral',     colors:['#f97316','#facc15','#ef4444','#22c55e','#0ea5e9'], modulate:{brightness:1.18,saturation:1.55,hue:8},  linear:[1.28,-22]},
  mkbhd:     {label:'MKBHD',            mood:'Clean & Minimal',    colors:['#0a0a0a','#18181b','#1d4ed8','#60a5fa','#f1f5f9'], modulate:{brightness:1.04,saturation:0.78,hue:-6}, linear:[1.32,-18]},
  veritasium:{label:'Veritasium',        mood:'Natural & Engaging', colors:['#1a3d2b','#2d6a4f','#52b788','#f4a261','#fefae0'], modulate:{brightness:1.06,saturation:1.18,hue:5},  linear:[1.14,-8]},
  linus:     {label:'Linus Tech Tips',   mood:'Bright & Direct',    colors:['#f8fafc','#e2e8f0','#3b82f6','#1d4ed8','#fbbf24'], modulate:{brightness:1.24,saturation:1.08,hue:0},  linear:[1.08,-4]},
  markrober: {label:'Mark Rober',        mood:'Vibrant & Bold',     colors:['#1d4ed8','#ef4444','#f59e0b','#10b981','#7c3aed'], modulate:{brightness:1.10,saturation:1.42,hue:3},  linear:[1.22,-14]},
};

// L7: SVG attribute-injection escaping
function escapeSvgText(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function isSafeUrl(urlString){
  try{
    const u=new URL(urlString);
    if(!['http:','https:'].includes(u.protocol)) return false;
    const h=u.hostname.toLowerCase().replace(/[\[\]]/g,'');
    if(h==='localhost') return false;
    if(/^127\./.test(h)) return false;
    if(/^10\./.test(h)) return false;
    if(/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if(/^192\.168\./.test(h)) return false;
    if(/^169\.254\./.test(h)) return false;
    // IPv6 private ranges
    if(h==='::1'||h==='[::1]') return false;
    if(/^(fc|fd)/i.test(h)) return false;
    if(/^fe80/i.test(h)) return false;
    // Block non-standard ports
    if(u.port&&u.port!=='80'&&u.port!=='443') return false;
    if(h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.localdomain')) return false;
    return true;
  }catch{return false;}
}

function getDominantColors(rawData, count){
  const freq={};
  for(let i=0;i<rawData.length;i+=3){
    const r=Math.round(rawData[i]/32)*32;
    const g=Math.round(rawData[i+1]/32)*32;
    const b=Math.round(rawData[i+2]/32)*32;
    const key=`${r},${g},${b}`;
    freq[key]=(freq[key]||0)+1;
  }
  return Object.entries(freq)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,count)
    .map(([k])=>{
      const [r,g,b]=k.split(',').map(Number);
      return '#'+[r,g,b].map(v=>Math.min(255,v).toString(16).padStart(2,'0')).join('');
    });
}

async function extractStyleMeta(buf){
  const stats=await sharp(buf).stats();
  const[rS,gS,bS]=stats.channels;
  const brightness=(0.299*rS.mean+0.587*gS.mean+0.114*bS.mean)/255;
  const maxCh=Math.max(rS.mean,gS.mean,bS.mean);
  const minCh=Math.min(rS.mean,gS.mean,bS.mean);
  const saturation=maxCh>8?(maxCh-minCh)/maxCh:0;
  const contrast=(rS.stdev+gS.stdev+bS.stdev)/(3*255);
  const warmth=(rS.mean-bS.mean)/255;
  const {data}=await sharp(buf).resize(60,60).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const colors=getDominantColors(data,5);
  let mood;
  if(brightness>0.62) mood=saturation>0.35?'Vivid & Bright':'Clean & Airy';
  else if(brightness<0.38) mood=saturation>0.28?'Dark & Moody':'Cinematic Dark';
  else mood=warmth>0.08?'Warm & Energetic':warmth<-0.08?'Cool & Minimal':'Natural & Balanced';
  return{brightness,saturation,contrast,warmth,colors,mood};
}

async function applyStylePipeline(imageBuf, modulate, linear, intensity){
  const t=Math.max(0,Math.min(100,intensity))/100;
  const bMod=1+(modulate.brightness-1)*t;
  const sMod=1+(modulate.saturation-1)*t;
  const hMod=(modulate.hue||0)*t;
  const [linA,linB]=linear;
  const cA=1+(linA-1)*t;
  const cB=linB*t;
  return sharp(imageBuf)
    .modulate({brightness:Math.max(0.4,Math.min(2.5,bMod)),saturation:Math.max(0.1,Math.min(3.5,sMod)),hue:hMod})
    .linear(Math.max(0.4,Math.min(2.5,cA)),Math.round(cB))
    .jpeg({quality:93})
    .toBuffer();
}

app.post('/api/style-transfer', authMiddleware, async(req,res)=>{
  try{
    const{image,preset,referenceUrl,intensity=75}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    if(!preset&&!referenceUrl){
      return res.status(400).json({success:false,error:'Provide a preset name or referenceUrl',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const imageBuf=Buffer.from(imgBase64,'base64');

    let styleMeta, processedBuf;

    if(preset){
      const p=STYLE_PRESETS[preset];
      if(!p) return res.status(400).json({success:false,error:`Unknown preset: ${preset}`,code:'INVALID_INPUT'});
      processedBuf=await applyStylePipeline(imageBuf,p.modulate,p.linear,intensity);
      styleMeta={colors:p.colors,mood:p.mood,brightness:p.modulate.brightness,contrast:p.linear[0],saturation:p.modulate.saturation};
      console.log(`[STYLE] Preset "${preset}" applied for ${req.user.email} at intensity ${intensity}%`);
    } else {
      if(!isSafeUrl(referenceUrl)){
        return res.status(400).json({success:false,error:'Invalid or unsafe reference URL',code:'INVALID_INPUT'});
      }
      const refRes=await fetch(referenceUrl,{headers:{'User-Agent':'ThumbFrame/1.0'},timeout:8000});
      if(!refRes.ok) throw new Error(`Failed to fetch reference: ${refRes.status}`);
      const contentType=refRes.headers.get('content-type')||'';
      if(!contentType.startsWith('image/')) throw new Error('Reference URL is not an image');
      const refBuf=Buffer.from(await refRes.arrayBuffer());
      const meta=await extractStyleMeta(refBuf);
      const brightnessMod=Math.max(0.6,Math.min(1.8,0.7+meta.brightness*0.8));
      const satMod=Math.max(0.4,Math.min(2.2,0.5+meta.saturation*1.8));
      const contrastA=Math.max(0.8,Math.min(1.8,1.0+meta.contrast*1.5));
      const contrastB=Math.round(-(60*meta.contrast));
      const hue=Math.round(meta.warmth*28);
      processedBuf=await applyStylePipeline(imageBuf,{brightness:brightnessMod,saturation:satMod,hue},[contrastA,contrastB],intensity);
      styleMeta={colors:meta.colors,mood:meta.mood,brightness:meta.brightness,contrast:meta.contrast,saturation:meta.saturation};
      console.log(`[STYLE] URL extraction applied for ${req.user.email} — mood: ${meta.mood}`);
    }

    res.json({
      success:true,
      processedImage:`data:image/jpeg;base64,${processedBuf.toString('base64')}`,
      style:styleMeta,
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[STYLE] Error:',err.message);
    res.status(500).json({success:false,error:`Style transfer failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── AI Variant Generator — Feature I ──────────────────────────────────────────
app.post('/api/generate-variants', authMiddleware, async(req,res)=>{
  try{
    const{image,title='',niche='gaming',variantType}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    const vt=parseInt(variantType,10);
    if(!vt||vt<1||vt>5){
      return res.status(400).json({success:false,error:'variantType must be 1–5',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email, req.user.plan);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const {niche:storedNicheVar,profile:nicheProfileVar}=getNicheProfile(req.user.email);
    const effectiveNicheVar=niche||storedNicheVar||'gaming';
    const nicheCtxVar=nicheProfileVar?nicheProfileVar.promptContext:'';

    const[,imgBase64]=image.split(',');
    const imageBuf=Buffer.from(imgBase64,'base64');
    const meta=await sharp(imageBuf).metadata();
    const W=meta.width||1280, H=meta.height||720;

    let outBuf, label, description;

    if(vt===1){
      const scale=1/1.3;
      const cw=Math.round(W*scale), ch=Math.round(H*scale);
      const cl=Math.round((W-cw)/2), ct=Math.round((H-ch)/2);
      const cropped=await sharp(imageBuf)
        .extract({left:Math.max(0,cl),top:Math.max(0,ct),width:Math.min(cw,W-cl),height:Math.min(ch,H-ct)})
        .resize(1280,720,{fit:'cover',position:'centre'})
        .jpeg({quality:93}).toBuffer();
      outBuf=await runColorGradePipeline(cropped,'default',85);
      label='Tight + Default';
      description='Cropped 1.3× toward center, default color grade for clean punch';
    }

    else if(vt===2){
      const sw=Math.round(1280*0.85), sh=Math.round(720*0.85);
      const pl=Math.round((1280-sw)/2), pt=Math.round((720-sh)/2);
      const scaled=await sharp(imageBuf).resize(sw,sh,{fit:'fill'}).jpeg({quality:93}).toBuffer();
      const canvas=await sharp({
        create:{width:1280,height:720,channels:3,background:{r:8,g:8,b:12}},
      }).composite([{input:scaled,left:pl,top:pt}]).jpeg({quality:93}).toBuffer();
      outBuf=await runColorGradePipeline(canvas,'warm',85);
      label='Wide + Warm';
      description='Zoomed out 0.85× revealing context, warm color grade';
    }

    else if(vt===3){
      const graded=await runColorGradePipeline(imageBuf,'cool',82);
      let headline=title?(title.toUpperCase().slice(0,36)):'WAIT FOR IT';
      try{
        const nicheHint=nicheCtxVar?` Channel type: ${effectiveNicheVar}. ${nicheCtxVar}`:'';
        const aiRes=await anthropic.messages.create({
          model:CLAUDE_FAST_MODEL,max_tokens:60,
          messages:[{role:'user',content:`Write 1 punchy YouTube thumbnail headline in ALL CAPS, max 5 words, no punctuation except !, for the video: "${title}".${nicheHint} Output the headline only, nothing else.`}],
        });
        const rawHl=aiRes.content[0]?.text?.trim().toUpperCase().replace(/['"]/g,'').slice(0,36);
        if(rawHl) headline=rawHl;
      }catch(e){ /* use fallback */ }
      const safeText=escapeSvgText(headline);
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><text x="56" y="660" font-size="88" font-family="Arial Black,Impact,sans-serif" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="7" stroke-linejoin="round" paint-order="stroke fill">${safeText}</text></svg>`;
      outBuf=await sharp(graded).composite([{input:Buffer.from(svg),blend:'over'}]).jpeg({quality:93}).toBuffer();
      label='Cool + New Text';
      description=`Cool grade, AI headline: "${headline}"`;
    }

    else if(vt===4){
      const graded=await runColorGradePipeline(imageBuf,'cinematic',82);
      const safeText=escapeSvgText((title||'WATCH THIS').toUpperCase().slice(0,36));
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><text x="1224" y="660" font-size="88" font-family="Arial Black,Impact,sans-serif" font-weight="900" text-anchor="end" fill="#ffffff" stroke="#000000" stroke-width="7" stroke-linejoin="round" paint-order="stroke fill">${safeText}</text></svg>`;
      outBuf=await sharp(graded).composite([{input:Buffer.from(svg),blend:'over'}]).jpeg({quality:93}).toBuffer();
      label='Cinematic + Right Text';
      description='Cinematic grade, title anchor shifted to right side';
    }

    else{
      const graded=await runColorGradePipeline(imageBuf,'neon',80);
      const nicheKey=(niche||'gaming').toLowerCase();
      const nicheBase=NICHE_BG_PROMPTS[nicheKey]||NICHE_BG_PROMPTS.gaming;
      const bgPrompt=`YouTube thumbnail background: ${nicheBase}. Cinematic, high quality, vibrant neon lighting, no watermarks, no logos, no text overlays.`;
      console.log(`[VARIANTS] Variant 5 — generating neon+background for ${req.user.email}`);
      const aiImg=await openai.images.generate({model:'dall-e-3',prompt:bgPrompt,n:1,size:'1792x1024',quality:'standard',style:'vivid'});
      const bgUrl=aiImg.data[0].url;
      const bgFetch=await fetch(bgUrl);
      let bgBuf=Buffer.from(await bgFetch.arrayBuffer());
      bgBuf=await sharp(bgBuf).resize(1280,720,{fit:'cover'}).jpeg({quality:93}).toBuffer();
      const subjectLeft=Math.round(W*0.38);
      const subjectW=W-subjectLeft;
      const subjectCrop=await sharp(graded)
        .extract({left:subjectLeft,top:0,width:subjectW,height:H})
        .jpeg({quality:93}).toBuffer();
      outBuf=await sharp(bgBuf)
        .composite([{input:subjectCrop,left:1280-Math.round(1280*0.62),top:0,blend:'over'}])
        .jpeg({quality:93}).toBuffer();
      label='Neon + AI Background';
      description=`Neon grade, AI-generated ${nicheKey} background swap`;
    }

    console.log(`[VARIANTS] type=${vt} "${label}" — generated for ${req.user.email}`);
    res.json({
      success:true,
      variant:{
        base64:`data:image/jpeg;base64,${outBuf.toString('base64')}`,
        label,
        description,
      },
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[VARIANTS] Error:',err.message);
    res.status(500).json({success:false,error:`Variant generation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Feature L: Team Collaboration ─────────────────────────────────────────────

app.post('/api/team/create', authMiddleware, agencyMiddleware, (req,res)=>{
  const {name} = req.body;
  if(!name?.trim()) return res.status(400).json({success:false,error:'Team name required'});
  const teams=loadTeams();
  const teamId=uuidv4();
  teams[teamId]={
    teamId, name:name.trim(),
    owner:req.user.email,
    members:[{email:req.user.email, role:'owner', joinedAt:Date.now()}],
    projects:[],
    createdAt:Date.now(),
  };
  saveTeams(teams);
  const users=loadUsers();
  if(users[req.user.email]) users[req.user.email].teamId=teamId;
  saveUsers(users);
  res.json({success:true, team:teams[teamId]});
});

app.post('/api/team/invite', authMiddleware, agencyMiddleware, async(req,res)=>{
  const {teamId, inviteEmail} = req.body;
  if(!teamId||!inviteEmail) return res.status(400).json({success:false,error:'teamId and inviteEmail required'});
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.status(404).json({success:false,error:'Team not found'});
  if(team.owner!==req.user.email&&!team.members.find(m=>m.email===req.user.email&&m.role==='admin')){
    return res.status(403).json({success:false,error:'Not authorized to invite'});
  }
  const inviteToken=uuidv4();
  if(!team.pendingInvites) team.pendingInvites=[];
  team.pendingInvites.push({email:inviteEmail, token:inviteToken, sentAt:Date.now()});
  saveTeams(teams);
  const frontendUrl=process.env.FRONTEND_URL||'https://www.thumbframe.com';
  const inviteUrl=`${frontendUrl}?team_invite=${inviteToken}&team=${teamId}`;
  try{
    await resend.emails.send({
      from:'ThumbFrame <noreply@thumbframe.com>',
      to:inviteEmail,
      subject:`You've been invited to join "${team.name}" on ThumbFrame`,
      html:`<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px"><h2 style="color:#f97316;margin-top:0">Join ${team.name}</h2><p>${req.user.email} has invited you to collaborate on ThumbFrame.</p><a href="${inviteUrl}" style="display:inline-block;padding:12px 28px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">Accept Invite</a><p style="color:#666;font-size:12px">Link expires in 7 days.</p></div>`,
    });
  }catch(emailErr){
    console.warn('[TEAM INVITE] Email send failed:',emailErr.message);
  }
  res.json({success:true, inviteUrl, teamId});
});

app.get('/api/team/join', authMiddleware, (req,res)=>{
  const {token, teamId} = req.query;
  if(!token||!teamId) return res.status(400).json({success:false,error:'Missing token or teamId'});
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.status(404).json({success:false,error:'Team not found'});
  const invite=team.pendingInvites?.find(i=>i.token===token);
  if(!invite) return res.status(403).json({success:false,error:'Invalid or expired invite'});
  const already=team.members.find(m=>m.email===req.user.email);
  if(!already) team.members.push({email:req.user.email, role:'member', joinedAt:Date.now()});
  team.pendingInvites=team.pendingInvites.filter(i=>i.token!==token);
  saveTeams(teams);
  const users=loadUsers();
  if(users[req.user.email]) users[req.user.email].teamId=teamId;
  saveUsers(users);
  res.json({success:true, team});
});

app.get('/api/team/me', authMiddleware, (req,res)=>{
  const users=loadUsers();
  const teamId=users[req.user.email]?.teamId;
  if(!teamId) return res.json({success:true, team:null});
  const teams=loadTeams();
  res.json({success:true, team:teams[teamId]||null});
});

app.get('/api/team/projects', authMiddleware, (req,res)=>{
  const users=loadUsers();
  const teamId=users[req.user.email]?.teamId;
  if(!teamId) return res.json({success:true, projects:[]});
  const designs=loadDesigns();
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.json({success:true, projects:[]});
  const isMember=team.members.some(m=>m.email===req.user.email);
  if(!isMember) return res.status(403).json({success:false,error:'Not a team member'});
  const teamProjects=(team.projects||[]).map(pid=>designs[pid]).filter(Boolean);
  res.json({success:true, projects:teamProjects, team});
});

app.post('/api/team/share-project', authMiddleware, (req,res)=>{
  const {teamId, projectId} = req.body;
  if(!teamId||!projectId) return res.status(400).json({success:false,error:'teamId and projectId required'});
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.status(404).json({success:false,error:'Team not found'});
  if(!team.projects.includes(projectId)) team.projects.push(projectId);
  saveTeams(teams);
  res.json({success:true});
});

app.post('/api/comments/add', authMiddleware, (req,res)=>{
  const {projectId, x, y, text} = req.body;
  if(!projectId||x==null||y==null||!text?.trim()) return res.status(400).json({success:false,error:'projectId, x, y, text required'});
  const comments=loadComments();
  if(!comments[projectId]) comments[projectId]=[];
  const comment={
    id:uuidv4(),
    projectId,
    userId:req.user.email,
    x:parseFloat(x), y:parseFloat(y),
    text:text.trim(),
    timestamp:Date.now(),
    resolved:false,
    replies:[],
  };
  comments[projectId].push(comment);
  saveComments(comments);
  res.json({success:true, comment});
});

app.get('/api/comments/:projectId', authMiddleware, (req,res)=>{
  const comments=loadComments();
  res.json({success:true, comments:comments[req.params.projectId]||[]});
});

app.patch('/api/comments/:commentId/resolve', authMiddleware, (req,res)=>{
  const comments=loadComments();
  for(const projectId of Object.keys(comments)){
    const idx=comments[projectId].findIndex(c=>c.id===req.params.commentId);
    if(idx>=0){
      // H5: only author or team member can resolve
      const comment=comments[projectId][idx];
      if(comment.userId!==req.user.email){
        const users=loadUsers();
        const teams=loadTeams();
        const teamId=users[req.user.email]?.teamId;
        const team=teamId&&teams[teamId];
        const isTeamMember=team&&team.members.some(m=>m.email===req.user.email);
        if(!isTeamMember) return res.status(403).json({success:false,error:'Not authorized to resolve this comment'});
      }
      comments[projectId][idx].resolved=!comments[projectId][idx].resolved;
      saveComments(comments);
      return res.json({success:true, comment:comments[projectId][idx]});
    }
  }
  res.status(404).json({success:false,error:'Comment not found'});
});

app.post('/api/comments/:commentId/reply', authMiddleware, (req,res)=>{
  const {text}=req.body;
  if(!text?.trim()) return res.status(400).json({success:false,error:'text required'});
  const comments=loadComments();
  for(const projectId of Object.keys(comments)){
    const idx=comments[projectId].findIndex(c=>c.id===req.params.commentId);
    if(idx>=0){
      const reply={id:uuidv4(), userId:req.user.email, text:text.trim(), timestamp:Date.now()};
      comments[projectId][idx].replies.push(reply);
      saveComments(comments);
      return res.json({success:true, reply});
    }
  }
  res.status(404).json({success:false,error:'Comment not found'});
});

app.post('/api/projects/version', authMiddleware, (req,res)=>{
  const {projectId, label, canvasData} = req.body;
  if(!projectId||!canvasData) return res.status(400).json({success:false,error:'projectId and canvasData required'});
  const versions=loadVersions();
  if(!versions[projectId]) versions[projectId]=[];
  const version={
    id:uuidv4(),
    projectId,
    label:label||`Version ${versions[projectId].length+1}`,
    savedBy:req.user.email,
    timestamp:Date.now(),
    canvasData,
  };
  versions[projectId].push(version);
  if(versions[projectId].length>20) versions[projectId]=versions[projectId].slice(-20);
  saveVersions(versions);
  res.json({success:true, version:{...version, canvasData:undefined}});
});

app.get('/api/projects/:projectId/versions', authMiddleware, (req,res)=>{
  const versions=loadVersions();
  const list=(versions[req.params.projectId]||[]).map(v=>({...v, canvasData:undefined}));
  res.json({success:true, versions:list.reverse()});
});

app.get('/api/projects/:projectId/versions/:versionId', authMiddleware, (req,res)=>{
  const versions=loadVersions();
  const v=(versions[req.params.projectId]||[]).find(v=>v.id===req.params.versionId);
  if(!v) return res.status(404).json({success:false,error:'Version not found'});
  res.json({success:true, version:v});
});

app.patch('/api/projects/:projectId/status', authMiddleware, (req,res)=>{
  const {status} = req.body;
  const VALID=['draft','review','approved'];
  if(!VALID.includes(status)) return res.status(400).json({success:false,error:'status must be draft, review, or approved'});
  const designs=loadDesigns();
  if(!designs[req.params.projectId]) return res.status(404).json({success:false,error:'Project not found'});
  designs[req.params.projectId].status=status;
  designs[req.params.projectId].statusUpdatedAt=Date.now();
  designs[req.params.projectId].statusUpdatedBy=req.user.email;
  saveDesigns(designs);
  res.json({success:true, status, projectId:req.params.projectId});
});

// ── Feature K: YouTube History Intelligence ────────────────────────────────────

function getOAuth2Client(){
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://thumbframe-api-production.up.railway.app/api/youtube/callback'
  );
}

app.get('/api/youtube/auth', authMiddleware, (req,res)=>{
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    state: req.user.email,
  });
  res.json({success:true, url});
});

app.get('/api/youtube/callback', async(req,res)=>{
  const {code, state:email} = req.query;
  if(!code||!email) return res.status(400).send('Missing code or state');
  try{
    const oauth2 = getOAuth2Client();
    const {tokens} = await oauth2.getToken(code);
    const users = loadUsers();
    if(!users[email]) return res.status(404).send('User not found');
    users[email].ytTokens = tokens;
    saveUsers(users);
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.thumbframe.com';
    res.redirect(`${frontendUrl}?yt_connected=1`);
  }catch(err){
    console.error('[YT CALLBACK] Error:',err.message);
    res.status(500).send('OAuth failed: '+err.message);
  }
});

app.get('/api/youtube/thumbnails', authMiddleware, async(req,res)=>{
  const users = loadUsers();
  const user  = users[req.user.email];
  if(!user?.ytTokens) return res.status(403).json({success:false, error:'YouTube not connected', code:'YT_NOT_CONNECTED'});

  try{
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials(user.ytTokens);

    oauth2.on('tokens', (tokens)=>{
      if(tokens.refresh_token) user.ytTokens.refresh_token = tokens.refresh_token;
      user.ytTokens.access_token = tokens.access_token;
      users[req.user.email] = user;
      saveUsers(users);
    });

    const youtube   = google.youtube({version:'v3', auth:oauth2});
    const analytics = google.youtubeAnalytics({version:'v2', auth:oauth2});

    const chRes = await youtube.channels.list({part:'id,snippet', mine:true});
    const channel = chRes.data.items?.[0];
    if(!channel) return res.status(404).json({success:false, error:'No channel found'});

    const channelId    = channel.id;
    const channelTitle = channel.snippet?.title || '';
    const channelAvatar= channel.snippet?.thumbnails?.default?.url || '';

    const detailRes  = await youtube.channels.list({part:'contentDetails', id:channelId});
    const uploadsId  = detailRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if(!uploadsId) return res.status(404).json({success:false, error:'No uploads playlist'});

    const plRes = await youtube.playlistItems.list({
      part:'snippet', playlistId:uploadsId, maxResults:50,
    });
    const items    = plRes.data.items || [];
    const videoIds = items.map(i=>i.snippet?.resourceId?.videoId).filter(Boolean);
    if(!videoIds.length) return res.json({success:true, videos:[], channelTitle, channelAvatar});

    const statsRes = await youtube.videos.list({
      part:'snippet,statistics', id:videoIds.join(','),
    });
    const videoMap = {};
    for(const v of statsRes.data.items||[]){
      videoMap[v.id] = {
        id: v.id,
        title: v.snippet?.title||'',
        publishedAt: v.snippet?.publishedAt||'',
        thumbnailUrl: v.snippet?.thumbnails?.maxres?.url
          || v.snippet?.thumbnails?.high?.url
          || v.snippet?.thumbnails?.medium?.url
          || '',
        viewCount: parseInt(v.statistics?.viewCount||'0',10),
        likeCount: parseInt(v.statistics?.likeCount||'0',10),
        commentCount: parseInt(v.statistics?.commentCount||'0',10),
        ctr: null,
        avgViewDuration: null,
      };
    }

    try{
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear()-1);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr   = new Date().toISOString().split('T')[0];
      const analyticsRes = await analytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startStr,
        endDate:   endStr,
        metrics:   'impressionClickThroughRate,averageViewDuration',
        dimensions:'video',
        maxResults: 50,
      });
      for(const row of analyticsRes.data.rows||[]){
        const [vidId, ctr, avgDur] = row;
        if(videoMap[vidId]){
          videoMap[vidId].ctr             = parseFloat((ctr*100).toFixed(2));
          videoMap[vidId].avgViewDuration = Math.round(avgDur);
        }
      }
    }catch(analyticsErr){
      console.warn('[YT THUMBNAILS] Analytics query failed (expected for some channels):',analyticsErr.message);
    }

    const videos = videoIds.map(id=>videoMap[id]).filter(Boolean);
    res.json({success:true, videos, channelTitle, channelAvatar});

  }catch(err){
    console.error('[YT THUMBNAILS] Error:',err.message);
    res.status(500).json({success:false, error:err.message, code:'YT_FETCH_FAILED'});
  }
});

app.post('/api/youtube/analyze', authMiddleware, async(req,res)=>{
  const users = loadUsers();
  const user  = users[req.user.email];
  if(!user?.ytTokens) return res.status(403).json({success:false, error:'YouTube not connected', code:'YT_NOT_CONNECTED'});

  const quota = checkAndDecrementQuota(req.user.email, req.user.plan);
  if(!quota.ok) return res.status(429).json({success:false, error:quota.message, code:quota.code});

  const {videos} = req.body;
  if(!videos?.length) return res.status(400).json({success:false, error:'No videos provided'});

  try{
    const sorted = [...videos].sort((a,b)=>{
      if(a.ctr==null&&b.ctr==null) return b.viewCount-a.viewCount;
      if(a.ctr==null) return 1;
      if(b.ctr==null) return -1;
      return b.ctr-a.ctr;
    });

    const videoSummary = sorted.slice(0,50).map((v,i)=>`${i+1}. "${v.title}"
   Views: ${v.viewCount.toLocaleString()} | CTR: ${v.ctr!=null?v.ctr+'%':'n/a'} | Avg watch: ${v.avgViewDuration!=null?v.avgViewDuration+'s':'n/a'}
   Thumbnail URL: ${v.thumbnailUrl}`).join('\n\n');

    const {niche:storedNiche, profile:nicheProfile} = getNicheProfile(req.user.email);
    const nicheCtx = nicheProfile ? `Channel niche: ${nicheProfile.label}. ${nicheProfile.promptContext}` : '';

    const prompt = `You are a YouTube thumbnail analyst. Analyze the following list of videos with their performance metrics and thumbnail URLs.

${nicheCtx}

VIDEO LIST (sorted by CTR desc):
${videoSummary}

Based on the thumbnail URLs and performance data, analyze patterns in visual style correlated with CTR and view count. Identify:
1. Face positioning patterns (left/right/center/no face) and their CTR correlation
2. Dominant color patterns (warm/cool/high-contrast/muted) and performance
3. Text presence, size, and color patterns vs engagement
4. Background complexity (busy/minimal/gradient/solid) vs CTR
5. Thumbnail composition patterns (close-up/wide/action shot) vs performance
6. Any channel-specific patterns unique to this creator's audience

Return a JSON array of insight objects. Each insight must have:
- "category": one of "face", "color", "text", "background", "composition", "channel"
- "headline": short punchy insight title (max 8 words)
- "detail": 1-2 sentence explanation with specific numbers/percentages if derivable
- "impact": "high", "medium", or "low"
- "recommendation": one concrete action the creator should take
- "applyDefault": optional object like {"colorGrade":"warm"} if a default can be auto-applied

Return ONLY valid JSON array, no markdown, no preamble.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{role:'user', content: prompt}],
    });

    let insights = [];
    const raw = response.content?.[0]?.text?.trim() || '[]';
    try{
      const cleaned = raw.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'');
      insights = JSON.parse(cleaned);
    }catch(parseErr){
      console.error('[YT ANALYZE] JSON parse error:',parseErr.message,'raw:',raw.slice(0,200));
      insights = [{
        category:'channel',
        headline:'Analysis complete',
        detail:'Could not parse structured insights — check the raw response.',
        impact:'low',
        recommendation:'Try again with more video data.',
      }];
    }

    res.json({success:true, insights, remaining:quota.remaining});
  }catch(err){
    console.error('[YT ANALYZE] Error:',err.message);
    res.status(500).json({success:false, error:err.message, code:'ANALYZE_FAILED'});
  }
});

// ── Data file helpers ────────────────────────────────────────────────────────
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');
const REVIEWS_FILE  = path.join(__dirname, 'reviews.json');
const POSTS_FILE    = path.join(__dirname, 'posts.json');

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── POST /api/contact ────────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, category, subject, message, screenshot } = req.body || {};
    if (!name || !email || !category || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email.' });
    }
    if (message.trim().length < 20) {
      return res.status(400).json({ error: 'Message too short.' });
    }

    const entry = {
      id: uuidv4(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      category,
      subject: subject.trim(),
      message: message.trim(),
      hasScreenshot: !!screenshot,
      createdAt: new Date().toISOString(),
    };

    // Persist to contacts.json
    const contacts = readJsonFile(CONTACTS_FILE);
    contacts.push(entry);
    writeJsonFile(CONTACTS_FILE, contacts);

    // Email notification via Resend (best-effort)
    if (process.env.RESEND_API_KEY) {
      try {
        const htmlBody = `
          <h2>New support message from ${entry.name}</h2>
          <p><strong>Email:</strong> ${entry.email}</p>
          <p><strong>Category:</strong> ${entry.category}</p>
          <p><strong>Subject:</strong> ${entry.subject}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left:3px solid #FF6B00;padding-left:12px;color:#555">${entry.message.replace(/\n/g, '<br>')}</blockquote>
          ${entry.hasScreenshot ? '<p><em>Screenshot attached — view in admin panel.</em></p>' : ''}
          <hr/>
          <p style="color:#888;font-size:12px">Received ${entry.createdAt}</p>
        `;
        await resend.emails.send({
          from: 'ThumbFrame Support <support@thumbframe.com>',
          to: ADMIN_EMAIL,
          subject: `[Support] ${entry.category}: ${entry.subject}`,
          html: htmlBody,
          reply_to: entry.email,
        });
      } catch (emailErr) {
        console.warn('[CONTACT] Email send failed:', emailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[CONTACT] Error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/reviews ────────────────────────────────────────────────────────
app.post('/api/reviews', async (req, res) => {
  try {
    const { name, channelUrl, rating, reviewText } = req.body || {};
    if (!name || !rating || !reviewText) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be 1–5.' });
    }
    if (reviewText.trim().length < 30) {
      return res.status(400).json({ error: 'Review too short.' });
    }

    const entry = {
      id: uuidv4(),
      name: name.trim(),
      channelUrl: channelUrl?.trim() || null,
      rating: ratingNum,
      reviewText: reviewText.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const reviews = readJsonFile(REVIEWS_FILE);
    reviews.push(entry);
    writeJsonFile(REVIEWS_FILE, reviews);

    // Notify admin
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'ThumbFrame <support@thumbframe.com>',
          to: ADMIN_EMAIL,
          subject: `[Review] New ${ratingNum}-star review from ${entry.name}`,
          html: `<h3>New review pending approval</h3><p><strong>${entry.name}</strong> — ${'★'.repeat(ratingNum)}${'☆'.repeat(5 - ratingNum)}</p><blockquote>${entry.reviewText}</blockquote>${entry.channelUrl ? `<p>Channel: <a href="${entry.channelUrl}">${entry.channelUrl}</a></p>` : ''}<p>Approve at: /api/admin/reviews/${entry.id}/approve</p>`,
        });
      } catch (emailErr) {
        console.warn('[REVIEWS] Email send failed:', emailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[REVIEWS] Error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/reviews — approved only ────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  try {
    const reviews = readJsonFile(REVIEWS_FILE);
    const approved = reviews
      .filter((r) => r.status === 'approved')
      .map(({ id, name, channelUrl, rating, reviewText, createdAt }) => ({ id, name, channelUrl, rating, reviewText, createdAt }));
    res.json({ reviews: approved });
  } catch (err) {
    console.error('[REVIEWS GET] Error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Admin review endpoints (require admin key header) ────────────────────────
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_KEY || JWT_SECRET;
  if (!key || key !== expected) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

app.get('/api/admin/reviews', adminAuth, (req, res) => {
  try {
    const reviews = readJsonFile(REVIEWS_FILE);
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.patch('/api/admin/reviews/:id/approve', adminAuth, (req, res) => {
  try {
    const reviews = readJsonFile(REVIEWS_FILE);
    const idx = reviews.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Review not found.' });
    reviews[idx].status = 'approved';
    reviews[idx].approvedAt = new Date().toISOString();
    writeJsonFile(REVIEWS_FILE, reviews);
    res.json({ success: true, review: reviews[idx] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Blog read endpoints (public) ─────────────────────────────────────────────
app.get('/api/blog/posts', (req, res) => {
  try {
    const posts = readJsonFile(POSTS_FILE);
    const published = posts
      .filter((p) => p.status === 'published')
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .map(({ id, title, slug, category, heroImage, metaDescription, tags, publishedAt, readTimeMinutes, author }) =>
        ({ id, title, slug, category, heroImage, metaDescription, tags, publishedAt, readTimeMinutes, author }));
    res.json({ posts: published });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/blog/posts/:slug', (req, res) => {
  try {
    const posts = readJsonFile(POSTS_FILE);
    const post = posts.find((p) => p.slug === req.params.slug && p.status === 'published');
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const related = posts
      .filter((p) => p.slug !== post.slug && p.status === 'published')
      .filter((p) => p.category === post.category || (p.tags || []).some((t) => (post.tags || []).includes(t)))
      .slice(0, 3)
      .map(({ id, title, slug, category, heroImage }) => ({ id, title, slug, category, heroImage }));
    res.json({ post, related });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Blog admin endpoints ──────────────────────────────────────────────────────
app.get('/api/admin/blog/posts', adminAuth, (req, res) => {
  try {
    const posts = readJsonFile(POSTS_FILE);
    const sorted = [...posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.json({ posts: sorted });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/admin/blog/posts', adminAuth, (req, res) => {
  try {
    const { title, slug, category, heroImage, body, metaDescription, tags, status, publishedAt, readTimeMinutes, author } = req.body || {};
    if (!title || !slug || !body) return res.status(400).json({ error: 'title, slug, and body are required.' });
    const posts = readJsonFile(POSTS_FILE);
    if (posts.find((p) => p.slug === slug)) return res.status(409).json({ error: 'Slug already exists.' });
    const post = {
      id: uuidv4(),
      title: title.trim(),
      slug: slug.trim(),
      category: category || 'Tutorial',
      heroImage: heroImage || null,
      body: body.trim(),
      metaDescription: (metaDescription || '').trim(),
      tags: Array.isArray(tags) ? tags : (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      status: status || 'draft',
      publishedAt: publishedAt || new Date().toISOString(),
      readTimeMinutes: readTimeMinutes || Math.ceil(body.split(' ').length / 200),
      author: author || 'Kaden, Founder of ThumbFrame',
      createdAt: new Date().toISOString(),
    };
    posts.push(post);
    writeJsonFile(POSTS_FILE, posts);
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.put('/api/admin/blog/posts/:slug', adminAuth, (req, res) => {
  try {
    const posts = readJsonFile(POSTS_FILE);
    const idx = posts.findIndex((p) => p.slug === req.params.slug);
    if (idx === -1) return res.status(404).json({ error: 'Post not found.' });
    const { body, tags, ...rest } = req.body || {};
    posts[idx] = {
      ...posts[idx],
      ...rest,
      body: body ? body.trim() : posts[idx].body,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim()).filter(Boolean)) : posts[idx].tags,
      readTimeMinutes: body ? Math.ceil(body.split(' ').length / 200) : posts[idx].readTimeMinutes,
      updatedAt: new Date().toISOString(),
    };
    writeJsonFile(POSTS_FILE, posts);
    res.json({ success: true, post: posts[idx] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/admin/blog/posts/:slug', adminAuth, (req, res) => {
  try {
    const posts = readJsonFile(POSTS_FILE);
    const filtered = posts.filter((p) => p.slug !== req.params.slug);
    if (filtered.length === posts.length) return res.status(404).json({ error: 'Post not found.' });
    writeJsonFile(POSTS_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/admin/generate-post — AI blog post generation ──────────────────
app.post('/api/admin/generate-post', adminAuth, async (req, res) => {
  try {
    const { keyword, topic, wordCount = 1800 } = req.body || {};
    if (!keyword || !topic) return res.status(400).json({ error: 'keyword and topic are required.' });

    const prompt = `You are an expert SEO content writer for ThumbFrame, an AI-powered YouTube thumbnail editor at thumbframe.com.

Write a comprehensive, SEO-optimized blog post targeting the keyword: "${keyword}"
Topic/angle: "${topic}"
Target word count: ~${wordCount} words

ThumbFrame context:
- AI YouTube thumbnail editor
- Key features: AI background removal, CTR scoring, Prompt-to-Thumbnail generation, full layer editor, PSD export, keyboard shortcuts, curves, liquify, selection tools
- Free plan + Pro ($15/month)
- Built by Kaden, a YouTube creator
- Competes with: Canva, Photoshop, Pixlr, BeFunky

Output a JSON object with these exact fields:
{
  "title": "SEO-optimized title (include keyword, max 70 chars)",
  "slug": "url-friendly-slug-from-title",
  "category": "one of: Tutorial, Guide, Tips, Comparison, Case Study, Feature, News",
  "metaDescription": "compelling 150-160 char meta description with keyword",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "body": "full article in markdown format, ~${wordCount} words, with ## h2 headings, bold key points, practical tips, and 1-2 natural mentions of ThumbFrame where relevant",
  "author": "Kaden, Founder of ThumbFrame",
  "readTimeMinutes": estimated_reading_time_integer,
  "status": "draft"
}

Requirements for the body:
- Start with a compelling hook, not "Introduction"
- Use ## H2 headers for each major section (6-8 sections)
- Include practical, actionable advice
- Reference YouTube creator best practices with real examples
- Naturally mention ThumbFrame once or twice where truly relevant
- End with a strong conclusion and a call to action
- NO fluff, NO generic AI writing — write like a YouTube creator who knows their craft
- Output ONLY valid JSON, no markdown wrapper`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content?.[0]?.text?.trim() || '{}';
    let draft;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      draft = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid JSON. Try again.' });
    }

    draft.publishedAt = new Date().toISOString().split('T')[0];
    draft.heroImage = null;
    res.json({ success: true, draft });
  } catch (err) {
    console.error('[GENERATE POST] Error:', err.message);
    res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

// ── Sitemap ───────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  try {
    const base = 'https://thumbframe.com';
    const posts = readJsonFile(POSTS_FILE).filter((p) => p.status === 'published');
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'weekly' },
      { url: '/features', priority: '0.9', changefreq: 'monthly' },
      { url: '/pricing', priority: '0.9', changefreq: 'monthly' },
      { url: '/blog', priority: '0.8', changefreq: 'daily' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
      { url: '/support', priority: '0.7', changefreq: 'monthly' },
      { url: '/gallery', priority: '0.7', changefreq: 'weekly' },
    ];
    const urls = [
      ...staticPages.map(({ url, priority, changefreq }) =>
        `  <url><loc>${base}${url}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`),
      ...posts.map((p) =>
        `  <url><loc>${base}/blog/${p.slug}</loc><lastmod>${(p.publishedAt || p.createdAt || '').split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
    ].join('\n');
    res.set('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  } catch (err) {
    res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

// ── Robots.txt ────────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/

Sitemap: https://thumbframe.com/sitemap.xml`);
});

// Catch-all route: serve index.html for all non-API requests (SPA routing)
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT,'0.0.0.0',()=>console.log(`🚀 ThumbFrame API running on port ${PORT}`));
