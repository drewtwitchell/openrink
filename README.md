# OpenRink 🏒

Free, self-hosted hockey league management system.

## Features

- **League Management** - Create and manage multiple leagues with seasons
- **League Archiving** - Archive past seasons while preserving data
- **Team Rosters** - Track players with contact information and jersey numbers
- **User Accounts** - Link players to user accounts for automatic roster updates
- **Role-Based Access** - Admin, League Manager, Team Captain, and Player roles
- **Game Scheduling** - Schedule games with dates, times, and rink information
- **Live Standings** - Automatic standings calculation with wins, losses, ties, and goal differentials
- **Upcoming Games** - Weekly game schedules displayed in league overviews
- **Substitute Requests** - Team captains can request substitutes for games
- **Season Dues** - Track league-level payment information with Venmo integration
- **CSV Uploads** - Bulk import rosters and schedules via CSV files
- **Breadcrumb Navigation** - Easy navigation through league hierarchy
- **Public Pages** - Share league standings and schedules publicly
- **Mobile Friendly** - Responsive design works on all devices
- **100% Self-Hosted** - No external services required, all data stays on your server

## User Roles

- **Admin**: Full access to all features, user management, and all leagues
- **League Manager**: Manage assigned leagues, teams, games, and schedules
- **Team Captain**: Manage team roster, request substitutes, and update team information
- **Player**: View schedules, standings, and personal team information

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone https://github.com/drewtwitchell/openrink.git
cd openrink
npm install
```

### Configuration

Create a `.env` file:

```bash
VITE_API_URL=http://localhost:3001
JWT_SECRET=change-this-in-production
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### First User

The first user to sign up automatically becomes the admin with full access to all features.

## Dashboard Views

### Admin Dashboard
- Lists all active leagues
- User management interface
- Quick access to create new leagues and manage users

### Player/Captain/Manager Dashboard
- Shows assigned league information
- Displays team roster and league members
- Season dues payment information
- Quick access to team roster management

### League Details
- Upcoming games for the current week
- Complete league standings with stats
- Team management and game schedules
- League-specific information and season dues

## Technology Stack

- **Frontend**: React with Vite
- **Backend**: Express.js
- **Database**: SQLite
- **Styling**: Tailwind CSS
- **Authentication**: JWT tokens with bcrypt

---

**Built with React, Express, and SQLite**
