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
    
    // Request additional fields for better database mapping
    const fields = [
      'key', 'title', 'author_name', 'author_key',
      'first_publish_year', 'edition_count', 'cover_i', 'subject',
      'publisher', 'language', 'isbn', 'number_of_pages_median',
      'ratings_count', 'readinglog_count', 'ebook_access', 
      'has_fulltext', 'ia', 'place', 'time', 'person'
    ].join(',');
    
    // Smart search: if it's likely an author name, search by author
    let searchQuery = q;
    const words = q.trim().split(/\s+/);
    if (words.length <= 3 && words.every(word => word.charAt(0).toUpperCase() === word.charAt(0))) {
      // Likely an author name - search both ways
      searchQuery = `${q} OR author:"${q}"`;
    }
    
    const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=${searchLimit}&offset=${searchOffset}&fields=${fields}`);
    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
}