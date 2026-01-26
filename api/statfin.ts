import type { VercelRequest, VercelResponse } from '@vercel/node';

const STATFIN_BASE = 'https://pxdata.stat.fi/PXWeb/api/v1/fi/StatFin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path after /api/statfin/
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathMatch = url.pathname.match(/^\/api\/statfin\/(.*)$/);
  const path = pathMatch ? pathMatch[1] : '';

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const targetUrl = `${STATFIN_BASE}/${path}`;

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
      return res.status(response.status).json({
        error: 'Upstream API error',
        status: response.status,
        message: errorText,
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
    });
  }
}
