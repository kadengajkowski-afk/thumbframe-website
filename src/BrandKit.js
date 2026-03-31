import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import supabase from './supabaseClient';
import getCroppedImg from './utils/getCroppedImg';

export default function BrandKitSetupModal({
  T,
  token,
  apiUrl,
  user,
  brandKit,
  setBrandKit,
  brandKitColors,
  setBrandKitColors,
  brandKitFace,
  setBrandKitFace,
  setShowBrandKitSetup,
  setCmdLog
}) {
  const [primary, setPrimary] = useState(brandKit?.primary_color || brandKitColors.primary || '#000000');
  const [secondary, setSecondary] = useState(brandKit?.secondary_color || brandKitColors.secondary || '#ffffff');
  const [primaryFont, setPrimaryFont] = useState(brandKit?.primary_font || 'Anton');
  const [outlineColor, setOutlineColor] = useState(brandKit?.outline_color || '#ffffff');
  const [outlineWidth, setOutlineWidth] = useState(brandKit?.outline_width || 5);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);
  const [cropSource, setCropSource] = useState(null);
  const [cropObjectUrl, setCropObjectUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const resolvedApiUrl = (apiUrl || process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
  const fontOptions = ['Anton', 'Burbank', 'Komika Axis', 'Bangers', 'Bebas Neue', 'Oswald'];

  useEffect(() => {
    return () => {
      if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    };
  }, [cropObjectUrl]);

  function clearCropSource() {
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    setCropObjectUrl(null);
    setCropSource(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  async function uploadCroppedFaceIfNeeded(activeUser) {
    if (!cropSource || !croppedAreaPixels) return brandKitFace;

    setIsProcessingCrop(true);
    try {
      const croppedBlob = await getCroppedImg(cropSource, croppedAreaPixels, {
        type: 'image/png',
        quality: 1,
      });
      const fileName = `${activeUser?.email || user?.email || 'user'}_${Date.now()}.png`;
      const filePath = `faces/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, croppedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/png'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(filePath);

      setBrandKitFace(publicUrl);
      clearCropSource();
      setCmdLog('✓ Face cropped in high resolution and uploaded');
      return publicUrl;
    } finally {
      setIsProcessingCrop(false);
    }
  }

  function handleFaceUploadSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    const objectUrl = URL.createObjectURL(file);
    setCropObjectUrl(objectUrl);
    setCropSource(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  async function handleSave() {
    setSaveStatus('saving');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

      if (sessionError || !session?.access_token) {
        throw new Error('No active session found');
      }

      if (userError || !authUser) {
        throw new Error('No user found');
      }

      const resolvedFaceUrl = await uploadCroppedFaceIfNeeded(authUser);

      const response = await fetch(`${resolvedApiUrl}/brand-kit/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token || token || user?.token || ''}`,
        },
        body: JSON.stringify({
          user_id: authUser.id,
          primary_color: primary,
          secondary_color: secondary,
          primary_font: primaryFont,
          outline_color: outlineColor,
          outline_width: outlineWidth,
          face_image_url: resolvedFaceUrl || null,
          subject_url: resolvedFaceUrl || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to save Brand Kit');

      const savedKit = Array.isArray(result)
        ? (result[0] || null)
        : (result?.brandKit || result || null);
      setBrandKit(savedKit);
      setBrandKitColors({
        primary: savedKit?.primary_color || primary,
        secondary: savedKit?.secondary_color || secondary,
      });
      setBrandKitFace(savedKit?.subject_url || savedKit?.face_image_url || resolvedFaceUrl || null);
      setSaveStatus('saved');
      setCmdLog('✓ Pro Brand Kit saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      alert('Save failed: ' + err.message);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowBrandKitSetup(false);}}>
      <div style={{width:560,background:T.panel,borderRadius:18,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',padding:24}}>
        <div style={{fontSize:18,fontWeight:'700',marginBottom:16,color:T.text}}>Your Brand Kit</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:20,lineHeight:1.6}}>
          Save your signature subject, fonts, colors, and contour outline so the editor can inject them instantly.
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div>
            <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Primary Font</label>
            <select value={primaryFont} onChange={e=>setPrimaryFont(e.target.value)} style={{width:'100%',height:40,borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,padding:'0 10px',fontFamily:'inherit'}}>
              {fontOptions.map(font => <option key={font} value={font}>{font}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Outline Color</label>
            <input type="color" value={outlineColor} onChange={e=>setOutlineColor(e.target.value)} style={{width:'100%',height:40,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer'}}/>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Outline Width — {outlineWidth}px</label>
          <input type="range" min={1} max={20} step={1} value={outlineWidth} onChange={e=>setOutlineWidth(Number(e.target.value))} style={{width:'100%'}}/>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Primary Color</label>
          <input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} style={{width:'100%',height:40,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer'}}/>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Secondary Color</label>
          <input type="color" value={secondary} onChange={e=>setSecondary(e.target.value)} style={{width:'100%',height:40,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer'}}/>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Primary Subject (1:1 crop)</label>
          {brandKitFace ? (
            <div style={{position:'relative',width:140,height:140,borderRadius:14,overflow:'hidden',border:`2px solid ${T.border}`}}>
              <img src={brandKitFace} alt="Face" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              <button onClick={()=>setBrandKitFace(null)} style={{position:'absolute',top:6,right:6,padding:'4px 8px',borderRadius:999,background:'rgba(0,0,0,0.8)',color:'#fff',border:'none',fontSize:10,cursor:'pointer'}}>Remove</button>
            </div>
          ) : (
            <label style={{display:'block',padding:20,borderRadius:12,border:`2px dashed ${T.border}`,textAlign:'center',cursor:'pointer',background:T.input}}>
              <input type="file" accept="image/*" onChange={handleFaceUploadSelect} style={{display:'none'}}/>
              <div style={{fontSize:11,color:T.muted}}>{isProcessingCrop ? 'Processing...' : '+ Upload primary subject'}</div>
            </label>
          )}
        </div>

        {cropSource && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:'600'}}>Crop your subject (square)</div>
            <div style={{position:'relative',width:'100%',height:280,borderRadius:10,overflow:'hidden',background:'#111'}}>
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPx)=>{
                  setCroppedAreaPixels(croppedAreaPx);
                }}
              />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
              <label style={{fontSize:11,color:T.muted,fontWeight:'600'}}>Zoom</label>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e=>setZoom(Number(e.target.value))} style={{flex:1}}/>
              <button onClick={clearCropSource} style={{padding:'8px 12px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:12,fontWeight:'600'}}>
                Cancel
              </button>
            </div>
            <div style={{fontSize:10,color:T.muted,marginTop:6}}>
              Crop is applied when you click Save Brand Kit.
            </div>
          </div>
        )}

        <div style={{marginBottom:12,textAlign:'center',fontSize:11,color:saveStatus==='saved'?T.success:saveStatus==='saving'?T.warning:saveStatus==='error'?T.danger:T.muted,fontWeight:'600'}}>
          {isProcessingCrop && 'Processing high-res crop...'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Changes Saved'}
          {saveStatus === 'error' && 'Save Failed'}
          {saveStatus === 'idle' && !isProcessingCrop && 'Click Save Brand Kit to store changes'}
        </div>

        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowBrandKitSetup(false)} style={{flex:1,padding:10,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:13,fontWeight:'600'}}>Cancel</button>
          <button onClick={handleSave} disabled={saveStatus==='saving' || isProcessingCrop} style={{flex:1,padding:10,borderRadius:7,border:'none',background:T.accent,color:'#fff',cursor:(saveStatus==='saving' || isProcessingCrop)?'not-allowed':'pointer',fontSize:13,fontWeight:'700',opacity:(saveStatus==='saving' || isProcessingCrop)?0.6:1}}>{isProcessingCrop?'Processing...':'Save Brand Kit'}</button>
        </div>
      </div>
    </div>
  );
}
