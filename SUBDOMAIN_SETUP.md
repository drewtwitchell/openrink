# Subdomain Setup for Individual Leagues

OpenRink automatically detects subdomains and displays the corresponding league. No code changes required!

## How It Works

The app automatically extracts the league name from your subdomain:
- Main site: `openrink.app` → Shows all leagues
- Specific league: `mhl.openrink.app` → Shows only MHL league
- Another league: `summer.openrink.app` → Shows only Summer league

The subdomain name (e.g., "mhl") is matched against your league names in the database (case-insensitive).

## DNS Setup

For each league subdomain, add a DNS record pointing to your hosting:

1. Go to your DNS provider (Cloudflare, Namecheap, etc.)
2. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: mhl (or your league name)
   - **Value**: your-app.vercel.app (or your hosting domain)
   - **TTL**: Auto or 3600
3. Repeat for each league you want a subdomain for

Example:
```
CNAME  mhl      ->  your-app.vercel.app
CNAME  summer   ->  your-app.vercel.app
CNAME  winter   ->  your-app.vercel.app
```

## Testing Locally

To test subdomains on your local machine:

1. Edit your hosts file:
   - **Mac/Linux**: `/etc/hosts`
   - **Windows**: `C:\Windows\System32\drivers\etc\hosts`

2. Add entries:
   ```
   127.0.0.1 mhl.localhost
   127.0.0.1 summer.localhost
   ```

3. Access your app at `http://mhl.localhost:3000`

## League Name Matching

The subdomain is matched against league names in your database:
- `mhl.openrink.app` will show leagues with name "MHL", "mhl", or "Mhl"
- Matching is case-insensitive
- If no matching league is found, all leagues are shown

## Benefits

✅ Clean, professional URLs (mhl.openrink.app)
✅ Works automatically - no configuration needed
✅ Each league feels like its own site
✅ Easy to share league-specific links
✅ SEO-friendly
✅ Supports unlimited leagues
