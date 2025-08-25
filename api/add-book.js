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

    // Enhanced genre detection matching your database options
    let genres = [];
    let partOfSeries = 'No'; // Default
    
    if (book.subject) {
      const subjects = book.subject.slice(0, 10); // Check more subjects
      subjects.forEach(subject => {
        const lowerSubject = subject.toLowerCase();
        
        // Match your exact genre options
        if (lowerSubject.includes('fiction') && !lowerSubject.includes('non-fiction')) {
          genres.push('Fiction');
        } else if (lowerSubject.includes('non-fiction') || lowerSubject.includes('biography') || lowerSubject.includes('history')) {
          genres.push('Non-Fiction');
        } else if (lowerSubject.includes('mystery') || lowerSubject.includes('detective')) {
          genres.push('Mystery');
        } else if (lowerSubject.includes('science fiction') || lowerSubject.includes('sci-fi')) {
          genres.push('Science Fiction');
        } else if (lowerSubject.includes('fantasy')) {
          genres.push('Fantasy');
        } else if (lowerSubject.includes('biography')) {
          genres.push('Biography');
        } else if (lowerSubject.includes('self-help') || lowerSubject.includes('self help')) {
          genres.push('Self-Help');
        } else if (lowerSubject.includes('business')) {
          genres.push('Business');
        } else if (lowerSubject.includes('memoir')) {
          genres.push('Memoir');
        }
        
        // Check for series indicators
        if (lowerSubject.includes('series') || lowerSubject.includes('book 1') || lowerSubject.includes('volume')) {
          partOfSeries = 'Yes';
        }
      });
    }
    
    // Check title for series indicators
    if (title.toLowerCase().includes('series') || title.includes('#') || title.includes('Book ')) {
      partOfSeries = 'Yes';
    }
    
    // Remove duplicates and default
    genres = [...new Set(genres)];
    if (genres.length === 0) {
      genres = ['Fiction']; // Default genre
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

    // Add optional fields if available
    if (firstPublishYear) {
      properties['Summary'] = {
        rich_text: [
          {
            text: {
              content: `First published in ${firstPublishYear}. ${editionCount ? `${editionCount} editions available.` : ''}`
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