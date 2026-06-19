// שכבת נתונים: Supabase בפרודקשן, וזיכרון מקומי לפיתוח מהיר.

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseServiceKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

const memory = {
  users: new Map(),
  sites: new Map(),
  pages: new Map()
};

async function upsertUser(googleUser) {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from("users")
      .upsert(googleUser, { onConflict: "google_id" })
      .select()
      .single();

    if (error) {
      throw new Error(`שגיאה בשמירת המשתמש ב-Supabase: ${error.message}`);
    }

    return data;
  }

  const existing = [...memory.users.values()].find((user) => user.google_id === googleUser.google_id);
  const user = {
    id: existing?.id || crypto.randomUUID(),
    ...googleUser,
    created_at: existing?.created_at || now()
  };

  memory.users.set(user.id, user);
  return user;
}

async function createSiteWithPages(input) {
  const site = {
    id: crypto.randomUUID(),
    user_id: input.user.id,
    site_name: input.siteName,
    drive_folder_url: input.driveFolderUrl,
    drive_folder_id: input.driveFolderId,
    public_slug: await uniqueSlug(input.siteName),
    primary_color: input.primaryColor,
    logo_url: input.logoUrl,
    is_public: input.isPublic,
    created_at: now(),
    updated_at: now()
  };

  if (hasSupabase) {
    const { data: savedSite, error: siteError } = await supabase
      .from("sites")
      .insert(site)
      .select()
      .single();

    if (siteError) {
      throw new Error(`שגיאה בשמירת האתר ב-Supabase: ${siteError.message}`);
    }

    await insertPages(savedSite.id, input.pages);
    return getSiteWithPages(savedSite.id);
  }

  memory.sites.set(site.id, site);
  savePagesInMemory(site.id, input.pages);
  return attachPages(site);
}

async function replaceSitePages(siteId, pages) {
  if (hasSupabase) {
    const { error: deleteError } = await supabase.from("pages").delete().eq("site_id", siteId);

    if (deleteError) {
      throw new Error(`שגיאה במחיקת עמודים ישנים: ${deleteError.message}`);
    }

    await insertPages(siteId, pages);

    const { error: updateError } = await supabase
      .from("sites")
      .update({ updated_at: now() })
      .eq("id", siteId);

    if (updateError) {
      throw new Error(`שגיאה בעדכון זמן האתר: ${updateError.message}`);
    }

    return getSiteWithPages(siteId);
  }

  const site = memory.sites.get(siteId);
  site.updated_at = now();
  savePagesInMemory(siteId, pages);
  return attachPages(site);
}

async function getSiteForOwner(siteId, userId) {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("id", siteId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`שגיאה בקריאת האתר: ${error.message}`);
    }

    return data || null;
  }

  const site = memory.sites.get(siteId);
  return site?.user_id === userId ? site : null;
}

async function getPublicSiteBySlug(slug) {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from("sites")
      .select("*, pages(*)")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`שגיאה בקריאת האתר הציבורי: ${error.message}`);
    }

    return data ? sortPages(data) : null;
  }

  const site = [...memory.sites.values()].find((item) => item.public_slug === slug && item.is_public);
  return site ? attachPages(site) : null;
}

async function getSiteWithPages(siteId) {
  const { data, error } = await supabase
    .from("sites")
    .select("*, pages(*)")
    .eq("id", siteId)
    .single();

  if (error) {
    throw new Error(`שגיאה בקריאת האתר: ${error.message}`);
  }

  return sortPages(data);
}

async function insertPages(siteId, pages) {
  const rows = pages.map((page) => ({
    id: crypto.randomUUID(),
    site_id: siteId,
    google_doc_id: page.google_doc_id,
    title: page.title,
    clean_title: page.clean_title,
    page_order: page.page_order,
    html_content: page.html_content,
    updated_at: now()
  }));

  const { error } = await supabase.from("pages").insert(rows);

  if (error) {
    throw new Error(`שגיאה בשמירת עמודים ב-Supabase: ${error.message}`);
  }
}

function savePagesInMemory(siteId, pages) {
  memory.pages.set(siteId, pages.map((page) => ({
    id: crypto.randomUUID(),
    site_id: siteId,
    ...page,
    updated_at: now()
  })));
}

function attachPages(site) {
  return sortPages({
    ...site,
    pages: memory.pages.get(site.id) || []
  });
}

function sortPages(site) {
  return {
    ...site,
    pages: [...(site.pages || [])].sort((a, b) => {
      if (a.page_order !== b.page_order) {
        return a.page_order - b.page_order;
      }

      return a.title.localeCompare(b.title, "he", { numeric: true, sensitivity: "base" });
    })
  };
}

async function uniqueSlug(siteName) {
  const base = slugify(siteName) || "site";
  let slug = base;
  let counter = 2;

  while (await slugExists(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function slugExists(slug) {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from("sites")
      .select("id")
      .eq("public_slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`שגיאה בבדיקת כתובת האתר: ${error.message}`);
    }

    return Boolean(data);
  }

  return [...memory.sites.values()].some((site) => site.public_slug === slug);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function now() {
  return new Date().toISOString();
}

module.exports = {
  upsertUser,
  createSiteWithPages,
  replaceSitePages,
  getSiteForOwner,
  getPublicSiteBySlug
};
