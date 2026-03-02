/**
 * copperhead. portal — in-memory data store
 * Pure JS, zero native dependencies. Seed data regenerates on each start.
 */

// ──────────────────────────────────────────
// Auto-increment IDs
// ──────────────────────────────────────────
let nextPostId = 1;
let nextCommentId = 1;
let nextAnalyticsId = 1;
let nextAssetId = 1;

function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

// ──────────────────────────────────────────
// Data stores
// ──────────────────────────────────────────
const posts = [];
const comments = [];
const analytics = [];
const assets = [];

// ──────────────────────────────────────────
// Seed demo data
// ──────────────────────────────────────────
function addPost(title, caption, platform, status, scheduled_date, media_type) {
  const ts = now();
  posts.push({
    id: nextPostId++, title, caption, platform, media_url: null,
    media_type: media_type || 'image', status, scheduled_date,
    published_date: null, created_at: ts, updated_at: ts
  });
}

function addComment(post_id, author, content, is_internal) {
  comments.push({
    id: nextCommentId++, post_id, author, content,
    is_internal: is_internal ? 1 : 0, created_at: now()
  });
}

// Posts — rich demo content for "journals." client portal
addPost('Spring Collection Launch', 'New arrivals are here 🌿 Which piece is your favorite? Drop a comment below!\n\n#springcollection #newdrops #fashion', 'instagram', 'published', '2026-03-01', 'image');
addPost('Behind the Scenes', 'A look at how the magic happens. Swipe to see the full setup →\n\n#bts #contentcreation #onset', 'instagram', 'published', '2026-03-01', 'image');
addPost('March Content Kickoff', 'Big things coming this month. Stay tuned 👀\n\n#march #comingsoon', 'tiktok', 'published', '2026-03-02', 'video');
addPost('Client Testimonial — Sarah K.', '"Working with journals. has completely transformed how I show up online." — Sarah K.\n\nFull story in bio ↗', 'facebook', 'published', '2026-02-28', 'video');
addPost('Product Spotlight: Copper Mug', 'Handcrafted. Timeless. Available now.\n\nShop the link in bio.', 'instagram', 'scheduled', '2026-03-03', 'image');
addPost('Weekend Vibes Reel', 'POV: your weekend plans just got an upgrade 🎬\n\n#reels #weekendvibes', 'tiktok', 'approved', '2026-03-04', 'video');
addPost('Founder Story Carousel', 'From a side project to a full-time passion — the story of how journals. came to be.\n\nSwipe through for the full journey →', 'instagram', 'pending', '2026-03-05', 'image');
addPost('Quick Tips: Lighting Setup', 'Three simple tips to upgrade your at-home content lighting. Save this for later 💡\n\n#contenttips #lighting #creator', 'tiktok', 'approved', '2026-03-06', 'video');
addPost('Community Feature Friday', 'Shoutout to our amazing community this week 🙌\n\nTag us to be featured next Friday!\n\n#communitylove #featurefriday', 'instagram', 'scheduled', '2026-03-07', 'image');
addPost('Event Recap: Art Walk', 'Last night was one for the books. Thanks to everyone who came out to the Art Walk!\n\n#events #community #artnight', 'facebook', 'published', '2026-02-27', 'image');
addPost('Monday Motivation', 'Start your week with intention. What\'s one thing you\'re focusing on this week?\n\n#mondaymotivation #intentionalliving', 'instagram', 'pending', '2026-03-09', 'image');
addPost('New Workshop Announcement', 'We\'re hosting a brand photography workshop on March 20th! Limited spots — link in bio to register.\n\n#workshop #brandphotography', 'facebook', 'pending', '2026-03-10', 'image');
addPost('Mini Vlog: Studio Day', 'Spend the day with us in the studio. Lots of coffee, good music, and great content.\n\n#studiovlog #dayinthelife', 'tiktok', 'draft', '2026-03-11', 'video');
addPost('Flash Sale Announcement', '48 hours only. 25% off everything in store. Use code COPPER25 at checkout.\n\n#flashsale #shopnow', 'facebook', 'pending', '2026-03-12', 'image');
addPost('Meet the Team', 'The faces behind the brand. Get to know the creators who make it all happen.\n\n#meettheteam #agency #copperhead', 'instagram', 'draft', '2026-03-14', 'image');
addPost('Recipe Reel: Matcha Latte', 'Our go-to morning ritual. Oat milk + ceremonial grade matcha = perfection ✨\n\n#matcha #morningroutine', 'tiktok', 'scheduled', '2026-03-15', 'video');
addPost('Q&A Story Series', 'You asked, we answered. Tap through for our most-asked questions about branding & content.\n\n#qanda #branding', 'instagram', 'approved', '2026-03-16', 'image');
addPost('Spring Cleaning for Your Brand', 'Is your brand due for a refresh? Here are 5 signs it\'s time.\n\nSave this post for later 📌', 'facebook', 'draft', '2026-03-18', 'image');
addPost('Throwback Thursday', 'One year ago vs. now — what a difference consistency makes.\n\n#tbt #growth #brandjourney', 'instagram', 'scheduled', '2026-03-20', 'image');
addPost('End of Month Wrap-Up', 'March was a big month. Here\'s a look back at everything we accomplished together.\n\n#monthlyrecap #progress', 'tiktok', 'draft', '2026-03-28', 'video');

// Comments — rich back-and-forth for demo
addComment(1, 'Copperhead', 'Here\'s the finalized graphic for the launch post — let us know if the color feels right!', true);
addComment(1, 'Client', 'Love this! The earthy tones are perfect. Approved.', false);
addComment(7, 'Copperhead', 'Carousel draft is ready — 6 slides with your brand story arc. Caption attached above.', true);
addComment(7, 'Client', 'Love the caption! Can we swap the emoji to something more on-brand?', false);
addComment(7, 'Copperhead', 'Absolutely — how about 🍂 to match the earthy tones?', true);
addComment(7, 'Client', 'Perfect, go with that!', false);
addComment(6, 'Client', 'This is great but can we add a CTA at the end?', false);
addComment(6, 'Copperhead', 'Done! Added "Double tap if this is your vibe" at the end.', true);
addComment(11, 'Copperhead', 'Drafted this for Monday — felt motivational but still on-brand. Thoughts?', true);
addComment(11, 'Client', 'I like the direction, but can we make it a bit more specific to our industry?', false);
addComment(14, 'Client', 'Can we change the discount to 30%?', false);
addComment(14, 'Copperhead', 'Updated! Code is now COPPER30 for 30% off. Want us to change the graphic too?', true);
addComment(12, 'Copperhead', 'Workshop details are confirmed. Here\'s the promotional copy for your review.', true);
addComment(8, 'Client', 'Approved! This looks amazing.', false);
addComment(16, 'Copperhead', 'Matcha reel is filmed and edited. Preview link attached. 🍵', true);

// Analytics (last 30 days)
const platforms = ['instagram', 'tiktok'];
const metrics = ['impressions', 'reach', 'engagement', 'followers'];
const baseValues = {
  instagram: { impressions: 12000, reach: 8500, engagement: 450, followers: 2840 },
  tiktok:    { impressions: 18000, reach: 14000, engagement: 780, followers: 1920 }
};

for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0];

  for (const platform of platforms) {
    for (const metric of metrics) {
      const base = baseValues[platform][metric];
      const variance = (Math.random() - 0.4) * base * 0.3;
      const trend = (30 - daysAgo) * (base * 0.005);
      const value = Math.max(0, Math.round(base + variance + trend));
      analytics.push({
        id: nextAnalyticsId++, platform, metric, value, date: dateStr, created_at: now()
      });
    }
  }
}

console.log('  ✓ Data store ready with demo data');

// ──────────────────────────────────────────
// Query helpers (used by server.js)
// ──────────────────────────────────────────
const db = {
  // ── Posts ─────────────────────────────────
  getPosts({ status, platform, month, year } = {}) {
    let result = [...posts];
    if (status) result = result.filter(p => p.status === status);
    if (platform) result = result.filter(p => p.platform === platform);
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      result = result.filter(p => {
        if (!p.scheduled_date) return false;
        const d = new Date(p.scheduled_date);
        return d.getMonth() + 1 === m && d.getFullYear() === y;
      });
    }
    result.sort((a, b) => {
      const da = a.scheduled_date || '';
      const db2 = b.scheduled_date || '';
      if (da !== db2) return da.localeCompare(db2);
      return b.created_at.localeCompare(a.created_at);
    });
    return result;
  },

  getPost(id) {
    return posts.find(p => p.id === parseInt(id)) || null;
  },

  createPost(data) {
    const ts = now();
    const post = {
      id: nextPostId++,
      title: data.title,
      caption: data.caption || '',
      platform: data.platform,
      media_url: data.media_url || null,
      media_type: data.media_type || 'image',
      status: data.status || 'draft',
      scheduled_date: data.scheduled_date || null,
      published_date: null,
      created_at: ts,
      updated_at: ts
    };
    posts.push(post);
    return post;
  },

  updatePost(id, data) {
    const post = posts.find(p => p.id === parseInt(id));
    if (!post) return null;
    const allowed = ['title', 'caption', 'platform', 'status', 'scheduled_date', 'media_url', 'media_type', 'published_date'];
    for (const key of allowed) {
      if (data[key] !== undefined) post[key] = data[key];
    }
    post.updated_at = now();
    return post;
  },

  deletePost(id) {
    const idx = posts.findIndex(p => p.id === parseInt(id));
    if (idx !== -1) {
      posts.splice(idx, 1);
      // Cascade delete comments
      for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i].post_id === parseInt(id)) comments.splice(i, 1);
      }
    }
  },

  // ── Comments ──────────────────────────────
  getComments(postId) {
    return comments
      .filter(c => c.post_id === parseInt(postId))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  createComment(postId, data) {
    const comment = {
      id: nextCommentId++,
      post_id: parseInt(postId),
      author: data.author || 'Client',
      content: data.content,
      is_internal: data.is_internal ? 1 : 0,
      created_at: now()
    };
    comments.push(comment);
    return comment;
  },

  // ── Analytics ─────────────────────────────
  getAnalytics({ platform, metric, days } = {}) {
    const numDays = parseInt(days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - numDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    let result = analytics.filter(a => a.date >= cutoffStr);
    if (platform) result = result.filter(a => a.platform === platform);
    if (metric) result = result.filter(a => a.metric === metric);
    result.sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform));
    return result;
  },

  getAnalyticsSummary({ days, platform } = {}) {
    const numDays = parseInt(days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - numDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - numDays * 2);
    const prevCutoffStr = prevCutoff.toISOString().split('T')[0];

    // Current period
    let current = analytics.filter(a => a.date >= cutoffStr);
    if (platform) current = current.filter(a => a.platform === platform);

    // Build summary by platform+metric
    const groups = {};
    current.forEach(a => {
      const key = `${a.platform}:${a.metric}`;
      if (!groups[key]) groups[key] = { platform: a.platform, metric: a.metric, total: 0, count: 0, peak: 0 };
      groups[key].total += a.value;
      groups[key].count++;
      if (a.value > groups[key].peak) groups[key].peak = a.value;
    });
    const currentSummary = Object.values(groups).map(g => ({
      platform: g.platform, metric: g.metric,
      total: g.total, average: Math.round(g.total / g.count), peak: g.peak
    }));

    // Previous period
    let prev = analytics.filter(a => a.date >= prevCutoffStr && a.date < cutoffStr);
    if (platform) prev = prev.filter(a => a.platform === platform);

    const prevGroups = {};
    prev.forEach(a => {
      const key = `${a.platform}:${a.metric}`;
      if (!prevGroups[key]) prevGroups[key] = { platform: a.platform, metric: a.metric, total: 0 };
      prevGroups[key].total += a.value;
    });
    const previousSummary = Object.values(prevGroups);

    return { current: currentSummary, previous: previousSummary };
  },

  // ── Assets ────────────────────────────────
  getAssets() {
    return [...assets].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  },

  createAsset(data) {
    const asset = {
      id: nextAssetId++,
      filename: data.filename,
      original_name: data.original_name,
      file_type: data.file_type,
      file_size: data.file_size || 0,
      uploaded_at: now()
    };
    assets.push(asset);
    return asset;
  },

  getAsset(id) {
    return assets.find(a => a.id === parseInt(id)) || null;
  },

  deleteAsset(id) {
    const idx = assets.findIndex(a => a.id === parseInt(id));
    if (idx !== -1) return assets.splice(idx, 1)[0];
    return null;
  }
};

module.exports = db;
