/**
 * Nested browsing context for a parked / repo site.
 * A real iframe document keeps client chrome CSS and html.light/dark off the site.
 */
export function SiteFrame ({
  src,
  title = 'Relay site',
}: {
  src: string
  title?: string
}) {
  return (
    <iframe
      data-testid="relay-site-frame"
      title={title}
      src={src}
      className="w-full h-full min-h-0 flex-1 border-0 bg-transparent"
      referrerPolicy="origin-when-cross-origin"
    />
  )
}
