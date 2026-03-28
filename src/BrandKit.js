import { useState } from 'react';
import Cropper from 'react-easy-crop';
import supabase from './supabaseClient';

function createImage(url){
  return new Promise((resolve,reject)=>{
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = ()=>resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function getCroppedBlob(imageSrc, pixelCrop){
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(pixelCrop.width));
  canvas.height = Math.max(1, Math.floor(pixelCrop.height));
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve,reject)=>{
    canvas.toBlob((blob)=>{
      if(blob) resolve(blob);
      else reject(new Error('Failed to generate cropped image blob'));
    }, 'image/png');
  });
}

export default function BrandKitSetupModal({
  T,
  token,
  user,
  brandKitColors,
  setBrandKitColors,
  brandKitFace,
  setBrandKitFace,
  setShowBrandKitSetup,
  setCmdLog
}) {
  const [primary, setPrimary] = useState(brandKitColors.primary);
  const [secondary, setSecondary] = useState(brandKitColors.secondary);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  const [cropSource, setCropSource] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  async function uploadCroppedFace(){
    if(!cropSource || !croppedAreaPixels) return;

    setUploading(true);
    try {
      const croppedBlob = await getCroppedBlob(cropSource, croppedAreaPixels);
      const fileName = `${user?.email || 'user'}_${Date.now()}.png`;
      const filePath = `faces/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, croppedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/png'
        });

      if(uploadError) throw uploadError;

      const { data:{ publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(filePath);

      setBrandKitFace(publicUrl);
      setCropSource(null);
      setCmdLog('✓ Face image cropped and uploaded');
    } catch (err) {
      console.error('Face upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleFaceUploadSelect(e){
    const file = e.target.files?.[0];
    if(!file) return;

    const objectUrl = URL.createObjectURL(file);
    setCropSource(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  const handleSave = async () => {
    setSaveStatus('saving');

    try {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !authUser) {
        throw new Error('No user found');
      }

      const data = {
        user_id: authUser.id,
        user_email: authUser.email,
        primary_color: primary,
        secondary_color: secondary,
        face_image_url: brandKitFace,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('brand_kits')
        .upsert(data, { onConflict: 'user_email' });

      if (error) throw error;

      setBrandKitColors({ primary, secondary });
      setSaveStatus('saved');
      setCmdLog('✓ Brand Kit saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowBrandKitSetup(false);}}>
      <div style={{width:520,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',padding:24}}>
        <div style={{fontSize:18,fontWeight:'700',marginBottom:16,color:T.text}}>Your Brand Kit</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:20,lineHeight:1.6}}>
          Save your brand colors and face image so they are auto-injected into every thumbnail.
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
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Your Face (1:1 crop)</label>
          {brandKitFace ? (
            <div style={{position:'relative',width:120,height:120,borderRadius:10,overflow:'hidden',border:`2px solid ${T.border}`}}>
              <img src={brandKitFace} alt="Face" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              <button onClick={()=>setBrandKitFace(null)} style={{position:'absolute',top:4,right:4,padding:'4px 8px',borderRadius:5,background:'rgba(0,0,0,0.8)',color:'#fff',border:'none',fontSize:10,cursor:'pointer'}}>x</button>
            </div>
          ) : (
            <label style={{display:'block',padding:20,borderRadius:10,border:`2px dashed ${T.border}`,textAlign:'center',cursor:'pointer',background:T.input}}>
              <input type="file" accept="image/*" onChange={handleFaceUploadSelect} style={{display:'none'}}/>
              <div style={{fontSize:11,color:T.muted}}>{uploading ? 'Uploading...' : '+ Upload face image'}</div>
            </label>
          )}
        </div>

        {cropSource && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:'600'}}>Crop your face (square)</div>
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
                onCropComplete={(croppedArea, croppedAreaPx)=>{
                  setCroppedAreaPixels(croppedAreaPx);
                }}
              />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
              <label style={{fontSize:11,color:T.muted,fontWeight:'600'}}>Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e)=>setZoom(Number(e.target.value))}
                style={{flex:1}}
              />
              <button
                onClick={uploadCroppedFace}
                disabled={uploading || !croppedAreaPixels}
                style={{padding:'8px 12px',borderRadius:7,border:'none',background:T.accent,color:'#fff',cursor:uploading?'not-allowed':'pointer',fontSize:12,fontWeight:'700',opacity:uploading?0.6:1}}
              >
                {uploading ? 'Saving...' : 'Use cropped face'}
              </button>
              <button
                onClick={()=>setCropSource(null)}
                style={{padding:'8px 12px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:12,fontWeight:'600'}}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{marginBottom:12,textAlign:'center',fontSize:11,color:saveStatus==='saved'?T.success:saveStatus==='saving'?T.warning:saveStatus==='error'?T.danger:T.muted,fontWeight:'600'}}>
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Changes Saved'}
          {saveStatus === 'error' && 'Save Failed'}
          {saveStatus === 'idle' && 'Click Save Brand Kit to store changes'}
        </div>

        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowBrandKitSetup(false)} style={{flex:1,padding:10,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:13,fontWeight:'600'}}>Cancel</button>
          <button onClick={handleSave} disabled={saveStatus==='saving'} style={{flex:1,padding:10,borderRadius:7,border:'none',background:T.accent,color:'#fff',cursor:saveStatus==='saving'?'not-allowed':'pointer',fontSize:13,fontWeight:'700',opacity:saveStatus==='saving'?0.6:1}}>Save Brand Kit</button>
        </div>
      </div>
    </div>
  );
}
