export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, limit = 20, offset = 0 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchLimit = Math.min(parseInt(limit), 100); // Max 100 per request
    const searchOffset = parseInt(offset) || 0;
    
    const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${searchLimit}&offset=${searchOffset}`);
    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
}