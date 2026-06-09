import {
  brandingAppleIconHref,
  brandingFaviconHref,
} from "@/modules/plataforma/branding-constants";

function upsertLink(rel: string, href: string, id: string) {
  let el = document.getElementById(id) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.id = id;
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute("href") !== href) {
    el.setAttribute("href", href);
  }
}

/** Actualiza favicon en pestaña del navegador tras cambiar logo en marca y colores. */
export function syncDocumentFavicon(updatedAt?: string) {
  const iconHref = brandingFaviconHref(updatedAt);
  const appleHref = brandingAppleIconHref(updatedAt);
  upsertLink("icon", iconHref, "branding-favicon");
  upsertLink("shortcut icon", iconHref, "branding-favicon-shortcut");
  upsertLink("apple-touch-icon", appleHref, "branding-apple-icon");
}
