// יצירת קבצי HTML סטטיים מתוך עמודים שיוצאו מ-Google Docs.

const fs = require("fs/promises");
const path = require("path");
const { getDriveFolder } = require("./googleDriveService");
const { buildPagesFromFolder, extractFolderId } = require("./googleDocsService");

async function exportDriveFolderToStaticHtml(accessToken, driveFolderUrl) {
  const folderId = extractFolderId(driveFolderUrl);

  if (!folderId) {
    throw new Error("קישור תיקיית Google Drive אינו תקין.");
  }

  const folder = await getDriveFolder(accessToken, folderId);
  const pages = await buildPagesFromFolder(accessToken, folderId);
  const outputFolderName = `${sanitizeFileName(folder.name)} HTML`;
  const outputDir = await createUniqueDirectory(path.join(__dirname, "exports", outputFolderName));
  const files = [];
  const pageFiles = pages.map((page, index) => ({
    ...page,
    file_name: `${String(index + 1).padStart(2, "0")}-${slugifyFileName(page.clean_title || page.title)}.html`
  }));

  for (const page of pageFiles) {
    const html = renderPageHtml({
      siteName: folder.name,
      page,
      pages: pageFiles
    });
    const filePath = path.join(outputDir, page.file_name);
    await fs.writeFile(filePath, html, "utf8");
    files.push(filePath);
  }

  const indexHtml = renderPageHtml({
    siteName: folder.name,
    page: pageFiles[0],
    pages: pageFiles
  });
  const indexPath = path.join(outputDir, "index.html");
  await fs.writeFile(indexPath, indexHtml, "utf8");
  files.unshift(indexPath);

  return {
    folderName: folder.name,
    outputDir,
    files: files.map((filePath) => ({
      name: path.basename(filePath),
      path: filePath
    }))
  };
}

async function createUniqueDirectory(baseDir) {
  let candidate = baseDir;
  let counter = 2;

  while (await pathExists(candidate)) {
    candidate = `${baseDir} ${counter}`;
    counter += 1;
  }

  await fs.mkdir(candidate, { recursive: true });
  return candidate;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

function renderPageHtml({ siteName, page, pages }) {
  const menuItems = pages
    .map((item) => `<a class="menu-link${item.file_name === page.file_name ? " active" : ""}" href="${escapeAttribute(item.file_name)}" data-title="${escapeAttribute(item.clean_title)}">${escapeHtml(item.clean_title)}</a>`)
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.clean_title)} · ${escapeHtml(siteName)}</title>
  <style>
    :root {
      --bg: #f6f8fc;
      --surface: #ffffff;
      --text: #172033;
      --muted: #64748b;
      --primary: #2563eb;
      --border: #dbe6f6;
      --soft: #eef6ff;
    }
    * { box-sizing: border-box; }
    html { direction: rtl; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background: var(--bg);
      font-family: Arial, sans-serif;
      text-align: right;
    }
    .site-header {
      padding: 28px max(18px, calc((100vw - 1180px) / 2));
      color: #ffffff;
      background: linear-gradient(135deg, #2563eb, #0f766e);
    }
    .site-header p { margin: 0 0 6px; color: #dbeafe; font-weight: 700; }
    .site-header h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.08; }
    .layout {
      display: grid;
      grid-template-columns: minmax(220px, 290px) minmax(0, 1fr);
      width: min(1180px, calc(100% - 28px));
      margin: 22px auto 44px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 22px 70px rgba(23, 32, 51, 0.12);
    }
    .sidebar {
      padding: 18px;
      background: #fbfdff;
      border-left: 1px solid var(--border);
    }
    .sidebar h2 { margin: 0 0 12px; font-size: 1rem; }
    .search {
      width: 100%;
      min-height: 42px;
      margin-bottom: 12px;
      padding: 9px 11px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
    }
    .menu {
      display: grid;
      gap: 8px;
    }
    .menu-link {
      display: block;
      min-height: 42px;
      padding: 10px 12px;
      color: var(--text);
      border: 1px solid transparent;
      border-radius: 8px;
      text-decoration: none;
    }
    .menu-link:hover,
    .menu-link.active {
      color: #1d4ed8;
      background: var(--soft);
      border-color: #c8d9ff;
    }
    .content {
      min-width: 0;
      padding: 30px;
      line-height: 1.85;
      font-size: 1.06rem;
    }
    .content h1,
    .content h2,
    .content h3 { line-height: 1.25; }
    .content img { max-width: 100%; height: auto; }
    .content table {
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
    }
    .content td,
    .content th {
      padding: 8px;
      border: 1px solid var(--border);
    }
    .footer-note {
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.92rem;
    }
    @media (max-width: 760px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { border-left: 0; border-bottom: 1px solid var(--border); }
      .content { padding: 20px; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <p>נוצר מתוך Google Drive</p>
    <h1>${escapeHtml(siteName)}</h1>
  </header>
  <main class="layout">
    <aside class="sidebar">
      <h2>עמודים</h2>
      <input id="pageSearch" class="search" type="search" placeholder="חיפוש בתפריט">
      <nav id="menu" class="menu" aria-label="תפריט עמודים">
        ${menuItems}
      </nav>
    </aside>
    <article class="content">
      ${page.html_content}
      <p class="footer-note">קובץ HTML סטטי שנוצר על ידי Docs2Site.</p>
    </article>
  </main>
  <script>
    const searchInput = document.getElementById("pageSearch");
    const links = Array.from(document.querySelectorAll(".menu-link"));
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      links.forEach((link) => {
        link.hidden = query && !link.dataset.title.toLowerCase().includes(query);
      });
    });
  </script>
</body>
</html>`;
}

function sanitizeFileName(value) {
  return String(value || "Drive Folder")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "Drive Folder";
}

function slugifyFileName(value) {
  return sanitizeFileName(value)
    .replace(/\s+/g, "-")
    .slice(0, 80) || "page";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

module.exports = {
  exportDriveFolderToStaticHtml
};
