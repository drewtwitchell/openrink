# OpenRink 🏒

Free, open-source hockey league management system. Track teams, games, standings, player stats, and payments all in one place.

## ✨ Features

### League & Season Management
- **Multiple Leagues** - Create and manage multiple leagues with distinct seasons
- **Custom Point Systems** - Configure win/loss/tie point values per season
- **League Archiving** - Archive completed seasons while preserving all historical data
- **Subdomain Support** - Host multiple leagues on separate subdomains

### Team & Player Management
- **Team Rosters** - Manage players with contact information, jersey numbers, and positions
- **User Accounts** - Link players to user accounts for automatic roster updates
- **Player Transfers** - Move players between teams with full history tracking
- **Team Captains** - Designate captains with special management permissions
- **CSV Import** - Bulk import rosters and schedules via CSV files

### Game Scheduling & Tracking
- **Game Scheduling** - Schedule games across multiple rinks and ice surfaces
- **Live Standings** - Automatic standings calculation with wins, losses, ties, and goal differentials
- **Player Statistics** - Track goals, assists, points, penalty minutes, and games played
- **Upcoming Games** - Weekly game schedules displayed in league overviews
- **Game Attendance** - Players can mark attendance for upcoming games
- **Calendar Sync** - Export games to Google Calendar, Apple Calendar, Outlook with iCal feeds

### Playoff System
- **Bracket Creation** - Create and manage playoff tournaments
- **Automatic Seeding** - Seed teams based on regular season standings
- **Match Tracking** - Track playoff games and advance winners automatically
- **Championship Games** - Support for finals, semifinals, and consolation rounds

### Communication
- **League Announcements** - Post league-wide announcements to all members
- **Sub Requests** - Team captains can request substitutes for upcoming games
- **Email Notifications** - Automated email notifications for sub requests and confirmations

### Payments & Tracking
- **Season Dues** - Track player payment information by season
- **Venmo Integration** - Include Venmo payment links for easy collection
- **Payment Status** - Visual progress indicators show who's paid and who hasn't

### Location Services
- **Rink Management** - Manage multiple rinks with different ice surfaces
- **Integrated Maps** - One-click directions via Google Maps, Apple Maps, or Waze
- **Address Lookup** - Automatic map links from rink addresses

### Security & Reliability
- **Role-Based Access** - Admin, League Manager, Team Captain, and Player roles with granular permissions
- **Automated Backups** - Weekly automated database backups
- **Manual Backup/Restore** - Admin-controlled backup creation and restoration
- **Secure Authentication** - JWT tokens with bcrypt password hashing
- **Rate Limiting** - Protection against brute force authentication attempts

### Public Features
- **Public League Pages** - Share league standings and schedules with public URLs
- **Mobile Responsive** - Works perfectly on phones, tablets, and desktops
- **100% Self-Hosted** - All data stays on your server, no external services required

## User Roles

- **Admin**: Full access to all features, user management, all leagues, and database backups
- **League Manager**: Manage assigned leagues, create seasons, track payments across all teams
- **Team Captain**: Manage team roster, request substitutes, update team information
- **Player**: View schedules, standings, mark attendance, and respond to sub requests

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
git clone https://github.com/drewtwitchell/openrink.git
cd openrink
npm install
```

### Configuration

Create a `.env` file in the root directory:

```bash
VITE_API_URL=http://localhost:3001
JWT_SECRET=your-secure-secret-key-change-in-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Security Note**: Make sure to use a strong, unique JWT_SECRET in production (at least 32 characters).

### Development

```bash
npm run dev
```

This starts both the frontend (port 3000) and backend (port 3001) in development mode.

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Production Deployment

For production deployment on platforms like Vercel, Render, or your own server:

1. Set environment variables:
   - `JWT_SECRET` - Strong secret key for JWT token signing
   - `VITE_API_URL` - Your production API URL
   - `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend origins
   - `NODE_ENV=production`

2. Build the application:
```bash
npm run build
```

3. The built frontend will be in the `dist` directory
4. The backend server can be started with:
```bash
cd server && node index.js
```

### First User

The first user to register automatically becomes the admin with full access to all features.

## 📱 Dashboard Views

### Admin Dashboard
- User management interface
- Access to all leagues and data
- Database backup and restore functionality
- Quick access to create new leagues and manage users

### Player Dashboard
- Personal team information and roster
- Upcoming games with attendance marking
- Sub requests and availability
- Payment status for current season

### Team Captain Dashboard
- Team roster management
- Create substitute requests for games
- View team schedule and standings
- Manage team payments

### League Manager Dashboard
- Manage assigned leagues and seasons
- Create and schedule games
- Track payments across all teams
- Post league announcements

## 🏒 League Management

### Creating a League
1. Sign in as an admin or league manager
2. Go to Dashboard > Create League
3. Enter league name, description, and optional information
4. Create your first season with custom point system
5. Add teams and players
6. Schedule games

### Seasons
Each league can have multiple seasons with:
- Custom start and end dates
- Configurable points for wins, losses, and ties
- Individual payment tracking
- Season-specific rosters

### Playoff Brackets
- Create brackets from league standings
- Support for 4, 8, or 16 team tournaments
- Automatic match scheduling
- Winner advancement and bracket progression

## 📊 Statistics

OpenRink automatically tracks comprehensive player statistics:
- Games Played (GP)
- Goals (G)
- Assists (A)
- Points (PTS)
- Penalty Minutes (PIM)
- Plus/Minus (+/-)

Statistics are calculated in real-time as game scores are entered.

## 💾 Backup & Restore

Admins can:
- Create manual backups at any time
- Restore from any previous backup
- Download backup files
- Automatic weekly backups (Sundays at 2:00 AM)
- System keeps last 10 backups automatically

## 🔒 Security Features

- **Password Security**: bcrypt hashing with salt rounds
- **JWT Authentication**: Secure token-based authentication with 7-day expiration
- **Rate Limiting**: Protection against brute force attacks (15 attempts per 15 minutes)
- **CORS Protection**: Configurable allowed origins
- **Security Headers**: Helmet.js for HTTP header security
- **Input Validation**: Payload size limits and input sanitization
- **Role-Based Access Control**: Granular permissions system

## 🛠️ Technology Stack

- **Frontend**: React 18 with Vite
- **Backend**: Express.js
- **Database**: SQLite with automatic migrations
- **Styling**: Tailwind CSS
- **Authentication**: JWT tokens with bcrypt
- **Calendar**: ICS (iCalendar) format for universal compatibility

## 📦 Project Structure

```
openrink/
├── src/                    # Frontend React application
│   ├── components/        # Reusable UI components
│   ├── lib/              # API client and utilities
│   ├── pages/            # Page components
│   └── index.css         # Tailwind CSS styles
├── server/               # Backend Express application
│   ├── routes/          # API route handlers
│   ├── middleware/      # Authentication and security middleware
│   ├── utils/           # Utility functions and backup system
│   └── database.js      # SQLite database setup
└── public/              # Static assets
```

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 📄 License

MIT License - feel free to use this for your hockey league or modify it for your needs.

## ⭐ Features Roadmap

- [ ] Email service integration for automated notifications
- [ ] SMS notifications for game reminders
- [ ] Mobile apps (iOS/Android)
- [ ] Advanced statistics and analytics
- [ ] Multi-language support
- [ ] Tournament management beyond playoffs

## 🐛 Issues

If you encounter any issues or have feature requests, please [open an issue](https://github.com/drewtwitchell/openrink/issues) on GitHub.

---

**Built with React, Express, and SQLite**
