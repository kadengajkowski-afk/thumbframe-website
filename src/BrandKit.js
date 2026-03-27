import { useState, useEffect, useRef } from 'react';
import supabase from './supabaseClient';

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
	const autoSaveTimerRef = useRef(null);

	// Auto-save with 2-second debounce
	useEffect(() => {
		if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
		autoSaveTimerRef.current = setTimeout(() => {
			autoSaveBrandKit();
		}, 2000);
		return () => {
			if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [primary, secondary, brandKitFace]);

	async function handleFaceUpload(e) {
		const file = e.target.files[0];
		if (!file) return;

		setUploading(true);
		try {
			const fileExt = file.name.split('.').pop();
			const fileName = `${user?.email || 'user'}_${Date.now()}.${fileExt}`;
			const filePath = `faces/${fileName}`;

			const { error: uploadError } = await supabase.storage
				.from('brand-assets')
				.upload(filePath, file, {
					cacheControl: '3600',
					upsert: true
				});

			if (uploadError) throw uploadError;

			const { data: { publicUrl } } = supabase.storage
				.from('brand-assets')
				.getPublicUrl(filePath);

			setBrandKitFace(publicUrl);
			setUploading(false);
		} catch (err) {
			console.error('Upload failed:', err);
			alert('Upload failed: ' + err.message);
			setUploading(false);
		}
	}

	async function autoSaveBrandKit() {
		if (!user?.email) return;

		setSaveStatus('saving');
		try {
			const { error } = await supabase
				.from('brand_kits')
				.upsert({
					user_email: user.email,
					primary_color: primary,
					secondary_color: secondary,
					face_image_url: brandKitFace,
					updated_at: new Date().toISOString()
				}, {
					onConflict: 'user_email'
				});

			if (error) throw error;

			setBrandKitColors({ primary, secondary });
			setSaveStatus('saved');
			setTimeout(() => setSaveStatus('idle'), 2000);
		} catch (err) {
			console.error('Auto-save failed:', err);
			setSaveStatus('error');
			setTimeout(() => setSaveStatus('idle'), 3000);
		}
	}

	async function saveBrandKit() {
		if (!user?.email) {
			alert('Please log in to save your Brand Kit');
			return;
		}

		setSaveStatus('saving');
		try {
			const { error } = await supabase
				.from('brand_kits')
				.upsert({
					user_email: user.email,
					primary_color: primary,
					secondary_color: secondary,
					face_image_url: brandKitFace,
					updated_at: new Date().toISOString()
				}, {
					onConflict: 'user_email'
				});

			if (error) throw error;

			setBrandKitColors({ primary, secondary });
			setSaveStatus('saved');
			setShowBrandKitSetup(false);
			setCmdLog('✓ Brand Kit saved');
		} catch (err) {
			console.error('Save failed:', err);
			setSaveStatus('error');
			alert('Save failed: ' + err.message);
		}
	}

	return (
		<div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowBrandKitSetup(false);}}>
			<div style={{width:480,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',padding:24}}>
				<div style={{fontSize:18,fontWeight:'700',marginBottom:16,color:T.text}}>Your Brand Kit</div>
				<div style={{fontSize:13,color:T.muted,marginBottom:20,lineHeight:1.6}}>
					Save your brand colors and face image so they're auto-injected into every thumbnail.
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
					<label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Your Face (optional)</label>
					{brandKitFace ? (
						<div style={{position:'relative',width:120,height:120,borderRadius:10,overflow:'hidden',border:`2px solid ${T.border}`}}>
							<img src={brandKitFace} alt="Face" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
							<button onClick={()=>setBrandKitFace(null)} style={{position:'absolute',top:4,right:4,padding:'4px 8px',borderRadius:5,background:'rgba(0,0,0,0.8)',color:'#fff',border:'none',fontSize:10,cursor:'pointer'}}>×</button>
						</div>
					) : (
						<label style={{display:'block',padding:20,borderRadius:10,border:`2px dashed ${T.border}`,textAlign:'center',cursor:'pointer',background:T.input}}>
							<input type="file" accept="image/*" onChange={handleFaceUpload} style={{display:'none'}}/>
							<div style={{fontSize:11,color:T.muted}}>{uploading ? 'Uploading...' : '+ Upload face image'}</div>
						</label>
					)}
				</div>

				<div style={{marginBottom:12,textAlign:'center',fontSize:11,color:saveStatus==='saved'?T.success:saveStatus==='saving'?T.warning:saveStatus==='error'?T.danger:T.muted,fontWeight:'600'}}>
					{saveStatus === 'saving' && '💾 Saving...'}
					{saveStatus === 'saved' && '✓ Changes Saved'}
					{saveStatus === 'error' && '⚠ Save Failed'}
					{saveStatus === 'idle' && 'Auto-save enabled'}
				</div>

				<div style={{display:'flex',gap:8}}>
					<button onClick={()=>setShowBrandKitSetup(false)} style={{flex:1,padding:10,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:13,fontWeight:'600'}}>Cancel</button>
					<button onClick={saveBrandKit} disabled={saveStatus==='saving'} style={{flex:1,padding:10,borderRadius:7,border:'none',background:T.accent,color:'#fff',cursor:saveStatus==='saving'?'not-allowed':'pointer',fontSize:13,fontWeight:'700',opacity:saveStatus==='saving'?0.6:1}}>Save Changes</button>
				</div>
			</div>
		</div>
	);
}
