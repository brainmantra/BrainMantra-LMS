import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, error, success
  const [user, setUser] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      // API call to your Vercel backend /api/verify
      // const response = await axios.post('/api/verify', { mobile_number: mobile });
      
      // MOCK DATA FOR TESTING Frontend
      const response = { data: { name: 'Disha', level: 'Beginner', user_id: '123' } };
      
      setUser(response.data);
      setStatus('success');
      
      // Store session data locally
      localStorage.setItem('userSession', JSON.stringify(response.data));

    } catch (error) {
      setStatus('error');
      // Redirect to Google form after 3 seconds
      setTimeout(() => {
        window.location.href = "https://forms.gle/YOUR_GOOGLE_FORM_LINK";
      }, 3000);
    }
  };

  useEffect(() => {
    if (status === 'success') {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);

      const redirect = setTimeout(() => {
        navigate(`/dashboard/${user.level.toLowerCase()}`);
      }, 10000);

      return () => {
        clearInterval(timer);
        clearTimeout(redirect);
      };
    }
  }, [status, navigate, user]);

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 text-center animate-fade-in">
        <h2 className="text-4xl font-semibold text-white">Welcome back, {user.name}!</h2>
        <p className="text-xl text-gray-400">Preparing your Level {user.level} Challenge...</p>
        <div className="text-6xl font-bold text-blue-500">{countdown}</div>
        <p className="text-sm text-gray-500">Redirecting automatically...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-800 self-start mt-20">
      <h2 className="text-2xl font-semibold mb-6 text-center">Verify Registration</h2>
      
      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Registered Mobile Number</label>
          <input
            type="tel"
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            placeholder="+91 9876543210"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 disabled:opacity-50"
        >
          {status === 'loading' ? 'Verifying...' : 'Access Challenge'}
        </button>
      </form>

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm text-center">
          We couldn't find an active registration for this number. Redirecting to registration form...
        </div>
      )}
    </div>
  );
}