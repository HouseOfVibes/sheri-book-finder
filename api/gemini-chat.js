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

  const { message, conversation_history = [] } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    // Build conversation context
    const systemPrompt = `You are Sheri's personal book recommendation AI assistant, specializing in "Good Vibes Only" book discoveries. You help find amazing books based on preferences, moods, genres, and specific requests.

Your personality:
- Enthusiastic about books with positive energy
- Great at understanding reading moods and preferences  
- Knowledgeable about diverse genres and authors
- Always provide specific book titles and authors
- Include brief reasons why each book matches the request
- Focus on books that bring good vibes and positive energy

When recommending books:
1. Always include specific titles and authors
2. Briefly explain why each book fits their request
3. Mix popular and lesser-known gems
4. Consider diversity in authors and perspectives
5. Match the energy they're looking for

Keep responses concise but enthusiastic. End with: "Want me to help you search for any of these in the book finder?"`;

    // Prepare conversation for Gemini
    const conversationParts = [
      { text: systemPrompt }
    ];
    
    // Add conversation history
    conversation_history.forEach(msg => {
      conversationParts.push({ text: `Human: ${msg.human}` });
      if (msg.assistant) {
        conversationParts.push({ text: `Assistant: ${msg.assistant}` });
      }
    });
    
    // Add current message
    conversationParts.push({ text: `Human: ${message}` });

    const requestBody = {
      contents: [{
        parts: conversationParts
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API request failed');
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                      'Sorry, I had trouble generating a response. Try asking about specific genres or authors!';

    // Extract book titles for easy searching (basic pattern matching)
    const bookMatches = aiResponse.match(/"([^"]+)"\s+by\s+([^,.\n!?]+)/g) || [];
    const extractedBooks = bookMatches.slice(0, 5).map(match => {
      const [, title, author] = match.match(/"([^"]+)"\s+by\s+([^,.\n!?]+)/) || [];
      return { title: title?.trim(), author: author?.trim() };
    }).filter(book => book.title && book.author);

    res.status(200).json({
      response: aiResponse,
      extracted_books: extractedBooks,
      conversation_id: Date.now() // Simple conversation tracking
    });

  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ 
      error: 'AI assistant temporarily unavailable',
      fallback_response: "I'm having trouble connecting right now, but I'd love to help you find books! Try searching for specific authors, genres like 'cozy mystery' or 'fantasy romance', or describe the vibe you're going for like 'beach read' or 'emotional page-turner'!"
    });
  }
}