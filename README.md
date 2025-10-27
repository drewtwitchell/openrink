# OpenRink 🏒

Free, self-hosted hockey league management system.

## Features

- **League Management** - Create and manage multiple leagues
- **Team Rosters** - Track players with contact information
- **Game Scheduling** - Schedule games with dates, times, and locations
- **Live Standings** - Automatic standings calculation based on results
- **CSV Uploads** - Bulk import rosters and schedules
- **Public Pages** - Share league standings and schedules publicly
- **Mobile Friendly** - Works on all devices
- **100% Self-Hosted** - No external services required

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

The first user to sign up automatically becomes the admin.

---

**Built with React, Express, and SQLite**
