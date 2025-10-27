import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="text-center">
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Welcome to OpenRink
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Free, lightweight hockey league management system. Track teams, games, standings, and more.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="card text-left">
          <div className="text-3xl mb-3">🏒</div>
          <h3 className="text-xl font-semibold mb-2">League Management</h3>
          <p className="text-gray-600">
            Create and manage multiple leagues with teams, rosters, and schedules.
          </p>
        </div>

        <div className="card text-left">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-xl font-semibold mb-2">Live Standings</h3>
          <p className="text-gray-600">
            Automatic standings calculation based on game results and scores.
          </p>
        </div>

        <div className="card text-left">
          <div className="text-3xl mb-3">📧</div>
          <h3 className="text-xl font-semibold mb-2">Notifications</h3>
          <p className="text-gray-600">
            Email reminders for upcoming games and league announcements.
          </p>
        </div>

        <div className="card text-left">
          <div className="text-3xl mb-3">🏟️</div>
          <h3 className="text-xl font-semibold mb-2">Rink Management</h3>
          <p className="text-gray-600">
            Track games across multiple rinks and ice surfaces.
          </p>
        </div>

        <div className="card text-left">
          <div className="text-3xl mb-3">💰</div>
          <h3 className="text-xl font-semibold mb-2">Dues Collection</h3>
          <p className="text-gray-600">
            Easy payment tracking with Venmo integration.
          </p>
        </div>

        <div className="card text-left">
          <div className="text-3xl mb-3">🔄</div>
          <h3 className="text-xl font-semibold mb-2">Sub Requests</h3>
          <p className="text-gray-600">
            Request substitutes with automatic notifications to players.
          </p>
        </div>
      </div>

      <div className="space-x-4">
        <Link to="/login" className="btn-primary inline-block">
          Get Started
        </Link>
        <a
          href="https://github.com/drewtwitchell/openrink"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-block"
        >
          View on GitHub
        </a>
      </div>
    </div>
  )
}
