// Escapes free-text (scraped listing descriptions are untrusted - Section 16) and turns
// any bare URL within it into a real clickable link, so a scraper-appended
// "Original posting: <url>" line renders as an actual link, not inert text.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(text) {
  const escaped = escapeHtml(text || "");
  return escaped
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br>");
}

module.exports = { linkify, escapeHtml };
