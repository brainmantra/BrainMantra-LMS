import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-950 flex flex-col items-center">
        {/* Simple global navigation/header */}
        <header className="w-full py-6 text-center border-b border-gray-800">
          <h1 className="text-3xl font-bold tracking-wider text-blue-500">
            100 DAYS ABACUS
          </h1>
        </header>

        <main className="w-full flex-grow flex justify-center p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard/:level" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;