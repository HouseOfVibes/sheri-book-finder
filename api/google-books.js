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
    const searchLimit = Math.min(parseInt(limit), 40); // Google Books allows up to 40
    const startIndex = parseInt(offset) || 0;
    
    // Google Books API key from environment (optional but recommended for higher limits)
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${searchLimit}&startIndex=${startIndex}${keyParam}`
    );
    
    const data = await response.json();
    
    // Transform Google Books format to match Open Library format
    const transformedData = {
      num_found: data.totalItems || 0,
      start: startIndex,
      docs: (data.items || []).map(item => {
        const volumeInfo = item.volumeInfo || {};
        const saleInfo = item.saleInfo || {};
        
        return {
          key: `/works/GB_${item.id}`,
          title: volumeInfo.title || 'Unknown Title',
          author_name: volumeInfo.authors || ['Unknown Author'],
          first_publish_year: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
          publisher: volumeInfo.publisher ? [volumeInfo.publisher] : [],
          language: volumeInfo.language ? [volumeInfo.language] : ['en'],
          isbn: volumeInfo.industryIdentifiers ? 
            volumeInfo.industryIdentifiers.map(id => id.identifier) : [],
          number_of_pages_median: volumeInfo.pageCount || null,
          subject: volumeInfo.categories || [],
          cover_i: volumeInfo.imageLinks?.thumbnail ? 
            volumeInfo.imageLinks.thumbnail.replace('http:', 'https:') : null,
          ratings_count: volumeInfo.ratingsCount || 0,
          average_rating: volumeInfo.averageRating || 0,
          // Google Books specific data
          google_books_id: item.id,
          description: volumeInfo.description || null,
          buy_links: {
            google_play: saleInfo.buyLink || null,
            retail_price: saleInfo.retailPrice ? 
              `$${saleInfo.retailPrice.amount} ${saleInfo.retailPrice.currencyCode}` : null
          },
          preview_link: volumeInfo.previewLink || null,
          info_link: volumeInfo.infoLink || null,
          source: 'google_books'
        };
      })
    };
    
    res.status(200).json(transformedData);
    
  } catch (error) {
    console.error('Google Books API error:', error);
    res.status(500).json({ error: 'Failed to search Google Books' });
  }
}