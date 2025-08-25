import { Client } from '@notionhq/client';

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

  const { book } = req.body;
  
  if (!book) {
    return res.status(400).json({ error: 'Book data is required' });
  }

  try {
    const notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });

    const databaseId = process.env.NOTION_DATABASE_ID;

    // Prepare the book data for Notion
    const title = book.title || 'Unknown Title';
    const authors = book.author_name ? book.author_name.join(', ') : 'Unknown Author';
    const firstPublishYear = book.first_publish_year;
    const editionCount = book.edition_count;
    const coverId = book.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
    const pages = book.number_of_pages_median || null;
    const isbn = book.isbn ? book.isbn[0] : null;
    
    // Additional rich data from API
    const publisher = book.publisher ? book.publisher.slice(0, 3).join(', ') : null;
    const language = book.language ? book.language.join(', ').toUpperCase() : 'EN';
    const ratingsCount = book.ratings_count || 0;
    const readinglogCount = book.readinglog_count || 0;
    const hasEbook = book.ebook_access && book.ebook_access !== 'no_ebook';
    const hasFullText = book.has_fulltext || false;
    const internetArchiveId = book.ia ? book.ia[0] : null;

    // Enhanced genre detection matching your database options
    let genres = [];
    let partOfSeries = 'No'; // Default
    let audioAvailable = 'No'; // Default
    
    if (book.subject) {
      const subjects = book.subject.slice(0, 15); // Check more subjects for better accuracy
      subjects.forEach(subject => {
        const lowerSubject = subject.toLowerCase();
        
        // Match your exact genre options with more patterns
        if (lowerSubject.includes('fiction') && !lowerSubject.includes('non-fiction')) {
          genres.push('Fiction');
        } else if (lowerSubject.includes('non-fiction') || lowerSubject.includes('biography') || lowerSubject.includes('history')) {
          genres.push('Non-Fiction');
        } else if (lowerSubject.includes('mystery') || lowerSubject.includes('detective') || lowerSubject.includes('crime')) {
          genres.push('Mystery');
        } else if (lowerSubject.includes('science fiction') || lowerSubject.includes('sci-fi')) {
          genres.push('Science Fiction');
        } else if (lowerSubject.includes('fantasy') || lowerSubject.includes('magic')) {
          genres.push('Fantasy');
        } else if (lowerSubject.includes('biography') || lowerSubject.includes('biographical')) {
          genres.push('Biography');
        } else if (lowerSubject.includes('self-help') || lowerSubject.includes('self help') || lowerSubject.includes('personal development')) {
          genres.push('Self-Help');
        } else if (lowerSubject.includes('business') || lowerSubject.includes('entrepreneurship') || lowerSubject.includes('management')) {
          genres.push('Business');
        } else if (lowerSubject.includes('memoir') || lowerSubject.includes('autobiography')) {
          genres.push('Memoir');
        }
        
        // Check for series indicators
        if (lowerSubject.includes('series') || lowerSubject.includes('book 1') || lowerSubject.includes('volume') || 
            lowerSubject.includes('trilogy') || lowerSubject.includes('saga')) {
          partOfSeries = 'Yes';
        }
        
        // Check for audiobook indicators
        if (lowerSubject.includes('audiobook') || lowerSubject.includes('audio book') || lowerSubject.includes('narration')) {
          audioAvailable = 'Yes';
        }
      });
    }
    
    // Check title for series indicators (more comprehensive)
    const titleLower = title.toLowerCase();
    if (titleLower.includes('series') || title.includes('#') || title.includes('Book ') || 
        titleLower.includes('trilogy') || titleLower.includes('saga') || titleLower.includes('volume') ||
        /book \d+/i.test(title) || /part \d+/i.test(title)) {
      partOfSeries = 'Yes';
    }
    
    // Enhanced audiobook detection
    if (hasEbook || internetArchiveId) {
      audioAvailable = 'Yes'; // Assume audio might be available if digital versions exist
    }
    
    // Remove duplicates and default
    genres = [...new Set(genres)];
    if (genres.length === 0) {
      // Better default based on other signals
      if (book.person || (book.subject && book.subject.some(s => s.toLowerCase().includes('biography')))) {
        genres = ['Biography'];
      } else {
        genres = ['Fiction']; // Default genre
      }
    }

    const properties = {
      'Title': {
        title: [
          {
            text: {
              content: title
            }
          }
        ]
      },
      'Author': {
        rich_text: [
          {
            text: {
              content: authors
            }
          }
        ]
      },
      'Status': {
        select: {
          name: 'To Read'
        }
      },
      'Genre': {
        multi_select: genres.map(genre => ({ name: genre }))
      },
      'Date Added': {
        date: {
          start: new Date().toISOString().split('T')[0]
        }
      },
      'Part of Series': {
        select: {
          name: partOfSeries
        }
      },
      'Audiobook Available': {
        select: {
          name: audioAvailable
        }
      }
    };

    // Add Pages if available
    if (pages) {
      properties['Pages'] = {
        number: pages
      };
    }

    // Add Link to Buy (OpenLibrary link)
    if (book.key) {
      properties['Link to Buy'] = {
        url: `https://openlibrary.org${book.key}`
      };
    }

    // Add Audiobook Link - prioritize Internet Archive, fallback to Audible search
    if (internetArchiveId) {
      properties['Audiobook Link'] = {
        url: `https://archive.org/details/${internetArchiveId}`
      };
    } else if (audioAvailable === 'Yes') {
      // Generate Audible search link as fallback
      const audibleSearch = `https://www.audible.com/search?keywords=${encodeURIComponent(`${title} ${authors}`)}`;
      properties['Audiobook Link'] = {
        url: audibleSearch
      };
    }

    // Enhanced Summary with rich metadata
    const summaryParts = [];
    if (firstPublishYear) summaryParts.push(`Published: ${firstPublishYear}`);
    if (editionCount > 1) summaryParts.push(`${editionCount} editions`);
    if (publisher) summaryParts.push(`Publisher: ${publisher}`);
    if (language && language !== 'EN') summaryParts.push(`Language: ${language}`);
    if (ratingsCount > 0) summaryParts.push(`⭐ ${ratingsCount} ratings`);
    if (readinglogCount > 0) summaryParts.push(`📚 ${readinglogCount} reading logs`);
    if (hasEbook) summaryParts.push(`📖 Ebook available`);
    if (hasFullText) summaryParts.push(`📄 Full text available`);
    if (internetArchiveId) summaryParts.push(`🏛️ Archive: ${internetArchiveId}`);
    
    if (summaryParts.length > 0) {
      properties['Summary'] = {
        rich_text: [
          {
            text: {
              content: summaryParts.join(' • ')
            }
          }
        ]
      };
    }

    if (coverUrl) {
      properties['Cover'] = {
        files: [
          {
            name: `${title} Cover`,
            external: {
              url: coverUrl
            }
          }
        ]
      };
    }

    const response = await notion.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties: properties
    });

    res.status(200).json({ 
      success: true, 
      message: 'Book added to your catalog successfully! 🔥',
      pageId: response.id 
    });

  } catch (error) {
    console.error('Notion API error:', error);
    res.status(500).json({ 
      error: 'Failed to add book to Notion',
      details: error.message 
    });
  }
}