# OpenRink 🏒

Free, self-hosted hockey league management system. Built with React, Express, and SQLite - **no external accounts required**!

## Features

- **League Management**: Create and manage multiple leagues
- **Team Rosters**: Track players with contact information
- **Game Scheduling**: Schedule games across multiple rinks and ice surfaces
- **Live Standings**: Automatic standings calculation based on game results
- **Payment Tracking**: Track dues with Venmo integration
- **Sub Requests**: Request substitutes with notifications
- **Email Notifications**: Automated reminders for upcoming games
- **Mobile Friendly**: Responsive design works on all devices
- **100% Self-Hosted**: No external services or accounts needed!

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express.js + SQLite
- **Authentication**: JWT tokens
- **Database**: SQLite (file-based, no setup needed)
- **Deployment**: Can deploy to any Node.js hosting (Railway, Render, etc.)

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Git

### 1. Clone and Install

```bash
git clone https://github.com/drewtwitchell/openrink.git
cd openrink
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
VITE_API_URL=http://localhost:3001
JWT_SECRET=change-this-to-a-random-secret-in-production
```

### 3. Start the Application

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 3000).

Open [http://localhost:3000](http://localhost:3000) to view the app.

### 4. Create Your Account

1. Click "Sign In" in the top right
2. Click "Don't have an account? Sign Up"
3. Enter your email and password
4. Start creating leagues and teams!

## Usage Guide

### Creating Your First League

1. Sign up for an account
2. Navigate to "Leagues" and click "New League"
3. Fill in the league details and save

### Adding Teams

1. Go to "Teams" and click "New Team"
2. Select the league and enter team details
3. Choose a team color for easy identification

### Scheduling Games

1. Navigate to "Games" and click "Schedule Game"
2. Select home/away teams, date, time, and rink
3. Choose the ice surface (NHL or Olympic)

### Tracking Standings

1. Go to "Standings" and select a league
2. Standings are automatically calculated from game results
3. Update game scores to see standings change in real-time

## Project Structure

```
openrink/
├── server/              # Backend Express.js server
│   ├── index.js        # Main server file
│   ├── database.js     # SQLite database setup
│   ├── routes/         # API route handlers
│   └── middleware/     # Auth middleware
├── src/                # Frontend React app
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components
│   ├── lib/            # API client and utilities
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
└── package.json        # Dependencies and scripts
```

## Database Schema

The app uses SQLite with the following main tables:

- `users` - User accounts and authentication
- `leagues` - League information and settings
- `teams` - Teams within leagues
- `players` - Player roster with contact info
- `games` - Game schedule and results
- `rinks` - Rink locations and ice surfaces
- `payments` - Dues and payment tracking
- `sub_requests` - Substitute requests

The database is automatically created when you start the server.

## Deployment

### Deploy to Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Connect your GitHub repository
4. Add environment variables:
   - `VITE_API_URL`: Your Railway backend URL
   - `JWT_SECRET`: A random secret string
5. Deploy!

### Deploy to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and create a new Web Service
3. Connect your GitHub repository
4. Set build command: `npm install && npm run build`
5. Set start command: `node server/index.js`
6. Add environment variables
7. Deploy!

## Development

### Run Frontend Only

```bash
npm run client
```

### Run Backend Only

```bash
npm run server
```

### Run Both (Recommended)

```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/signin` - Sign in
- `GET /api/auth/me` - Get current user

### Leagues
- `GET /api/leagues` - Get all leagues
- `POST /api/leagues` - Create league
- `PUT /api/leagues/:id` - Update league
- `DELETE /api/leagues/:id` - Delete league

### Teams
- `GET /api/teams` - Get all teams
- `POST /api/teams` - Create team
- `DELETE /api/teams/:id` - Delete team

### Games
- `GET /api/games` - Get all games
- `POST /api/games` - Create game
- `PUT /api/games/:id/score` - Update game score
- `DELETE /api/games/:id` - Delete game

### Rinks
- `GET /api/rinks` - Get all rinks
- `POST /api/rinks` - Create rink

## Future Enhancements

- [ ] Email notifications (via Resend)
- [ ] SMS notifications (via Twilio - optional paid feature)
- [ ] Player statistics tracking
- [ ] Game recap and highlights
- [ ] Mobile app (React Native)
- [ ] Advanced scheduling with conflicts detection
- [ ] Team chat/messaging
- [ ] Export data to CSV/Excel
- [ ] Custom league rules and settings
- [ ] Roster management with player profiles
- [ ] Multi-league support for players

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ by Drew Twitchell

**No Supabase, No Firebase, No External Services - Just Pure Open Source!**
