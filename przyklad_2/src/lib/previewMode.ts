// Set by the portfolio card that embeds this page as a live preview
// (`?preview=1`). In that context the frame is never scrolled, so the campaign
// runs its opening beat only and hands control back to the card.
export const previewMode =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");
