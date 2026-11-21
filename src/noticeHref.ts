// The snapshots store bundled notices as root paths and publisher links as full URLs.
export function noticeHref(url: string): string {
  return url.startsWith('/') ? new URL('.' + url, document.baseURI).href : url
}
