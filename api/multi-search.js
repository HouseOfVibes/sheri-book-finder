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
    
    // Search Open Library directly
    if (searchSources.includes('openlibrary')) {
      searchPromises.push(
        (async () => {
          try {
            const fields = [
              'key', 'title', 'author_name', 'author_key',
              'first_publish_year', 'edition_count', 'cover_i', 'subject',
              'publisher', 'language', 'isbn', 'number_of_pages_median',
              'ratings_count', 'readinglog_count', 'ebook_access', 
              'has_fulltext', 'ia', 'place', 'time', 'person'
            ].join(',');
            
            // Smart search: if it's likely an author name, search both ways
            let searchQuery = q;
            const words = q.trim().split(/\s+/);
            if (words.length <= 3 && words.every(word => word.charAt(0).toUpperCase() === word.charAt(0))) {
              // Likely an author name - search both ways
              searchQuery = `${q} OR author:"${q}"`;
            }
            
            const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=${limit}&offset=${offset}&fields=${fields}`);

            if (!response.ok) {
              throw new Error(`Open Library API returned ${response.status}`);
            }

            const data = await response.json();
            return { source: 'openlibrary', data, success: true };
          } catch (err) {
            return { source: 'openlibrary', error: err.message, success: false };
          }
        })()
      );
    }

    // Search Google Books directly
    if (searchSources.includes('google')) {
      searchPromises.push(
        (async () => {
          try {
            const searchLimit = Math.min(parseInt(limit), 40);
            const startIndex = parseInt(offset) || 0;
            
            const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
            const keyParam = apiKey ? `&key=${apiKey}` : '';
            
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${searchLimit}&startIndex=${startIndex}${keyParam}`);

            if (!response.ok) {
              throw new Error(`Google Books API returned ${response.status}`);
            }

            const googleData = await response.json();
            
            // Transform Google Books format to match Open Library format
            const transformedData = {
              num_found: googleData.totalItems || 0,
              start: startIndex,
              docs: (googleData.items || []).map(item => {
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
            
            return { source: 'google', data: transformedData, success: true };
          } catch (err) {
            return { source: 'google', error: err.message, success: false };
          }
        })()
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

    // Add external search suggestions when no results found
    const externalSuggestions = allBooks.length === 0 ? {
      amazon_author_search: `https://www.amazon.com/s?i=digital-text&rh=p_27%3A${encodeURIComponent(q)}&ref=dp_byline_sr_ebooks_1`,
      goodreads_author_search: `https://www.goodreads.com/search?q=${encodeURIComponent(q)}&search_type=author`,
      amazon_books_search: `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=stripbooks&ref=nb_sb_noss`
    } : null;

    res.status(200).json({
      num_found: totalFound,
      start: parseInt(offset) || 0,
      docs: allBooks,
      sources: sourceInfo,
      search_query: q,
      external_suggestions: externalSuggestions,
      message: allBooks.length === 0 ? 
        "No books found in major databases. Try the external search links below or check our AI chat for recommendations!" :
        `Found ${allBooks.length} books from ${Object.keys(sourceInfo).filter(s => sourceInfo[s].status === 'success').join(' + ')}`
    });

  } catch (error) {
    console.error('Multi-search error:', error);
    res.status(500).json({ error: 'Multi-source search failed' });
  }
}