// Saves text built on the server (CSV or HTML) as a file in the browser's
// Downloads folder, without another request. Browser only.
export function saveFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked a moment later, so the browser has started reading the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
