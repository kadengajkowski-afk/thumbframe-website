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
const { Resend } = require('resend');
const supabase   = require('./supabaseAdminClient');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'thumbframe-secret-2024';

const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend     = new Resend(process.env.RESEND_API_KEY);
const replicate  = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

console.log('[INIT] Supabase admin client ready:', !!process.env.SUPABASE_URL && !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY));
console.log('[INIT] Resend client ready:', !!process.env.RESEND_API_KEY);

const allowedOrigins = [
  'https://thumbframe.com',
  'https://www.thumbframe.com',
  process.env.FRONTEND_URL?.trim(),
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

app.options('*', cors());
app.use('/webhook', express.raw({ type:'application/json' }));
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
const KEYS_FILE    = path.join(__dirname,'keys.json');
const USERS_FILE   = path.join(__dirname,'users.json');
const DESIGNS_FILE = path.join(__dirname,'designs.json');

function loadKeys(){ try{ return JSON.parse(fs.readFileSync(KEYS_FILE,'utf8')); }catch(e){ return {}; } }
function saveKeys(k){ fs.writeFileSync(KEYS_FILE,JSON.stringify(k,null,2)); }
function loadUsers(){ try{ return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }catch(e){ return {}; } }
function saveUsers(u){ fs.writeFileSync(USERS_FILE,JSON.stringify(u,null,2)); }
function loadDesigns(){ try{ return JSON.parse(fs.readFileSync(DESIGNS_FILE,'utf8')); }catch(e){ return {}; } }
function saveDesigns(d){ fs.writeFileSync(DESIGNS_FILE,JSON.stringify(d,null,2)); }
function validateKey(key){ const keys=loadKeys(); return keys[key]||null; }

async function getSupabaseUserFromRequest(req){
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if(!accessToken) return { user:null, error:'Missing authorization token' };

  const { data:{ user }, error } = await supabase.auth.getUser(accessToken);
  if(error || !user) return { user:null, error:'Invalid authorization token' };

  return { user, error:null };
}

function authMiddleware(req,res,next){
  const token=req.headers['authorization']?.split(' ')[1];
  if(!token) return res.status(401).json({error:'No token'});
  try{ req.user=jwt.verify(token,JWT_SECRET); next(); }
  catch(e){ res.status(401).json({error:'Invalid token'}); }
}

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/',(req,res)=>res.json({status:'ThumbFrame API running',version:'3.0'}));

// ── Proxy image (CORS fix) ─────────────────────────────────────────────────────
app.get('/proxy-image', async(req,res)=>{
  try{
    const {url}=req.query;
    if(!url) return res.status(400).json({error:'No URL'});
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
app.post('/ai-command', async(req,res)=>{
  try{
    const { command, canvasState } = req.body;
    if(!command) return res.status(400).json({error:'No command'});

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
      model:      'claude-opus-4-20250514',
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
app.post('/remove-bg', async(req,res)=>{
  try{
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
app.post('/auth/signup', async(req,res)=>{
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

app.post('/auth/login', async(req,res)=>{
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

app.get('/auth/me', authMiddleware,(req,res)=>{
  const users=loadUsers();
  const user=users[req.user.email];
  if(!user) return res.status(404).json({error:'User not found'});
  res.json({email:user.email,name:user.name,plan:user.plan||'free'});
});

// ── Brand Kit ──────────────────────────────────────────────────────────────
app.get('/brand-kit', authMiddleware, async(req,res)=>{
  try{
    const {data,error}=await supabase
      .from('brand_kits')
      .select('*')
      .eq('user_id',req.user.email)
      .single();
    
    if(error&&error.code!=='PGRST116') throw error;
    res.json({brandKit:data||null});
  }catch(err){
    console.error('Brand kit fetch error:',err);
    res.status(500).json({error:'Failed to fetch brand kit'});
  }
});

app.post('/brand-kit', authMiddleware, async(req,res)=>{
  try{
    const {primaryColor,secondaryColor,faceImageUrl}=req.body;
    
    if(!primaryColor||!secondaryColor){
      return res.status(400).json({error:'Primary and secondary colors required'});
    }

    const {data,error}=await supabase
      .from('brand_kits')
      .upsert({
        user_email:req.user.email,
        primary_color:primaryColor,
        secondary_color:secondaryColor,
        face_image_url:faceImageUrl||null,
        updated_at:new Date().toISOString(),
      },{onConflict:'user_email'})
      .select()
      .single();

    if(error) throw error;
    res.json({brandKit:data});
  }catch(err){
    console.error('Brand kit save error:',err);
    res.status(500).json({error:'Failed to save brand kit'});
  }
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
const resetTokens = {};

app.post('/auth/forgot-password', async(req,res)=>{
  try{
    const {email}=req.body;
    const users=loadUsers();
    if(!users[email]) return res.json({success:true}); // Don't reveal if email exists
    const token=uuidv4();
    resetTokens[token]={email,expires:Date.now()+3600000}; // 1 hour
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
    const reset=resetTokens[token];
    if(!reset||reset.expires<Date.now())
      return res.status(400).json({error:'Invalid or expired token'});
    const users=loadUsers();
    if(!users[reset.email]) return res.status(400).json({error:'User not found'});
    users[reset.email].hash=await bcrypt.hash(password,10);
    saveUsers(users);
    delete resetTokens[token];
    res.json({success:true});
  }catch(err){
    res.status(500).json({error:'Reset failed'});
  }
});

// ── Designs ────────────────────────────────────────────────────────────────────
app.post('/designs/save', authMiddleware,(req,res)=>{
  try{
    const {
      id,
      name,
      platform,
      layers,
      brightness,
      contrast,
      saturation,
      hue,
      thumbnail,
      json_data,
      canvas_data,
    }=req.body;

    const payloadJsonData =
      (json_data && typeof json_data==='object')
        ? json_data
        : ((canvas_data && typeof canvas_data==='object')
          ? canvas_data
          : {
              name: name || 'Untitled Project',
              platform: platform || 'youtube',
              layers: Array.isArray(layers) ? layers : [],
              brightness: brightness ?? 100,
              contrast: contrast ?? 100,
              saturation: saturation ?? 100,
              hue: hue ?? 0,
            });

    const upsertRow = {
      ...(id ? { id } : {}),
      user_email:req.user.email,
      name:payloadJsonData?.name || name || 'Untitled Project',
      platform:payloadJsonData?.platform || platform || 'youtube',
      thumbnail:thumbnail||null,
      json_data:payloadJsonData,
      last_edited:new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('thumbnails')
      .upsert(upsertRow, { onConflict:'id' })
      .select('id,last_edited,json_data')
      .single();

    if(error){
      console.error('Design save error:', error);
      return res.status(500).json({error:'Save failed'});
    }

    res.json({success:true,data});
  }catch(err){
    console.error('Design save route error:', err);
    res.status(500).json({error:'Save failed'});
  }
});

app.get('/designs/list', async (req, res) => {
  try {
    const email = (req.query.email || '').toString().trim();
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: Email required' });
    }

    const { data, error } = await supabase
      .from('thumbnails')
      .select('id,user_email,name,last_edited,json_data')
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

app.delete('/designs/:id', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  if(!designs[req.user.email]) return res.status(404).json({error:'No designs'});
  designs[req.user.email]=designs[req.user.email].filter(d=>d.id!==req.params.id);
  saveDesigns(designs);
  res.json({success:true});
});

// ── Stripe checkout ────────────────────────────────────────────────────────────
app.post('/checkout', async(req,res)=>{
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

app.post('/webhook', express.raw({type:'application/json'}), async (req,res)=>{
  try{
    const sig=req.headers['stripe-signature'];
    const event=stripe.webhooks.constructEvent(req.body,sig,process.env.STRIPE_WEBHOOK_SECRET);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_details?.email;

        console.log(`[CEO LOG] 🚀 Webhook received for email: ${customerEmail}`);

        if (!customerEmail) {
          console.error("[CEO ERROR] ❌ No email found in Stripe session object.");
          break;
        }

        // UPSERT: This creates the row if it's missing, or updates it if it exists.
        console.log(`[CEO LOG] 🔨 Attempting DB Upsert for ${customerEmail}...`);
        const { data, error: dbError } = await supabase
          .from('profiles')
          .upsert(
            { email: customerEmail, is_pro: true },
            { onConflict: 'email' }
          );

        if (dbError) {
          console.error(`[CEO ERROR] ❌ Supabase rejected the upsert: ${dbError.message}`);
          console.error(`[CEO ERROR] Hint: Check if RLS is blocking the Service Key or if the email column is unique.`);
        } else {
          console.log(`[CEO LOG] ✅ Database successfully updated for ${customerEmail}.`);

          // EMAIL TRIGGER
          try {
            console.log(`[CEO LOG] 📧 Attempting to send Resend email to ${customerEmail}...`);
            await resend.emails.send({
              from: 'ThumbFrame <onboarding@resend.dev>',
              to: customerEmail,
              subject: 'Welcome to ThumbFrame Pro! 🚀',
              html: '<h1>Welcome to Pro!</h1><p>Your features are unlocked.</p>'
            });
            console.log(`[CEO LOG] 📬 Welcome email successfully sent.`);
          } catch (emailErr) {
            console.error(`[CEO ERROR] ❌ Resend failed: ${emailErr.message}`);
          }
        }
        break;
      }
      default:
        break;
    }
    res.json({received:true});
  }catch(err){
    res.status(400).send(`Webhook Error: ${err.message}`);
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
    .then(()=>console.log('Keep-alive ping sent'))
    .catch(()=>console.log('Keep-alive ping failed'));
}, 14 * 60 * 1000);

app.post('/api/analyze-face', (req, res) => {
  // Mock face analysis — returns a single detected face with a score
  res.json({ faces: [{ x: 100, y: 50, w: 120, h: 120, score: 92 }] });
});

// Catch-all route: serve index.html for all non-API requests (SPA routing)
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT,'0.0.0.0',()=>console.log(`🚀 ThumbFrame API running on port ${PORT}`));
