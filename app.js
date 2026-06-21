// Docs2Site - לוגיקת צד לקוח למסכי התחברות, ניהול ותצוגת אתר ציבורי.

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "email",
  "profile"
].join(" ");

let googleClientId = "";
let tokenClient = null;
let accessToken = "";
let currentSite = null;
let selectedPageId = "";

const el = {
  loginScreen: document.getElementById("loginScreen"),
  adminScreen: document.getElementById("adminScreen"),
  publicScreen: document.getElementById("publicScreen"),
  loginButton: document.getElementById("loginButton"),
  demoButton: document.getElementById("demoButton"),
  loginMessage: document.getElementById("loginMessage"),
  setupHint: document.getElementById("setupHint"),
  logoutButton: document.getElementById("logoutButton"),
  siteForm: document.getElementById("siteForm"),
  siteName: document.getElementById("siteName"),
  folderUrl: document.getElementById("folderUrl"),
  primaryColor: document.getElementById("primaryColor"),
  logoUrl: document.getElementById("logoUrl"),
  isPublic: document.getElementById("isPublic"),
  createButton: document.getElementById("createButton"),
  exportHtmlButton: document.getElementById("exportHtmlButton"),
  refreshButton: document.getElementById("refreshButton"),
  viewSiteButton: document.getElementById("viewSiteButton"),
  statusText: document.getElementById("statusText"),
  exportResult: document.getElementById("exportResult"),
  errorBox: document.getElementById("errorBox"),
  previewPanel: document.getElementById("previewPanel"),
  previewTitle: document.getElementById("previewTitle"),
  previewMeta: document.getElementById("previewMeta"),
  pagesMenu: document.getElementById("pagesMenu"),
  pageContent: document.getElementById("pageContent"),
  publicSiteName: document.getElementById("publicSiteName"),
  publicLogo: document.getElementById("publicLogo"),
  siteSearch: document.getElementById("siteSearch"),
  publicPagesMenu: document.getElementById("publicPagesMenu"),
  publicPageContent: document.getElementById("publicPageContent")
};

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  bindEvents();

  if (isPublicSiteRoute()) {
    await loadPublicSite();
    return;
  }

  showScreen("login");
  setStatus("ממתין להתחברות");
  await loadConfig();
}

function bindEvents() {
  el.loginButton.addEventListener("click", loginWithGoogle);
  el.demoButton.addEventListener("click", enterDemoMode);
  el.logoutButton.addEventListener("click", logout);
  el.siteForm.addEventListener("submit", createSite);
  el.exportHtmlButton.addEventListener("click", exportHtmlFiles);
  el.refreshButton.addEventListener("click", refreshSite);
  el.siteSearch.addEventListener("input", filterPublicPages);
}

async function loadConfig() {
  if (isStaticHosting()) {
    googleClientId = window.DOCS2SITE_GOOGLE_CLIENT_ID || "";
    el.loginMessage.textContent = googleClientId
      ? "אפשר להתחבר עם Google ולייצא תיקיית Drive לקובצי HTML."
      : "חסר Google Client ID בהגדרות האתר הציבורי.";
    el.setupHint.hidden = Boolean(googleClientId);
    el.createButton.hidden = true;
    el.refreshButton.hidden = true;
    el.viewSiteButton.hidden = true;
    return;
  }
  if (location.protocol === "file:") {
    el.loginMessage.textContent = "פתחת את הקובץ ישירות. להתחברות אמיתית צריך להריץ npm start ולפתוח http://localhost:3000.";
    el.setupHint.hidden = false;
    return;
  }

  try {
    const config = await apiGet("/api/config");
    googleClientId = config.googleClientId || "";

    if (googleClientId) {
      el.loginMessage.textContent = "אפשר להתחבר עם חשבון Google שיש לו גישה לתיקייה.";
      el.setupHint.hidden = true;
      return;
    }

    el.loginMessage.textContent = "חסר GOOGLE_CLIENT_ID בקובץ .env של השרת.";
    el.setupHint.hidden = false;
  } catch (error) {
    el.setupHint.hidden = false;
    showError("לא ניתן לטעון את הגדרות האפליקציה מהשרת. ודאו שהרצתם npm start.");
  }
}

function loginWithGoogle() {
  hideError();

  if (!googleClientId) {
    el.setupHint.hidden = false;
    showError("חסר Google Client ID. הגדירו GOOGLE_CLIENT_ID בקובץ .env והפעילו את השרת מחדש.");
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    showError("Google Identity Services עדיין לא נטען. נסו שוב בעוד רגע.");
    return;
  }

  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_SCOPES,
      callback: handleGoogleToken
    });
  }

  tokenClient.requestAccessToken({ prompt: "consent" });
}

function enterDemoMode() {
  hideError();
  currentSite = createDemoSite();
  selectedPageId = currentSite.pages[0].id;
  showScreen("admin");
  setStatus("מצב דמו פעיל. להתחברות אמיתית הגדירו GOOGLE_CLIENT_ID.");
  renderAdminSite(currentSite);
}

function handleGoogleToken(response) {
  if (response.error || !response.access_token) {
    showError("ההתחברות נכשלה. נסו שוב.");
    return;
  }

  accessToken = response.access_token;
  showScreen("admin");
  setStatus("התחברת בהצלחה");
}

function logout() {
  if (accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(accessToken);
  }

  accessToken = "";
  currentSite = null;
  selectedPageId = "";
  el.siteForm.reset();
  el.primaryColor.value = "#2563eb";
  renderAdminSite(null);
  showScreen("login");
  setStatus("ממתין להתחברות");
}

async function createSite(event) {
  event.preventDefault();
  hideError();

  if (!accessToken) {
    showError("כדי ליצור אתר מתיקיית Drive צריך להתחבר עם Google. מצב דמו מציג רק נתונים לדוגמה.");
    return;
  }

  try {
    setBusy(true, "יוצר אתר מהתיקייה");
    const payload = readSiteForm();
    currentSite = await apiPost("/api/sites", payload, true);
    selectedPageId = currentSite.pages[0]?.id || "";
    renderAdminSite(currentSite);
    setStatus("האתר נוצר בהצלחה");
  } catch (error) {
    showError(error.message);
    setStatus("יצירת האתר נכשלה");
  } finally {
    setBusy(false);
  }
}

async function exportHtmlFiles() {
  hideError();
  el.exportResult.hidden = true;
  el.exportResult.innerHTML = "";

  if (!accessToken) {
    showError("כדי ליצור קבצי HTML מתיקיית Drive צריך להתחבר עם Google.");
    return;
  }

  const driveFolderUrl = el.folderUrl.value.trim();

  if (!driveFolderUrl) {
    showError("צריך להדביק קישור לתיקיית Google Drive.");
    return;
  }

  try {
    setBusy(true, "יוצר קבצי HTML מתוך תיקיית Drive");
    const result = isStaticHosting()
      ? await window.exportDriveFolderAsZip(accessToken, driveFolderUrl)
      : await apiPost("/api/export-html", { driveFolderUrl }, true);
    renderExportResult(result);
    setStatus("קבצי HTML נוצרו בהצלחה");
  } catch (error) {
    showError(error.message);
    setStatus("יצירת קבצי HTML נכשלה");
  } finally {
    setBusy(false);
  }
}

async function refreshSite() {
  if (!currentSite) {
    return;
  }

  if (!accessToken) {
    showError("רענון מדרייב דורש התחברות Google אמיתית.");
    return;
  }

  hideError();

  try {
    setBusy(true, "מרענן תוכן מהדרייב");
    currentSite = await apiPost(`/api/sites/${currentSite.id}/refresh`, {}, true);
    selectedPageId = currentSite.pages[0]?.id || "";
    renderAdminSite(currentSite);
    setStatus("התוכן עודכן בהצלחה");
  } catch (error) {
    showError(error.message);
    setStatus("רענון התוכן נכשל");
  } finally {
    setBusy(false);
  }
}

function readSiteForm() {
  return {
    siteName: el.siteName.value.trim(),
    driveFolderUrl: el.folderUrl.value.trim(),
    primaryColor: el.primaryColor.value,
    logoUrl: el.logoUrl.value.trim(),
    isPublic: el.isPublic.checked
  };
}

function renderAdminSite(site) {
  const hasSite = Boolean(site);
  el.previewPanel.hidden = !hasSite;
  el.refreshButton.disabled = !hasSite;
  el.viewSiteButton.setAttribute("aria-disabled", hasSite ? "false" : "true");
  el.viewSiteButton.href = hasSite ? `/site/${site.public_slug}` : "#";

  if (!site) {
    el.pagesMenu.innerHTML = "";
    el.pageContent.innerHTML = "";
    return;
  }

  el.siteName.value = site.site_name;
  el.folderUrl.value = site.drive_folder_url;
  el.primaryColor.value = site.primary_color || "#2563eb";
  el.logoUrl.value = site.logo_url || "";
  el.isPublic.checked = site.is_public !== false;
  el.previewTitle.textContent = site.site_name;
  el.previewMeta.textContent = `${site.pages.length} עמודים · עודכן ${formatDate(site.updated_at)}`;
  renderPages(site.pages, el.pagesMenu, showAdminPage);
  showAdminPage(selectedPageId || site.pages[0]?.id);
}

function renderExportResult(result) {
  const fileList = result.files
    .map((file) => `<li><code>${escapeHtml(file.name)}</code></li>`)
    .join("");

  el.exportResult.innerHTML = `
    <strong>נוצרה תיקיית HTML:</strong>
    <p><code>${escapeHtml(result.outputDir)}</code></p>
    <p>${result.files.length} קבצים נוצרו מתוך התיקייה "${escapeHtml(result.folderName)}".</p>
    <ul>${fileList}</ul>
  `;
  el.exportResult.hidden = false;
}

function showAdminPage(pageId) {
  const page = currentSite?.pages.find((item) => item.id === pageId);

  if (!page) {
    el.pageContent.innerHTML = "<p>לא נבחר דף להצגה.</p>";
    return;
  }

  selectedPageId = page.id;
  el.pageContent.innerHTML = page.html_content;
  markActive(el.pagesMenu, page.id);
}

async function loadPublicSite() {
  showScreen("public");

  try {
    const slug = location.pathname.split("/").filter(Boolean).pop();
    currentSite = await apiGet(`/api/public/sites/${encodeURIComponent(slug)}`);
    selectedPageId = currentSite.pages[0]?.id || "";
    renderPublicSite(currentSite);
  } catch (error) {
    el.publicSiteName.textContent = "האתר לא נמצא";
    el.publicPageContent.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function renderPublicSite(site) {
  document.documentElement.style.setProperty("--primary", site.primary_color || "#2563eb");
  document.title = `${site.site_name} · Docs2Site`;
  el.publicSiteName.textContent = site.site_name;

  if (site.logo_url) {
    el.publicLogo.src = site.logo_url;
    el.publicLogo.hidden = false;
  }

  renderPages(site.pages, el.publicPagesMenu, showPublicPage);
  showPublicPage(selectedPageId || site.pages[0]?.id);
}

function showPublicPage(pageId) {
  const page = currentSite?.pages.find((item) => item.id === pageId);

  if (!page) {
    el.publicPageContent.innerHTML = "<p>לא נמצא תוכן להצגה.</p>";
    return;
  }

  selectedPageId = page.id;
  el.publicPageContent.innerHTML = page.html_content;
  markActive(el.publicPagesMenu, page.id);
}

function renderPages(pages, target, onClick) {
  target.innerHTML = "";

  pages.forEach((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-tab";
    button.dataset.pageId = page.id;
    button.dataset.searchText = `${page.clean_title} ${stripHtml(page.html_content)}`.toLowerCase();
    button.textContent = page.clean_title;
    button.addEventListener("click", () => onClick(page.id));
    target.appendChild(button);
  });
}

function filterPublicPages() {
  const query = el.siteSearch.value.trim().toLowerCase();
  el.publicPagesMenu.querySelectorAll(".page-tab").forEach((button) => {
    button.hidden = query.length > 0 && !button.dataset.searchText.includes(query);
  });
}

function markActive(container, pageId) {
  container.querySelectorAll(".page-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageId === pageId);
  });
}

function showScreen(screenName) {
  el.loginScreen.hidden = screenName !== "login";
  el.adminScreen.hidden = screenName !== "admin";
  el.publicScreen.hidden = screenName !== "public";
}

function createDemoSite() {
  const updatedAt = new Date().toISOString();

  return {
    id: "demo-site",
    site_name: "אתר לימודי לדוגמה",
    drive_folder_url: "https://drive.google.com/drive/folders/demo",
    public_slug: "demo-site",
    primary_color: "#2563eb",
    logo_url: "",
    is_public: true,
    updated_at: updatedAt,
    pages: [
      {
        id: "demo-1",
        clean_title: "פתיחה",
        title: "01 פתיחה",
        page_order: 1,
        html_content: "<h1>ברוכים הבאים</h1><p>כך ייראה עמוד שנוצר מתוך Google Docs. התפריט נבנה אוטומטית לפי שמות המסמכים בתיקייה.</p>"
      },
      {
        id: "demo-2",
        clean_title: "שיעור ראשון",
        title: "02 שיעור ראשון",
        page_order: 2,
        html_content: "<h1>שיעור ראשון</h1><p>אפשר לשלב כותרות, פסקאות, קישורים, טבלאות ותמונות מתוך המסמך המקורי.</p>"
      },
      {
        id: "demo-3",
        clean_title: "סיכום",
        title: "03 סיכום",
        page_order: 3,
        html_content: "<h1>סיכום</h1><p>כאשר תחברו Google OAuth, הדפים האלה יוחלפו בתוכן אמיתי מתוך תיקיית Drive.</p>"
      }
    ]
  };
}

function isStaticHosting() {
  return location.hostname.endsWith("github.io");
}

function isPublicSiteRoute() {
  return location.pathname.startsWith("/site/");
}

async function apiGet(path) {
  const response = await fetch(path);
  return readApiResponse(response);
}

async function apiPost(path, body, withAuth = false) {
  const headers = { "Content-Type": "application/json" };

  if (withAuth) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  return readApiResponse(response);
}

async function readApiResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "אירעה שגיאה לא צפויה");
  }

  return data;
}

function setBusy(isBusy, message = "") {
  el.createButton.disabled = isBusy;
  el.exportHtmlButton.disabled = isBusy;
  el.refreshButton.disabled = isBusy || !currentSite;

  if (message) {
    setStatus(message);
  }
}

function setStatus(message) {
  el.statusText.textContent = message;
}

function showError(message) {
  el.errorBox.textContent = message;
  el.errorBox.hidden = false;
}

function hideError() {
  el.errorBox.textContent = "";
  el.errorBox.hidden = true;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function stripHtml(html) {
  const node = document.createElement("div");
  node.innerHTML = html || "";
  return node.textContent || "";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
