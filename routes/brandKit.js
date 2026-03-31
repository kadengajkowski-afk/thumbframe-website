const express = require('express');

function normalizeBrandKitPayload(body, user) {
  const payload = {
    user_id: user.id,
    user_email: user.email,
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

  router.post('/update', async (req, res) => {
    console.log("=== BRAND KIT UPSERT TRIGGERED ===");
    console.log("1. Incoming Body:", req.body);

    // Trap 1: Is the user authenticated?
    const userId = req.user?.id || req.body.user_id;
    console.log("2. Target User ID:", userId);

    if (!userId) {
      console.error("❌ ERROR: No User ID found. Request blocked.");
      return res.status(401).json({ error: 'Unauthorized: Missing User ID' });
    }

    // Ensure integers are actually integers
    const safeOutlineWidth = parseInt(req.body.outline_width, 10) || 8;
    console.log("Incoming Brand Kit Payload:", req.body);

    const { data, error } = await supabase
      .from('brand_kits')
      .upsert({
        user_id: userId,
        primary_font: req.body.primary_font,
        secondary_font: req.body.secondary_font,
        brand_colors: req.body.brand_colors,
        subject_image_url: req.body.subject_image_url,
        outline_color: req.body.outline_color,
        outline_width: safeOutlineWidth,
      })
      .select();

    // Trap 2: Did Supabase reject it?
    if (error) {
      console.error("❌ SUPABASE REJECTED THE UPSERT:", error);
      return res.status(500).json({ error: error.message, details: error });
    }

    console.log("✅ SUCCESS: Brand Kit Saved");
    res.json(data);
  });

  return router;
};