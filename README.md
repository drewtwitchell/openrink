# OpenRink 🏒

Free, lightweight hockey league management system. Built with React, Supabase, and Tailwind CSS.

## Features

- **League Management**: Create and manage multiple leagues
- **Team Rosters**: Track players with contact information
- **Game Scheduling**: Schedule games across multiple rinks and ice surfaces
- **Live Standings**: Automatic standings calculation based on game results
- **Payment Tracking**: Track dues with Venmo integration
- **Sub Requests**: Request substitutes with notifications
- **Email Notifications**: Automated reminders for upcoming games
- **Mobile Friendly**: Responsive design works on all devices

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Hosting**: Vercel (free tier)
- **Notifications**: Email via Resend (free tier)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/drewtwitchell/openrink.git
cd openrink
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to the SQL Editor and run the schema from `supabase-schema.sql`
4. Go to Settings > API to get your project URL and anon key

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deployment

### Deploy to Vercel (Free)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project" and import your repository
4. Add environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
5. Click "Deploy"

Your app will be live at `https://your-app.vercel.app`

## Usage Guide

### Creating Your First League

1. Sign up for an account
2. Navigate to "Leagues" and click "New League"
3. Fill in the league details and save

### Adding Teams

1. Go to "Teams" and click "New Team"
2. Select the league and enter team details
3. Choose a team color for easy identification

### Managing Rosters

1. Click on a team to view its roster
2. Add players with their email and phone numbers
3. Enable email notifications for game reminders

### Scheduling Games

1. Navigate to "Games" and click "Schedule Game"
2. Select home/away teams, date, time, and rink
3. Choose the ice surface (NHL or Olympic)

### Tracking Standings

1. Go to "Standings" and select a league
2. Standings are automatically calculated from game results
3. Update game scores to see standings change in real-time

### Payment Tracking

1. Add payment records for each player
2. Generate Venmo payment links for easy collection
3. Track payment status (pending, paid, overdue)

### Sub Requests

1. Create a sub request for any game
2. Notifications are sent to available players
3. Option to require payment from substitute

## Database Schema

The app uses the following main tables:

- `leagues` - League information and settings
- `teams` - Teams within leagues
- `players` - Player roster with contact info
- `games` - Game schedule and results
- `rinks` - Rink locations and ice surfaces
- `payments` - Dues and payment tracking
- `sub_requests` - Substitute requests
- `notifications` - Email notification log

See `supabase-schema.sql` for the complete schema.

## Future Enhancements

- [ ] SMS notifications (via Twilio)
- [ ] Player statistics tracking
- [ ] Game recap and highlights
- [ ] Mobile app (React Native)
- [ ] Advanced scheduling with conflicts detection
- [ ] Team chat/messaging
- [ ] Export data to CSV/Excel
- [ ] Custom league rules and settings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ by Drew Twitchell
