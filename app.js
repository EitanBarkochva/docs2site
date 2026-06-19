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
  loginMessage: document.getElementById("loginMessage"),
  logoutButton: document.getElementById("logoutButton"),
  siteForm: document.getElementById("siteForm"),
  siteName: document.getElementById("siteName"),
  folderUrl: document.getElementById("folderUrl"),
  primaryColor: document.getElementById("primaryColor"),
  logoUrl: document.getElementById("logoUrl"),
  isPublic: document.getElementById("isPublic"),
  refreshButton: document.getElementById("refreshButton"),
  viewSiteButton: document.getElementById("viewSiteButton"),
  statusText: document.getElementById("statusText"),
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
  el.logoutButton.addEventListener("click", logout);
  el.siteForm.addEventListener("submit", createSite);
  el.refreshButton.addEventListener("click", refreshSite);
  el.siteSearch.addEventListener("input", filterPublicPages);
}

async function loadConfig() {
  try {
    const config = await apiGet("/api/config");
    googleClientId = config.googleClientId || "";

    if (googleClientId) {
      el.loginMessage.textContent = "אפשר להתחבר עם חשבון Google שיש לו גישה לתיקייה.";
      return;
    }

    el.loginMessage.textContent = "חסר GOOGLE_CLIENT_ID בקובץ .env של השרת.";
  } catch (error) {
    showError("לא ניתן לטעון את הגדרות האפליקציה מהשרת.");
  }
}

function loginWithGoogle() {
  hideError();

  if (!googleClientId) {
    showError("חסר Google Client ID. הגדירו GOOGLE_CLIENT_ID והפעילו את השרת מחדש.");
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
}

async function createSite(event) {
  event.preventDefault();
  hideError();

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

async function refreshSite() {
  if (!currentSite) {
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
