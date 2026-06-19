// בניית עמודי אתר מתוך תיקיית Google Docs.

const { listGoogleDocsInFolder, exportGoogleDocToHtml } = require("./googleDriveService");

async function buildPagesFromFolder(accessToken, folderId) {
  const docs = await listGoogleDocsInFolder(accessToken, folderId);

  if (docs.length === 0) {
    throw new Error("לא נמצאו קבצי Google Docs בתיקייה.");
  }

  const sortedDocs = docs
    .map((doc) => ({
      ...doc,
      pageOrder: getPageOrder(doc.name),
      cleanTitle: cleanDocTitle(doc.name)
    }))
    .sort(compareDocs);

  const pages = [];

  for (const [index, doc] of sortedDocs.entries()) {
    const rawHtml = await exportGoogleDocToHtml(accessToken, doc.id);

    pages.push({
      google_doc_id: doc.id,
      title: doc.name,
      clean_title: doc.cleanTitle,
      page_order: doc.pageOrder ?? index + 1,
      html_content: cleanGoogleHtml(rawHtml)
    });
  }

  return pages;
}

function extractFolderId(folderUrl) {
  const value = String(folderUrl || "").trim();
  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const idMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (folderMatch) {
    return folderMatch[1];
  }

  if (idMatch) {
    return idMatch[1];
  }

  return "";
}

function getPageOrder(fileName) {
  const match = String(fileName).trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function cleanDocTitle(fileName) {
  return String(fileName)
    .trim()
    .replace(/^\d+[\s._-]*/, "")
    .trim();
}

function compareDocs(a, b) {
  if (a.pageOrder !== null && b.pageOrder !== null && a.pageOrder !== b.pageOrder) {
    return a.pageOrder - b.pageOrder;
  }

  if (a.pageOrder !== null && b.pageOrder === null) {
    return -1;
  }

  if (a.pageOrder === null && b.pageOrder !== null) {
    return 1;
  }

  return a.name.localeCompare(b.name, "he", { numeric: true, sensitivity: "base" });
}

function cleanGoogleHtml(rawHtml) {
  const withoutScripts = String(rawHtml || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const bodyMatch = withoutScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : withoutScripts;
  const responsiveBody = body
    .replace(/<img\b/gi, '<img loading="lazy"')
    .replace(/width="[^"]*"/gi, "")
    .replace(/height="[^"]*"/gi, "");

  return `<div class="google-doc-html" dir="rtl">${responsiveBody}</div>`;
}

module.exports = {
  buildPagesFromFolder,
  extractFolderId,
  getPageOrder,
  cleanDocTitle,
  cleanGoogleHtml
};
