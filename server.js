// Docs2Site - שרת Express פשוט עבור Google Drive, Google Docs ו-Supabase.

require("dotenv").config();

const express = require("express");
const path = require("path");
const { getGoogleUser } = require("./googleDriveService");
const { buildPagesFromFolder, extractFolderId } = require("./googleDocsService");
const {
  upsertUser,
  createSiteWithPages,
  replaceSitePages,
  getSiteForOwner,
  getPublicSiteBySlug
} = require("./supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

app.get("/api/config", (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ""
  });
});

app.post("/api/sites", requireGoogleToken, async (req, res) => {
  try {
    const input = validateSiteInput(req.body);
    const user = await ensureUser(req.googleAccessToken);
    const folderId = extractFolderId(input.driveFolderUrl);
    const pages = await buildPagesFromFolder(req.googleAccessToken, folderId);

    const site = await createSiteWithPages({
      user,
      siteName: input.siteName,
      driveFolderUrl: input.driveFolderUrl,
      driveFolderId: folderId,
      primaryColor: input.primaryColor,
      logoUrl: input.logoUrl,
      isPublic: input.isPublic,
      pages
    });

    res.status(201).json(site);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/sites/:siteId/refresh", requireGoogleToken, async (req, res) => {
  try {
    const user = await ensureUser(req.googleAccessToken);
    const existingSite = await getSiteForOwner(req.params.siteId, user.id);

    if (!existingSite) {
      return res.status(404).json({ error: "האתר לא נמצא עבור המשתמש הנוכחי." });
    }

    const pages = await buildPagesFromFolder(req.googleAccessToken, existingSite.drive_folder_id);
    const site = await replaceSitePages(existingSite.id, pages);
    res.json(site);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/public/sites/:slug", async (req, res) => {
  try {
    const site = await getPublicSiteBySlug(req.params.slug);

    if (!site) {
      return res.status(404).json({ error: "האתר לא נמצא או שהוא פרטי." });
    }

    res.json(site);
  } catch (error) {
    sendError(res, error);
  }
});

// נתיב האתר הציבורי נטען על ידי אותו frontend, והמידע מגיע מ-API.
app.get("/site/:slug", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Docs2Site is running at http://localhost:${PORT}`);
});

function requireGoogleToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "צריך להתחבר עם Google לפני הפעולה." });
  }

  req.googleAccessToken = token;
  next();
}

async function ensureUser(accessToken) {
  const googleUser = await getGoogleUser(accessToken);
  return upsertUser(googleUser);
}

function validateSiteInput(body) {
  const siteName = String(body.siteName || "").trim();
  const driveFolderUrl = String(body.driveFolderUrl || "").trim();
  const primaryColor = String(body.primaryColor || "#2563eb").trim();
  const logoUrl = String(body.logoUrl || "").trim();
  const isPublic = body.isPublic !== false;

  if (!siteName) {
    throw new Error("צריך להזין שם אתר.");
  }

  if (!driveFolderUrl || !extractFolderId(driveFolderUrl)) {
    throw new Error("קישור תיקיית Google Drive אינו תקין.");
  }

  return { siteName, driveFolderUrl, primaryColor, logoUrl, isPublic };
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  console.error(error);
  res.status(statusCode).json({
    error: error.message || "אירעה שגיאה לא צפויה."
  });
}
