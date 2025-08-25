export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'TikTok URL is required' });
  }

  // Validate TikTok URL
  const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)/i;
  if (!tiktokRegex.test(url)) {
    return res.status(400).json({ error: 'Please provide a valid TikTok URL' });
  }

  try {
    // For now, we'll use a simple approach to extract book information
    // In a production app, you might use TikTok's API or a scraping service
    
    // Try to fetch the TikTok page to get metadata
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookBot/1.0)',
      }
    });
    
    const html = await response.text();
    
    // Extract potential book titles and authors using common patterns
    const bookPatterns = [
      // Common book mention patterns in TikTok descriptions
      /"([^"]+)"\s+by\s+([^,\n.!?]+)/gi,
      /([A-Z][a-zA-Z\s]+)\s+by\s+([A-Z][a-zA-Z\s]+)/g,
      /"([^"]+)"/g,
      // Book series patterns
      /Book\s+\d+[:\s]+([^,\n.!?]+)/gi,
      // Hashtag patterns
      /#book([a-zA-Z\s]+)/gi
    ];
    
    const extractedBooks = [];
    const seenBooks = new Set();
    
    // Extract from meta description and title
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const content = [titleMatch?.[1], descMatch?.[1]].filter(Boolean).join(' ');
    
    bookPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const bookInfo = match[1]?.trim();
        const author = match[2]?.trim();
        
        if (bookInfo && bookInfo.length > 3 && bookInfo.length < 100) {
          const bookKey = bookInfo.toLowerCase();
          if (!seenBooks.has(bookKey)) {
            seenBooks.add(bookKey);
            extractedBooks.push({
              title: bookInfo,
              author: author || null,
              confidence: author ? 'high' : 'medium'
            });
          }
        }
      }
    });
    
    // If no books found, suggest common search terms from the content
    if (extractedBooks.length === 0) {
      const commonTerms = ['book', 'read', 'author', 'novel', 'series', 'romance', 'fantasy', 'mystery'];
      const suggestions = commonTerms.filter(term => 
        content.toLowerCase().includes(term)
      );
      
      return res.status(200).json({
        books: [],
        suggestions: suggestions.slice(0, 3),
        message: "No specific books found, but try these search terms based on the video content!"
      });
    }
    
    res.status(200).json({
      books: extractedBooks.slice(0, 5), // Limit to 5 results
      url: url,
      message: `Found ${extractedBooks.length} potential book${extractedBooks.length !== 1 ? 's' : ''} from this TikTok!`
    });
    
  } catch (error) {
    console.error('TikTok parsing error:', error);
    
    // Fallback: suggest manual search
    res.status(200).json({
      books: [],
      suggestions: ['book recommendations', 'book review', 'book haul'],
      message: "Couldn't parse the TikTok automatically. Try searching for 'book recommendations' or describe what you saw in the video!"
    });
  }
}