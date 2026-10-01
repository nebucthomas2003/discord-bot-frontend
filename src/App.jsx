import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [lastFetch, setLastFetch] = useState(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
  const CACHE_DURATION = 30000; // 30 seconds
  const cacheRef = useRef(null);

  // Check if logged in on mount
 useEffect(() => {
  const storedToken = localStorage.getItem('adminToken');
  if (storedToken) {
    setToken(storedToken);
    setIsLoggedIn(true);
    fetchCommands(storedToken, false);
  }
}, [fetchCommands]);

  // Fetch commands with caching
  const fetchCommands = useCallback(async (t, forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if available and not forcing refresh
    if (!forceRefresh && cacheRef.current && now - lastFetch < CACHE_DURATION) {
      setCommands(cacheRef.current);
      return;
    }

    // Show skeleton only on initial load, not on refresh
    if (!cacheRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/commands?token=${t}`);
      
      if (res.status === 401) {
        setIsLoggedIn(false);
        localStorage.removeItem('adminToken');
        setError('Session expired. Please log in again.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      if (!res.ok) throw new Error('Unable to load command history');
      
      const data = await res.json();
      cacheRef.current = data || [];
      setCommands(data || []);
      setLastFetch(now);
    } catch (err) {
      setError(err.message || 'Failed to load commands');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lastFetch, BACKEND_URL]);

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/login?password=${encodeURIComponent(password)}`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        setLoginError('Invalid credentials');
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      const newToken = data.token;
      
      setToken(newToken);
      setIsLoggedIn(true);
      localStorage.setItem('adminToken', newToken);
      setPassword('');
      setLoginError('');
      setLoading(false);
      
      // Fetch commands after login
      fetchCommands(newToken, true);
    } catch (err) {
      setLoginError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setToken('');
    setPassword('');
    setCommands([]);
    cacheRef.current = null;
    localStorage.removeItem('adminToken');
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Skeleton loader component
  const CommandSkeleton = () => (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className="skeleton-row">
          <td><div className="skeleton skeleton-text" style={{ width: '80px' }}></div></td>
          <td><div className="skeleton skeleton-text" style={{ width: '180px' }}></div></td>
          <td><div className="skeleton skeleton-text" style={{ width: '240px' }}></div></td>
          <td><div className="skeleton skeleton-text" style={{ width: '200px' }}></div></td>
          <td><div className="skeleton skeleton-text" style={{ width: '160px' }}></div></td>
        </tr>
      ))}
    </>
  );

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-box">
          <h1>PulseAPP Admin</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          {loginError && <div className="error-message">{loginError}</div>}
          <p className="login-hint">Enter admin password</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard</h1>
          <button 
            onClick={handleLogout} 
            className="logout-btn"
            title="Log out and return to login"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="commands-section">
          <div className="section-header">
            <h2>Command History</h2>
            <button 
              className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
              onClick={() => fetchCommands(token, true)}
              disabled={loading || refreshing}
              title="Refresh command list"
            >
              {refreshing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="table-wrapper">
              <table className="commands-table">
                <thead>
                  <tr>
                    <th>Command</th>
                    <th>User</th>
                    <th>Details</th>
                    <th>Response</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  <CommandSkeleton />
                </tbody>
              </table>
            </div>
          ) : commands.length === 0 ? (
            <div className="empty-state">
              <p>No commands recorded yet</p>
              <span className="empty-hint">Commands will appear here when slash commands are used in Discord</span>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="commands-table">
                <thead>
                  <tr>
                    <th>Command</th>
                    <th>User</th>
                    <th>Details</th>
                    <th>Response</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {commands.map((cmd, idx) => (
                    <tr key={idx} className="command-row">
                      <td className="command-name">{cmd.command_name}</td>
                      <td className="user-id" title={cmd.user_id}>{cmd.user_id}</td>
                      <td 
                        className="command-text" 
                        title={cmd.command_text || 'No details'}
                      >
                        {cmd.command_text || '—'}
                      </td>
                      <td 
                        className="response-text"
                        title={cmd.response}
                      >
                        {cmd.response}
                      </td>
                      <td className="timestamp">{formatTime(cmd.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
