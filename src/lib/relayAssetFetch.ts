/**
 * Fetch Relay-hosted assets with IPFS long-poll and retry policy.
 */

export type RelayAssetErrorCode =
  | 'repo-not-found'
  | 'invalid-cid'
  | 'ipfs-not-found'
  | 'ipfs-gateway-timeout'
  | 'ipfs-gateway-error'
  | 'ipfs-pending'
  | 'ipfs-busy'
  | 'internal'

export interface RelayAssetFetchOptions {
  waitSeconds?: number
  maxRetries?: number
  signal?: AbortSignal
}

export interface RelayAssetResult {
  blobUrl: string
  contentType: string
  revoke: () => void
}

const RETRYABLE: Set<RelayAssetErrorCode> = new Set([
  'ipfs-pending',
  'ipfs-gateway-timeout',
  'ipfs-gateway-error',
  'ipfs-busy',
  'internal',
])

function parseErrorCode(res: Response, body: unknown): RelayAssetErrorCode {
  const h = res.headers.get('X-Relay-Asset-Error')
  if (h) return h as RelayAssetErrorCode
  if (body && typeof body === 'object' && 'error' in body) {
    return String((body as { error: string }).error) as RelayAssetErrorCode
  }
  if (res.status === 425) return 'ipfs-pending'
  if (res.status === 410) return 'ipfs-not-found'
  if (res.status === 504) return 'ipfs-gateway-timeout'
  if (res.status === 502) return 'ipfs-gateway-error'
  return 'internal'
}

function isRetryable(code: RelayAssetErrorCode, body: unknown): boolean {
  if (RETRYABLE.has(code)) return true
  if (body && typeof body === 'object' && 'retryable' in body) {
    return Boolean((body as { retryable: boolean }).retryable)
  }
  return false
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}

function backoffMs(attempt: number): number {
  const steps = [2000, 5000, 15000, 45000]
  return steps[Math.min(attempt, steps.length - 1)] ?? 45000
}

export async function relayAssetFetch(
  url: string,
  opts: RelayAssetFetchOptions = {},
): Promise<RelayAssetResult> {
  const waitSeconds = opts.waitSeconds ?? 0
  const maxRetries = opts.maxRetries ?? 4
  const signal = opts.signal

  let attempt = 0
  while (true) {
    const u = new URL(url, window.location.origin)
    if (waitSeconds > 0 && !u.searchParams.has('wait')) {
      u.searchParams.set('wait', String(waitSeconds))
    }

    const res = await fetch(u.toString(), { cache: 'no-store', signal })
    if (res.ok) {
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      return {
        blobUrl,
        contentType: res.headers.get('Content-Type') ?? blob.type,
        revoke: () => URL.revokeObjectURL(blobUrl),
      }
    }

    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* plain */
    }
    const code = parseErrorCode(res, body)

    if (code === 'ipfs-pending' && waitSeconds > 0) {
      const ra = res.headers.get('Retry-After')
      await sleep((ra ? parseInt(ra, 10) : 5) * 1000, signal)
      continue
    }

    if (isRetryable(code, body) && attempt < maxRetries) {
      if (code === 'ipfs-busy') {
        const ra = res.headers.get('Retry-After')
        await sleep((ra ? parseInt(ra, 10) : 5) * 1000, signal)
      } else {
        await sleep(backoffMs(attempt), signal)
      }
      attempt += 1
      continue
    }

    throw new Error(`relay asset fetch failed: ${code} (${res.status}) ${url}`)
  }
}

/** Apply blob URL to an <img> with placeholder fallback on failure. */
export async function relayAssetLoadImg(
  img: HTMLImageElement,
  url: string,
  placeholderUrl = '/assets/missing-image.svg',
  opts?: RelayAssetFetchOptions,
): Promise<void> {
  try {
    const { blobUrl, revoke } = await relayAssetFetch(url, { waitSeconds: 60, ...opts })
    img.addEventListener(
      'load',
      () => revoke(),
      { once: true },
    )
    img.src = blobUrl
  } catch {
    img.src = placeholderUrl
  }
}
