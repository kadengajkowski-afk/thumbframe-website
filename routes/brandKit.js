const express = require('express');

function normalizeBrandKitPayload(body, user) {
  const payload = {
    user_id: user.id,
    user_email: user.email,
    updated_at: new Date().toISOString(),
  };

  const fieldMap = {
    primary_color: ['primary_color', 'primaryColor'],
    secondary_color: ['secondary_color', 'secondaryColor'],
    primary_font: ['primary_font', 'primaryFont'],
    secondary_font: ['secondary_font', 'secondaryFont'],
    face_image_url: ['face_image_url', 'faceImageUrl'],
    subject_url: ['subject_url', 'subjectUrl'],
    outline_color: ['outline_color', 'outlineColor'],
    outline_width: ['outline_width', 'outlineWidth'],
    brand_name: ['brand_name', 'brandName'],
  };

  Object.entries(fieldMap).forEach(([targetKey, sourceKeys]) => {
    for (const sourceKey of sourceKeys) {
      if (body[sourceKey] !== undefined) {
        payload[targetKey] = body[sourceKey];
        break;
      }
    }
  });

  if (payload.subject_url && payload.face_image_url === undefined) {
    payload.face_image_url = payload.subject_url;
  }

  if (payload.face_image_url && payload.subject_url === undefined) {
    payload.subject_url = payload.face_image_url;
  }

  return payload;
}

module.exports = function createBrandKitRouter({ supabase, authMiddleware }) {
  const router = express.Router();

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('user_id', req.userId)
        .maybeSingle();

      if (error) throw error;
      return res.json({ brandKit: data || null });
    } catch (err) {
      console.error('[BRAND KIT] Fetch failed:', err);
      return res.status(500).json({ error: 'Failed to fetch brand kit' });
    }
  });

  router.post('/update', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const payload = normalizeBrandKitPayload(req.body || {}, req.user);
      const { data, error } = await supabase
        .from('brand_kits')
        .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
        .select();

      if (error) {
        console.error('Supabase Error:', error);
        return res.status(500).json(error);
      }

      return res.json(data);
    } catch (err) {
      console.error('[BRAND KIT] Upsert failed:', err);
      return res.status(500).json({ error: 'Failed to save brand kit' });
    }
  });

  return router;
};