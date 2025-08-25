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

  const { q, limit = 20, offset = 0, sources = 'all' } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchPromises = [];
    const searchSources = sources === 'all' ? ['openlibrary', 'google'] : sources.split(',');
    
    // Search Open Library
    if (searchSources.includes('openlibrary')) {
      searchPromises.push(
        fetch(`${req.headers.origin || 'https://localhost:3000'}/api/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`)
          .then(res => res.json())
          .then(data => ({ source: 'openlibrary', data, success: true }))
          .catch(err => ({ source: 'openlibrary', error: err.message, success: false }))
      );
    }

    // Search Google Books
    if (searchSources.includes('google')) {
      searchPromises.push(
        fetch(`${req.headers.origin || 'https://localhost:3000'}/api/google-books?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`)
          .then(res => res.json())
          .then(data => ({ source: 'google', data, success: true }))
          .catch(err => ({ source: 'google', error: err.message, success: false }))
      );
    }

    const results = await Promise.allSettled(searchPromises);
    
    // Combine and deduplicate results
    const allBooks = [];
    let totalFound = 0;
    const sourceInfo = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const { source, data } = result.value;
        sourceInfo[source] = {
          found: data.num_found || data.docs?.length || 0,
          status: 'success'
        };
        totalFound = Math.max(totalFound, data.num_found || 0);
        
        if (data.docs && Array.isArray(data.docs)) {
          data.docs.forEach(book => {
            // Add source info and deduplicate by title + first author
            const bookKey = `${book.title?.toLowerCase()}_${book.author_name?.[0]?.toLowerCase()}`;
            if (!allBooks.some(existing => 
              `${existing.title?.toLowerCase()}_${existing.author_name?.[0]?.toLowerCase()}` === bookKey
            )) {
              allBooks.push({
                ...book,
                search_source: source,
                // Add Amazon search link for any book
                amazon_search: `https://www.amazon.com/s?k=${encodeURIComponent(`${book.title} ${book.author_name?.[0] || ''}`)}&i=stripbooks`,
                // Add Goodreads search link
                goodreads_search: `https://www.goodreads.com/search?q=${encodeURIComponent(`${book.title} ${book.author_name?.[0] || ''}`)}`,
                // Add Audible search link
                audible_search: `https://www.audible.com/search?keywords=${encodeURIComponent(`${book.title} ${book.author_name?.[0] || ''}`)}`
              });
            }
          });
        }
      } else {
        const sourceName = searchSources[index] || 'unknown';
        sourceInfo[sourceName] = {
          found: 0,
          status: 'error',
          error: result.reason?.message || 'Search failed'
        };
      }
    });

    // Sort by relevance (prefer books with ratings, then by source preference)
    allBooks.sort((a, b) => {
      // Prefer Google Books (more complete data) then Open Library
      const sourceWeight = { 'google': 2, 'openlibrary': 1 };
      const weightDiff = (sourceWeight[b.search_source] || 0) - (sourceWeight[a.search_source] || 0);
      if (weightDiff !== 0) return weightDiff;
      
      // Then prefer books with ratings
      const ratingsA = a.ratings_count || a.average_rating || 0;
      const ratingsB = b.ratings_count || b.average_rating || 0;
      return ratingsB - ratingsA;
    });

    res.status(200).json({
      num_found: totalFound,
      start: parseInt(offset) || 0,
      docs: allBooks,
      sources: sourceInfo,
      search_query: q,
      message: allBooks.length === 0 ? 
        "No books found. Try different keywords or check the Gemini AI chat for personalized recommendations!" :
        `Found ${allBooks.length} books from ${Object.keys(sourceInfo).filter(s => sourceInfo[s].status === 'success').join(' + ')}`
    });

  } catch (error) {
    console.error('Multi-search error:', error);
    res.status(500).json({ error: 'Multi-source search failed' });
  }
}