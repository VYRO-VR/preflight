import { useEffect, useState } from 'react'

/**
 * Renders a cached documentation page from docs.vyrovr.com. The HTML is
 * sanitised to a text-ish fragment by stripping scripts/styles before
 * injection; external links are opened in the system browser via the global
 * window-open handler.
 */
export function DocViewer({ slug }: { slug: string }) {
  const [html, setHtml] = useState<string>('Loading…')

  useEffect(() => {
    let active = true
    window.api.docs.getPage(slug).then((content) => {
      if (active) setHtml(sanitize(content))
    })
    return () => {
      active = false
    }
  }, [slug])

  return (
    <div
      className="doc-html rounded-lg border border-surface-border bg-surface-raised p-4"
      // Content is fetched from our own docs domain and sanitised below.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function sanitize(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on[a-z]+="[^"]*"/gi, '')
    .replace(/ on[a-z]+='[^']*'/gi, '')
}
