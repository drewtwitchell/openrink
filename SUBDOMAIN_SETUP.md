# Subdomain Setup for Individual Leagues

OpenRink supports dedicated URLs for each league using URL parameters. This guide explains how to set up subdomain routing (e.g., `mhl.openrink.app`) to automatically show a specific league.

## How It Works

The homepage supports filtering by league using URL query parameters:
- Main site: `openrink.app` → Shows all leagues
- Specific league: `openrink.app?league=mhl` → Shows only MHL league
- By ID: `openrink.app?league=1` → Shows league with ID 1

## Setting Up Subdomains

### Option 1: DNS + Hosting Redirect (Recommended)

Most hosting providers (Vercel, Netlify, etc.) support redirect rules:

**Vercel** - Create `vercel.json`:
```json
{
  "redirects": [
    {
      "source": "/",
      "has": [
        {
          "type": "host",
          "value": "mhl.openrink.app"
        }
      ],
      "destination": "/?league=mhl",
      "permanent": false
    }
  ]
}
```

**Netlify** - Add to `netlify.toml`:
```toml
[[redirects]]
  from = "https://mhl.openrink.app/*"
  to = "https://openrink.app/?league=mhl:splat"
  status = 200
  force = true
```

**Apache** - Add to `.htaccess`:
```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^mhl\.openrink\.app$ [NC]
RewriteRule ^(.*)$ /?league=mhl [L,QSA]
```

**Nginx** - Add to server config:
```nginx
server {
    listen 80;
    server_name mhl.openrink.app;
    return 301 $scheme://openrink.app$request_uri?league=mhl;
}
```

### Option 2: Dynamic Subdomain Detection

For a more advanced setup, modify the app to automatically detect subdomains:

1. Update `src/pages/Home.jsx` to check `window.location.hostname`
2. Extract subdomain (e.g., "mhl" from "mhl.openrink.app")
3. Use subdomain as league filter automatically

Example code:
```javascript
// In Home.jsx
const getLeagueFromSubdomain = () => {
  const hostname = window.location.hostname
  const parts = hostname.split('.')
  if (parts.length > 2 && parts[0] !== 'www') {
    return parts[0] // Returns "mhl" from "mhl.openrink.app"
  }
  return null
}

// Use in component
const subdomainLeague = getLeagueFromSubdomain()
const leagueFilter = searchParams.get('league') || subdomainLeague
```

## DNS Configuration

For each league subdomain:

1. Add A record or CNAME pointing to your hosting:
   - Type: CNAME
   - Name: mhl
   - Value: your-app.vercel.app (or your hosting domain)

2. Repeat for each league you want a subdomain for

## Testing Locally

To test subdomains locally:

1. Edit `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
   ```
   127.0.0.1 mhl.localhost
   127.0.0.1 summer.localhost
   ```

2. Access your app at `http://mhl.localhost:3000`

## League Name vs ID

The filter supports both league names and IDs:
- `?league=mhl` - Matches by name (case-insensitive)
- `?league=1` - Matches by ID

League names are more user-friendly but IDs are more stable if you rename a league.

## Benefits

✅ Professional appearance (mhl.openrink.app vs openrink.app?league=mhl)
✅ Easy to share specific league links
✅ Each league feels like its own site
✅ SEO-friendly URLs
✅ No code changes needed - just DNS + redirects
