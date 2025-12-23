/**
 * Base path utility for GitHub Pages and custom domain compatibility
 *
 * On GitHub Pages: https://<user>.github.io/<repo>/ → BASE_PATH = "/<repo>"
 * On custom domain: https://example.com/ → BASE_PATH = ""
 */

/**
 * Compute the base path at runtime based on the current hostname
 */
export function getBasePath(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const hostname = window.location.hostname;

  // GitHub Pages detection
  if (hostname.endsWith('.github.io')) {
    // Extract repo name from pathname
    // URL pattern: https://<user>.github.io/<repo>/...
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return `/${pathParts[0]}`;
    }
  }

  // Custom domain or localhost - no base path needed
  return '';
}

/**
 * Build a URL with the correct base path for fetching static assets
 * @param path - The path to the asset (should start with /)
 */
export function getAssetUrl(path: string): string {
  const basePath = getCachedBasePath();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

/**
 * Build a URL for fetching results JSON files
 * @param relativePath - Path relative to results directory
 */
export function getResultsUrl(relativePath: string): string {
  // Results are stored in /benchmarks/results/
  const path = relativePath.startsWith('/')
    ? `/benchmarks/results${relativePath}`
    : `/benchmarks/results/${relativePath}`;
  return getAssetUrl(path);
}

/**
 * Fetch JSON from a path with proper base path handling
 * @param path - Path to fetch (will have base path prepended)
 */
export async function fetchWithBasePath<T>(path: string): Promise<T> {
  const url = getAssetUrl(path);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch results JSON with proper base path handling
 * @param relativePath - Path relative to results directory
 */
export async function fetchResults<T>(relativePath: string): Promise<T> {
  const url = getResultsUrl(relativePath);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch results ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// Export a singleton for the current base path (computed once)
const cachedBasePath = getBasePath();

export function getCachedBasePath(): string {
  return cachedBasePath;
}
