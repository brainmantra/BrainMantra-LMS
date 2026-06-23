import { useParams, Navigate } from 'react-router-dom';
import ChallengeGrid from '../components/ChallengeGrid';

export default function Dashboard() {
  const { level } = useParams();
  
  // Basic route protection: ensure user data exists in localStorage
  const session = JSON.parse(localStorage.getItem('userSession'));
  
  if (!session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
      {/* Main Challenge Area */}
      <div className="flex-grow space-y-6">
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white capitalize">{level} Level</h2>
            <p className="text-gray-400">Day 14 of 100</p>
          </div>
          
          {/* Streak Counter Component (Inline for simplicity) */}
          <div className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-xl border border-orange-500/30">
            <span className="text-2xl">🔥</span>
            <span className="text-xl font-bold text-orange-400">14 Day Streak</span>
          </div>
        </div>

        <ChallengeGrid />
      </div>

      {/* Sidebar (Leaderboard) */}
      <aside className="w-full md:w-80 space-y-6">
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
          <h3 className="text-xl font-semibold mb-4 text-white">Weekly Top 3</h3>
          <ul className="space-y-4">
            {/* Mock Leaderboard Data */}
            {['Arjun R.', 'Sara K.', 'Meera P.'].map((name, idx) => (
              <li key={idx} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`font-bold ${idx === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>#{idx + 1}</span>
                  <span className="text-white">{name}</span>
                </div>
                <span className="text-sm text-blue-400 text-right">98%<br/><span className="text-xs text-gray-500">2m 14s</span></span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}