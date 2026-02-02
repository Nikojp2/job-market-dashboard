import type { VercelRequest, VercelResponse } from '@vercel/node';

const STATFIN_BASE = 'https://pxdata.stat.fi/PXWeb/api/v1/fi/StatFin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Get path from catch-all route parameter
  const pathSegments = req.query.path;
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : (pathSegments || '');

  // Build target URL - handle both table listing (path ending with /) and data queries
  let targetUrl = `${STATFIN_BASE}`;
  if (path) {
    targetUrl += `/${path}`;
  }

  // Preserve trailing slash for directory listings (table listings)
  const originalUrl = req.url || '';
  if (originalUrl.endsWith('/') && !targetUrl.endsWith('/')) {
    targetUrl += '/';
  }

  try {
    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Forward POST body for data queries
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward the response status
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upstream error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Upstream API error',
        status: response.status,
        message: errorText,
        targetUrl,
      });
    }

    const data = await response.json();

    // Set CORS headers for the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Failed to fetch data from Statistics Finland',
      message: error instanceof Error ? error.message : 'Unknown error',
      targetUrl,
    });
  }
}
