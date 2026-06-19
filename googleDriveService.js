// פעולות בסיס מול Google Drive ופרטי המשתמש המחובר.

const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

async function getGoogleUser(accessToken) {
  const response = await googleFetch("https://www.googleapis.com/oauth2/v3/userinfo", accessToken);
  const data = await response.json();

  if (!response.ok) {
    throw googleError(data, "לא ניתן לקרוא את פרטי המשתמש מ-Google.");
  }

  return {
    google_id: data.sub,
    name: data.name || data.email || "משתמש Google",
    email: data.email || ""
  };
}

async function listGoogleDocsInFolder(accessToken, folderId) {
  const query = `'${folderId}' in parents and mimeType='${GOOGLE_DOC_MIME_TYPE}' and trashed=false`;
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType,modifiedTime)",
    orderBy: "name",
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
  });

  const response = await googleFetch(`https://www.googleapis.com/drive/v3/files?${params}`, accessToken);
  const data = await response.json();

  if (!response.ok) {
    throw googleError(data, "לא ניתן לקרוא את תיקיית Google Drive.");
  }

  return data.files || [];
}

async function exportGoogleDocToHtml(accessToken, documentId) {
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=text/html`;
  const response = await googleFetch(exportUrl, accessToken);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`לא ניתן לייצא מסמך Google Docs ל-HTML. ${text}`);
  }

  return response.text();
}

function googleFetch(url, accessToken) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

function googleError(data, fallback) {
  const status = data?.error?.status;
  const message = data?.error?.message || fallback;
  const error = new Error(message);

  if (status === "PERMISSION_DENIED" || status === "FORBIDDEN") {
    error.message = "אין הרשאה לקרוא את התיקייה או המסמכים האלה.";
    error.statusCode = 403;
  }

  if (status === "NOT_FOUND") {
    error.message = "התיקייה לא נמצאה או שהקישור אינו תקין.";
    error.statusCode = 404;
  }

  return error;
}

module.exports = {
  GOOGLE_DOC_MIME_TYPE,
  getGoogleUser,
  listGoogleDocsInFolder,
  exportGoogleDocToHtml
};
