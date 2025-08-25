# 🚀 Deployment Guide - Sheri's Book Finder

## Quick Deploy to Vercel (Recommended)

### Option 1: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/HouseOfVibes/sheri-book-finder)

### Option 2: Manual Setup

#### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub account
3. Verify your email

#### Step 2: Deploy from GitHub
1. Push your code to GitHub repository
2. In Vercel dashboard, click "Add New Project"
3. Import your `sheri-book-finder` repository
4. Click "Deploy"

#### Step 3: Configure Environment Variables
After deployment, add these in Vercel dashboard → Settings → Environment Variables:

```
NOTION_TOKEN=secret_1A2B3C4D5E6F...
NOTION_DATABASE_ID=248ec610675381bf8a6ad9fd7354b56a
```

**Getting Your Notion Token:**
1. Go to [notion.so/my-integrations](https://notion.so/my-integrations)
2. Click "New integration"
3. Name: "Sheri's Book Finder"
4. Copy the "Internal Integration Token"

#### Step 4: Connect to Database
1. Open your Notion book database
2. Click "..." → "Add connections"
3. Select "Sheri's Book Finder" integration

## Environment Variables Details

| Variable | Description | Example |
|----------|-------------|---------|
| `NOTION_TOKEN` | Your integration secret token | `secret_1A2B...` |
| `NOTION_DATABASE_ID` | Your book database ID | `248ec610...` |

## File Structure (Ready for Deploy)

```
sheri-book-finder/
├── index.html              # Main app (✅ Ready)
├── package.json            # Dependencies (✅ Ready)  
├── vercel.json            # Deployment config (✅ Ready)
├── api/
│   ├── search.js          # Search endpoint (✅ Ready)
│   └── add-book.js        # Notion integration (✅ Ready)
├── README.md              # Project info
├── DEPLOYMENT.md          # This guide
└── .gitignore            # Git ignore file
```

## Testing Your Deployment

After deployment:
1. Visit your Vercel URL (e.g., `https://sheri-book-finder.vercel.app`)
2. Search for a test book (e.g., "Maya Angelou")
3. Try adding a book to verify Notion integration
4. Check your Notion database for the new entry

## Custom Domain (Optional)

1. In Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. SSL certificate is automatically provided

## Troubleshooting

### Common Issues:

**"Search not working"**
- Check API endpoints in Vercel Functions tab
- Verify deployment completed successfully

**"Books not adding to Notion"**
- Verify `NOTION_TOKEN` environment variable
- Check `NOTION_DATABASE_ID` is correct
- Ensure integration is connected to database

**"Environment variables not working"**
- Redeploy after adding environment variables
- Check variable names are exact matches

### Support Links:
- [Vercel Documentation](https://vercel.com/docs)
- [Notion API Docs](https://developers.notion.com)
- [Open Library API](https://openlibrary.org/developers/api)

---

🔥 **Your book finder will be live at:** `https://[your-project-name].vercel.app`

💪 **Good vibes only - happy book hunting!**