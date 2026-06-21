(function () {
  var DOC_MIME = "application/vnd.google-apps.document";

  window.exportDriveFolderAsZip = async function (token, folderUrl) {
    if (!window.JSZip) throw new Error("ספריית ZIP לא נטענה. רעננו את הדף.");
    var folderId = getFolderId(folderUrl);
    if (!folderId) throw new Error("קישור תיקיית Google Drive אינו תקין.");

    var folder = await googleJson("https://www.googleapis.com/drive/v3/files/" + folderId + "?fields=id,name", token);
    var query = "'" + folderId + "' in parents and mimeType='" + DOC_MIME + "' and trashed=false";
    var params = new URLSearchParams({ q: query, fields: "files(id,name)", orderBy: "name", pageSize: "1000" });
    var list = await googleJson("https://www.googleapis.com/drive/v3/files?" + params, token);
    var docs = (list.files || []).sort(function (a, b) {
      return a.name.localeCompare(b.name, "he", { numeric: true });
    });
    if (!docs.length) throw new Error("לא נמצאו קבצי Google Docs בתיקייה.");

    var pages = [];
    for (var i = 0; i < docs.length; i += 1) {
      var doc = docs[i];
      var response = await fetch("https://www.googleapis.com/drive/v3/files/" + doc.id + "/export?mimeType=text/html", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) throw new Error("לא ניתן לייצא את המסמך: " + doc.name);
      var title = doc.name.replace(/^\d+[\s._-]*/, "").trim() || doc.name;
      pages.push({
        title: title,
        fileName: String(i + 1).padStart(2, "0") + "-" + safeName(title) + ".html",
        content: cleanHtml(await response.text())
      });
    }

    var zip = new JSZip();
    var zipName = safeName(folder.name) + " HTML";
    var root = zip.folder(zipName);
    pages.forEach(function (page) {
      root.file(page.fileName, renderPage(folder.name, page, pages));
    });
    root.file("index.html", renderPage(folder.name, pages[0], pages));

    var blob = await zip.generateAsync({ type: "blob" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = zipName + ".zip";
    document.body.appendChild(link);
    link.click();
    link.remove();

    return {
      folderName: folder.name,
      outputDir: "תיקיית ההורדות בדפדפן",
      files: [{ name: zipName + ".zip" }]
    };
  };

  async function googleJson(url, token) {
    var response = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    var data = await response.json();
    if (!response.ok) throw new Error((data.error && data.error.message) || "Google Drive החזיר שגיאה.");
    return data;
  }

  function getFolderId(url) {
    var folderMatch = String(url || "").match(/\/folders\/([a-zA-Z0-9_-]+)/);
    var idMatch = String(url || "").match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return folderMatch ? folderMatch[1] : (idMatch ? idMatch[1] : "");
  }

  function cleanHtml(raw) {
    var doc = new DOMParser().parseFromString(raw, "text/html");
    doc.querySelectorAll("script,style").forEach(function (node) { node.remove(); });
    doc.querySelectorAll("img").forEach(function (img) {
      img.removeAttribute("width");
      img.removeAttribute("height");
      img.loading = "lazy";
    });
    return doc.body.innerHTML;
  }

  function renderPage(siteName, page, pages) {
    var links = pages.map(function (item) {
      var active = item.fileName === page.fileName ? " active" : "";
      return '<a class="nav-link' + active + '" href="' + escapeHtml(item.fileName) + '" data-title="' + escapeHtml(item.title) + '">' + escapeHtml(item.title) + "</a>";
    }).join("");

    var css = "*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#172033;font-family:Arial,sans-serif;text-align:right}.header{padding:28px max(18px,calc((100vw - 1100px)/2));color:#fff;background:linear-gradient(135deg,#2563eb,#0f766e)}.header h1{margin:0;font-size:clamp(2rem,5vw,3.2rem)}.layout{display:grid;grid-template-columns:260px minmax(0,1fr);width:min(1100px,calc(100% - 28px));margin:22px auto;background:#fff;border:1px solid #dbe6f6;border-radius:8px;overflow:hidden;box-shadow:0 18px 55px #1720331f}.side{padding:18px;background:#fbfdff;border-left:1px solid #dbe6f6}.search{width:100%;padding:10px;border:1px solid #dbe6f6;border-radius:8px;margin-bottom:12px}.nav{display:grid;gap:7px}.nav-link{padding:10px 12px;color:#172033;text-decoration:none;border-radius:8px}.nav-link:hover,.nav-link.active{color:#1d4ed8;background:#eef6ff}.content{min-width:0;padding:30px;line-height:1.8}.content img{max-width:100%;height:auto}@media(max-width:720px){.layout{grid-template-columns:1fr}.side{border-left:0;border-bottom:1px solid #dbe6f6}.content{padding:20px}}";
    var js = "const s=document.getElementById('search'),l=[...document.querySelectorAll('.nav-link')];s.addEventListener('input',()=>{const q=s.value.trim().toLowerCase();l.forEach(a=>a.hidden=q&&!a.dataset.title.toLowerCase().includes(q))});";

    return '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(page.title) + " · " + escapeHtml(siteName) + "</title><style>" + css + '</style></head><body><header class="header"><h1>' + escapeHtml(siteName) + '</h1></header><main class="layout"><aside class="side"><input id="search" class="search" type="search" placeholder="חיפוש בתפריט"><nav class="nav">' + links + '</nav></aside><article class="content">' + page.content + "</article></main><script>" + js + "</script></body></html>";
  }

  function safeName(value) {
    return String(value || "Drive Folder").replace(/[<>:"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "page";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
    });
  }
})();
