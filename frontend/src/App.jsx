import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  TrendingDown, TrendingUp, AlertCircle, CheckCircle, ShieldAlert, Clock, 
  Plus, Trash2, Edit3, LogOut, LayoutDashboard, Kanban, ClipboardList, 
  BookOpen, Send, Users, Award, FileText, ChevronRight, ChevronLeft
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE !== undefined ? import.meta.env.VITE_API_BASE : 'http://127.0.0.1:8000';

function App() {
  // Authentication state
  const [token, setToken] = useState(localStorage.getItem('access_token') || '');
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token') || '');
  const [user, setUser] = useState(null);

  // App navigation
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Business state
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Form states for Sprints & Tasks
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  
  // Comments
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Auth Form Input states
  const [authInputs, setAuthInputs] = useState({
    username: '', password: '', email: '', role: 'member', team_name: ''
  });

  // Sprint Form Input states
  const [sprintInputs, setSprintInputs] = useState({
    name: '', start_date: '', end_date: '', goal: '', status: 'Planned'
  });

  // Task Form Input states
  const [taskInputs, setTaskInputs] = useState({
    title: '', description: '', assignee: '', status: 'todo', story_points: '', due_date: ''
  });
  
  // Team members list (for task assignment)
  const [teamMembers, setTeamMembers] = useState([]);

  // Setup headers
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Load profile when token changes
  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setUser(null);
      setSprints([]);
      setTasks([]);
      setAnalytics(null);
    }
  }, [token]);

  // Load sprints when user profile is loaded
  useEffect(() => {
    if (user && user.profile && user.profile.team) {
      fetchSprints();
      fetchTeamMembers();
    }
  }, [user]);

  // Load tasks and analytics when selected sprint changes
  useEffect(() => {
    if (selectedSprintId) {
      fetchTasks(selectedSprintId);
      fetchAnalytics(selectedSprintId);
    } else {
      setTasks([]);
      setAnalytics(null);
    }
  }, [selectedSprintId]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile/`, {
        headers: getHeaders()
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error("Failed to load user profile");
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile/`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        // Since we don't have a team members endpoint, we can use the backend standard setup,
        // or just allow typing assignee username. For simplicity during local dev, 
        // we'll fetch the profile, and fallback to typing username or a simple list.
        // Let's assume we can fetch members of user's team or simple register mock users.
        // For a beautiful select dropdown, let's fetch profiles of standard seeded users.
        // We'll just define the seeded options for easy local demo:
        setTeamMembers([
          { id: 2, username: 'alice', full_name: 'Alice Smith' },
          { id: 3, username: 'bob', full_name: 'Bob Jones' },
          { id: 4, username: 'charlie', full_name: 'Charlie Brown' }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSprints = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sprints/`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("Failed to load sprints");
      const data = await res.json();
      setSprints(data);
      if (data.length > 0) {
        // Automatically select first active sprint, or fallback to first one
        const active = data.find(s => s.status === 'Active');
        setSelectedSprintId(active ? active.id : data[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (sprintId) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/?sprint=${sprintId}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAnalytics = async (sprintId) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sprints/${sprintId}/analytics/`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("Failed to load sprint analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Auth operations
  const handleGoogleSuccess = async (idToken) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: idToken,
          role: authInputs.role || 'member',
          team_name: authInputs.team_name || ''
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed');
      }
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      setToken(data.access);
      setRefreshToken(data.refresh);
      setUser(data.user);
    } catch (err) {
      setError(err.message || 'Unable to authenticate via Google SSID');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token && window.google?.accounts?.id) {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1234567890-example.apps.googleusercontent.com';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              handleGoogleSuccess(response.credential);
            }
          }
        });
        const btnWrapper = document.getElementById('googleSignInWrapper');
        if (btnWrapper) {
          window.google.accounts.id.renderButton(btnWrapper, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            width: 320
          });
        }
      } catch (err) {
        console.warn('Google Identity Services setup warning:', err);
      }
    }
  }, [token, authMode]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (authMode === 'login') {
        const res = await fetch(`${API_BASE}/api/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authInputs.username,
            password: authInputs.password
          })
        });
        if (!res.ok) throw new Error("Invalid username or password");
        const data = await res.json();
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        setToken(data.access);
        setRefreshToken(data.refresh);
      } else {
        const res = await fetch(`${API_BASE}/api/auth/register/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authInputs.username,
            password: authInputs.password,
            email: authInputs.email,
            role: authInputs.role,
            team_name: authInputs.team_name
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.username || errData.detail || "Registration failed");
        }
        const data = await res.json();
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        setToken(data.access);
        setRefreshToken(data.refresh);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken('');
    setRefreshToken('');
    setUser(null);
  };

  // Sprint CRUD
  const handleSprintSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const url = editingSprint 
        ? `${API_BASE}/api/sprints/${editingSprint.id}/` 
        : `${API_BASE}/api/sprints/`;
      const method = editingSprint ? 'PUT' : 'POST';
      const body = {
        name: sprintInputs.name,
        start_date: sprintInputs.start_date,
        end_date: sprintInputs.end_date,
        goal: sprintInputs.goal,
        status: sprintInputs.status
      };

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || errData.non_field_errors || "Error saving sprint");
      }

      const data = await res.json();
      if (editingSprint) {
        setSprints(sprints.map(s => s.id === data.id ? data : s));
      } else {
        setSprints([...sprints, data]);
        setSelectedSprintId(data.id);
      }
      setShowSprintModal(false);
      setEditingSprint(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSprint = async (sprintId) => {
    if (!window.confirm("Are you sure you want to delete this sprint? All tasks will be deleted.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/sprints/${sprintId}/`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete sprint");
      setSprints(sprints.filter(s => s.id !== sprintId));
      if (selectedSprintId === sprintId) {
        setSelectedSprintId(sprints.length > 1 ? sprints[0].id : '');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Task CRUD
  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingTask 
        ? `${API_BASE}/api/tasks/${editingTask.id}/` 
        : `${API_BASE}/api/tasks/`;
      const method = editingTask ? 'PUT' : 'POST';
      
      const body = {
        sprint: selectedSprintId,
        title: taskInputs.title,
        description: taskInputs.description,
        assignee: taskInputs.assignee ? parseInt(taskInputs.assignee) : null,
        status: taskInputs.status,
        story_points: taskInputs.story_points ? parseInt(taskInputs.story_points) : null,
        due_date: taskInputs.due_date || null
      };

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("Error saving task");
      const data = await res.json();
      
      if (editingTask) {
        setTasks(tasks.map(t => t.id === data.id ? data : t));
      } else {
        setTasks([...tasks, data]);
      }
      
      setShowTaskModal(false);
      setEditingTask(null);
      // Refresh analytics
      fetchAnalytics(selectedSprintId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks(tasks.filter(t => t.id !== taskId));
      fetchAnalytics(selectedSprintId);
    } catch (err) {
      alert(err.message);
    }
  };

  // Simple task status updating for Kanban Board
  const updateTaskStatus = async (task, newStatus) => {
    try {
      // Members can only update status if assigned to them
      if (user?.profile?.role === 'member' && task.assignee !== user.id) {
        alert("You can only update tasks assigned to you.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/tasks/${task.id}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      setTasks(tasks.map(t => t.id === data.id ? data : t));
      fetchAnalytics(selectedSprintId);
      if (activeTask && activeTask.id === task.id) {
        setActiveTask(data);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Comments handlers
  const openTaskDetail = (task) => {
    setActiveTask(task);
    setComments(task.comments || []);
    setShowTaskDetailModal(true);
    fetchComments(task.id);
  };

  const fetchComments = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/api/comments/?task=${taskId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/comments/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          task: activeTask.id,
          content: newComment.trim()
        })
      });
      if (!res.ok) throw new Error("Failed to post comment");
      const data = await res.json();
      setComments([...comments, data]);
      setNewComment('');
      // update comments in primary list
      setTasks(tasks.map(t => {
        if (t.id === activeTask.id) {
          return { ...t, comments: [...(t.comments || []), data] };
        }
        return t;
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  // Open creation modals
  const openCreateSprint = () => {
    setEditingSprint(null);
    setSprintInputs({
      name: '', start_date: '', end_date: '', goal: '', status: 'Planned'
    });
    setShowSprintModal(true);
  };

  const openEditSprint = (sprint) => {
    setEditingSprint(sprint);
    setSprintInputs({
      name: sprint.name,
      start_date: sprint.start_date,
      end_date: sprint.end_date,
      goal: sprint.goal || '',
      status: sprint.status
    });
    setShowSprintModal(true);
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskInputs({
      title: '', description: '', assignee: '', status: 'todo', story_points: '', due_date: ''
    });
    setShowTaskModal(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskInputs({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee || '',
      status: task.status,
      story_points: task.story_points || '',
      due_date: task.due_date || ''
    });
    setShowTaskModal(true);
  };

  // Helper checking if task is overdue
  const isOverdue = (dueDate, taskStatus) => {
    if (!dueDate || taskStatus === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
        <div className="auth-card glass">
          <div className="auth-header">
            <TrendingUp size={44} className="logo-icon" />
            <h1 className="auth-title">SprintPulse</h1>
            <p className="auth-subtitle">Insights & Analytics Driven Sprint Engine</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={authInputs.username}
                onChange={e => setAuthInputs({...authInputs, username: e.target.value})}
              />
            </div>

            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={authInputs.email}
                  onChange={e => setAuthInputs({...authInputs, email: e.target.value})}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                required 
                value={authInputs.password}
                onChange={e => setAuthInputs({...authInputs, password: e.target.value})}
              />
            </div>

            {authMode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select 
                    className="select-input"
                    value={authInputs.role}
                    onChange={e => setAuthInputs({...authInputs, role: e.target.value})}
                  >
                    <option value="member">Team Member</option>
                    <option value="manager">Project Manager</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Team Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Phoenix Team"
                    className="form-input" 
                    required 
                    value={authInputs.team_name}
                    onChange={e => setAuthInputs({...authInputs, team_name: e.target.value})}
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn-primary auth-btn" disabled={loading}>
              {loading ? <div className="spinner" /> : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="auth-toggle">
            {authMode === 'login' ? (
              <>
                Don't have an account? <span className="auth-link" onClick={() => setAuthMode('register')}>Sign Up</span>
              </>
            ) : (
              <>
                Already have an account? <span className="auth-link" onClick={() => setAuthMode('login')}>Sign In</span>
              </>
            )}
          </div>

          <div className="auth-divider">
            <span>OR CONTINUE WITH GOOGLE</span>
          </div>

          <div className="google-auth-section">
            <div id="googleSignInWrapper" className="google-btn-wrapper"></div>
            
            <button 
              type="button" 
              className="google-sso-btn"
              onClick={() => handleGoogleSuccess("mock-google-token")}
              disabled={loading}
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google SSID</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  const isManager = user?.profile?.role === 'manager';

  return (
    <div className="app-container">
      <div className="bg-glow-1"></div>
      <div className="bg-glow-2"></div>
      
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="logo-container" 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          type="button"
        >
          <TrendingUp size={28} className="logo-icon" />
          <span className="logo-text">SprintPulse</span>
        </button>

        <nav>
          <ul className="nav-links">
            <li 
              className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span className="nav-text">Sprint Dashboard</span>
            </li>
            <li 
              className={`nav-item ${currentTab === 'board' ? 'active' : ''}`}
              onClick={() => setCurrentTab('board')}
            >
              <Kanban size={18} />
              <span className="nav-text">Kanban Board</span>
            </li>
            <li 
              className={`nav-item ${currentTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setCurrentTab('tasks')}
            >
              <ClipboardList size={18} />
              <span className="nav-text">Tasks List</span>
            </li>
          </ul>
        </nav>

        <a 
          href={`${API_BASE}/api/docs/`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="nav-item" 
          style={{ marginTop: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          <BookOpen size={18} />
          <span className="nav-text">Interactive API Docs</span>
        </a>

        {user ? (
          <div className="user-profile-badge">
            <div className="user-avatar">
              {user.username.substring(0, 2)}
            </div>
            <div className="user-info">
              <span className="user-name">{user.first_name ? `${user.first_name} ${user.last_name}` : user.username}</span>
              <span className="user-role-team">{user.profile.role} | {user.profile.team_name}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          token && (
            <div className="user-profile-badge">
              <div className="user-info">
                <span className="user-name" style={{ color: 'var(--text-secondary)' }}>Offline Mode</span>
                <span className="user-role-team" style={{ color: 'var(--danger)' }}>Backend Unreachable</span>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Reset Session" style={{ color: 'var(--danger)', marginLeft: 'auto' }}>
                <LogOut size={16} />
              </button>
            </div>
          )
        )}
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        <div className="header-row">
          <div>
            <h2 className="page-title">
              {currentTab === 'dashboard' && 'Sprint Insights'}
              {currentTab === 'board' && 'Kanban Board'}
              {currentTab === 'tasks' && 'All Sprint Tasks'}
            </h2>
            <p className="page-subtitle">
              {currentTab === 'dashboard' && 'Rule-based analytics, workload, and velocity reports'}
              {currentTab === 'board' && 'Manage workflows and task progression'}
              {currentTab === 'tasks' && 'Granular task list with filters and comment logs'}
            </p>
          </div>

          <div className="controls-container">
            {sprints.length > 0 ? (
              <select 
                className="select-input"
                value={selectedSprintId}
                onChange={e => setSelectedSprintId(e.target.value)}
              >
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No sprints created yet</span>
            )}

            {isManager && (
              <button className="btn-secondary" onClick={openCreateSprint}>
                <Plus size={16} /> New Sprint
              </button>
            )}

            {isManager && sprints.length > 0 && (
              <button className="btn-primary" onClick={openCreateTask}>
                <Plus size={16} /> Create Task
              </button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="error-message" style={{ width: '100%' }}>
            {error}
            <button style={{ background: 'none', border: 'none', marginLeft: '20px', color: '#fff', cursor: 'pointer' }} onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <p>Loading Sprint Data...</p>
          </div>
        ) : (
          <>
            {sprints.length === 0 ? (
              <div className="empty-state glass">
                <h3>Welcome to SprintPulse!</h3>
                <p style={{ marginTop: '8px' }}>
                  {isManager 
                    ? "Get started by creating a sprint using the 'New Sprint' button in the top right."
                    : "No sprints have been created for your team yet. Please contact your manager to get started."}
                </p>
              </div>
            ) : (
              <>
                {/* TAB 1: DASHBOARD */}
                {currentTab === 'dashboard' && (
                  <div className="analytics-grid">
                    
                    {/* Metrics Banner cards */}
                    {analytics && (
                      <div className="metrics-summary-row">
                        <div className="metric-card glass">
                          <div className="metric-header">
                            <span>Committed points</span>
                            <Award size={16} />
                          </div>
                          <span className="metric-value">{analytics.burndown.committed_points} pts</span>
                          <div className="metric-trend trend-neutral">
                            <span>At sprint start</span>
                          </div>
                        </div>

                        <div className="metric-card glass">
                          <div className="metric-header">
                            <span>Velocity prediction</span>
                            <TrendingUp size={16} />
                          </div>
                          <span className="metric-value">{analytics.velocity.average_velocity_last_3} pts</span>
                          <div className="metric-trend trend-neutral">
                            <span>Avg of last 3 sprints</span>
                          </div>
                        </div>

                        <div className="metric-card glass">
                          <div className="metric-header">
                            <span>Scope Creep</span>
                            <Clock size={16} />
                          </div>
                          <span className="metric-value">{analytics.scope_creep.percentage}%</span>
                          <div className="metric-trend trend-down">
                            <span>{analytics.scope_creep.count} tasks added mid-sprint</span>
                          </div>
                        </div>

                        <div className="metric-card glass">
                          <div className="metric-header">
                            <span>Active Bottlenecks</span>
                            <ShieldAlert size={16} />
                          </div>
                          <span className="metric-value" style={{ color: analytics.bottlenecks.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {analytics.bottlenecks.length}
                          </span>
                          <div className="metric-trend trend-neutral">
                            <span>Tasks stuck &gt; 3 days</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Left: Burndown line chart */}
                    {analytics && (
                      <div className="chart-panel glass">
                        <div className="chart-title-row">
                          <span className="chart-title">Burndown Chart</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remaining points over time</span>
                        </div>
                        <div className="chart-container">
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={analytics.burndown.series} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', color: '#fff' }} />
                              <Legend />
                              <Line type="monotone" dataKey="ideal" name="Ideal Burndown" stroke="var(--primary)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                              <Line type="monotone" dataKey="actual" name="Actual Remaining" stroke="var(--success)" strokeWidth={3} connectNulls />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Right: Recommendations cards list */}
                    {analytics && (
                      <div className="recommendations-panel glass">
                        <div className="rec-title-row">
                          <AlertCircle size={18} className="rec-icon info" />
                          <span className="rec-title">Health Recommendations</span>
                        </div>
                        <div className="rec-list">
                          {analytics.recommendations.map((rec, idx) => {
                            let type = 'info';
                            if (rec.includes('behind') || rec.includes('stuck') || rec.includes('overloaded')) {
                              type = 'danger';
                            } else if (rec.includes('scope creep') || rec.includes('added after') || rec.includes('ends in')) {
                              type = 'warning';
                            } else if (rec.includes('healthy')) {
                              type = 'success';
                            }
                            return (
                              <div key={idx} className={`rec-card ${type}`}>
                                <div className="rec-text">{rec}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Row 3: Workload & Velocity Bar charts */}
                    {analytics && (
                      <div className="metrics-summary-row" style={{ gridColumn: 'span 3', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginTop: '12px' }}>
                        
                        {/* Workload distribution */}
                        <div className="workload-panel glass">
                          <div className="chart-title-row">
                            <span className="chart-title">Workload Distribution (Points)</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Team avg: {analytics.workload.team_average} pts</span>
                          </div>
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={analytics.workload.workload} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="username" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', color: '#fff' }} />
                                <Bar dataKey="story_points" name="Story Points">
                                  {analytics.workload.workload.map((entry, index) => {
                                    let color = '#3b82f6'; // neutral blue
                                    if (entry.status === 'overloaded') color = 'var(--danger)';
                                    if (entry.status === 'underloaded') color = 'var(--success)';
                                    if (entry.status === 'unassigned') color = 'var(--text-muted)';
                                    return <Cell key={`cell-${index}`} fill={color} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Velocity sprints history */}
                        <div className="velocity-panel glass">
                          <div className="chart-title-row">
                            <span className="chart-title">Velocity History</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Last 3 sprints avg: {analytics.velocity.average_velocity_last_3} pts</span>
                          </div>
                          {analytics.velocity.history.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              Establish velocity by completing sprints!
                            </div>
                          ) : (
                            <div className="chart-container">
                              <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={analytics.velocity.history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                  <XAxis dataKey="sprint_name" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                  <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', color: '#fff' }} />
                                  <Bar dataKey="completed_points" name="Completed Points" fill="#818cf8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                  </div>
                )}

                {/* TAB 2: KANBAN BOARD */}
                {currentTab === 'board' && (
                  <div className="kanban-board">
                    {/* Column 1: To Do */}
                    <div className="kanban-column">
                      <div className="column-header">
                        <div className="column-title-row">
                          <div className="column-indicator todo"></div>
                          <span className="column-title">To Do</span>
                        </div>
                        <span className="column-count">{tasks.filter(t => t.status === 'todo').length}</span>
                      </div>
                      <div className="column-list">
                        {tasks.filter(t => t.status === 'todo').map(task => (
                          <div key={task.id} className="task-card glass" onClick={() => openTaskDetail(task)}>
                            <div className="task-header">
                              <span className="task-title">{task.title}</span>
                              {task.story_points && <span className="task-points-badge">{task.story_points} SP</span>}
                            </div>
                            {task.description && <p className="task-desc">{task.description}</p>}
                            <div className="task-footer">
                              <span className="task-assignee">
                                <div className="task-avatar-mini">{task.assignee_name ? task.assignee_name.substring(0, 2) : '?'}</div>
                                {task.assignee_name || 'Unassigned'}
                              </span>
                              {task.due_date && (
                                <span className={`task-due-date ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`}>
                                  {task.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Column 2: In Progress */}
                    <div className="kanban-column">
                      <div className="column-header">
                        <div className="column-title-row">
                          <div className="column-indicator in_progress"></div>
                          <span className="column-title">In Progress</span>
                        </div>
                        <span className="column-count">{tasks.filter(t => t.status === 'in_progress').length}</span>
                      </div>
                      <div className="column-list">
                        {tasks.filter(t => t.status === 'in_progress').map(task => (
                          <div key={task.id} className="task-card glass" onClick={() => openTaskDetail(task)}>
                            <div className="task-header">
                              <span className="task-title">{task.title}</span>
                              {task.story_points && <span className="task-points-badge">{task.story_points} SP</span>}
                            </div>
                            {task.description && <p className="task-desc">{task.description}</p>}
                            <div className="task-footer">
                              <span className="task-assignee">
                                <div className="task-avatar-mini">{task.assignee_name ? task.assignee_name.substring(0, 2) : '?'}</div>
                                {task.assignee_name || 'Unassigned'}
                              </span>
                              {task.due_date && (
                                <span className={`task-due-date ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`}>
                                  {task.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Column 3: Done */}
                    <div className="kanban-column">
                      <div className="column-header">
                        <div className="column-title-row">
                          <div className="column-indicator done"></div>
                          <span className="column-title">Done</span>
                        </div>
                        <span className="column-count">{tasks.filter(t => t.status === 'done').length}</span>
                      </div>
                      <div className="column-list">
                        {tasks.filter(t => t.status === 'done').map(task => (
                          <div key={task.id} className="task-card glass" onClick={() => openTaskDetail(task)}>
                            <div className="task-header">
                              <span className="task-title" style={{ textDecoration: 'line-through', opacity: 0.6 }}>{task.title}</span>
                              {task.story_points && <span className="task-points-badge" style={{ opacity: 0.6 }}>{task.story_points} SP</span>}
                            </div>
                            {task.description && <p className="task-desc" style={{ opacity: 0.5 }}>{task.description}</p>}
                            <div className="task-footer" style={{ opacity: 0.6 }}>
                              <span className="task-assignee">
                                <div className="task-avatar-mini">{task.assignee_name ? task.assignee_name.substring(0, 2) : '?'}</div>
                                {task.assignee_name || 'Unassigned'}
                              </span>
                              {task.due_date && (
                                <span className="task-due-date">
                                  {task.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: TASKS LIST */}
                {currentTab === 'tasks' && (() => {
                  const filteredTasks = tasks.filter(t => !isManager ? t.assignee === user?.id : true);
                  return (
                    <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px', overflowX: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '16px' }}>
                          {isManager ? 'All Team Tasks' : 'My Assigned Tasks'}
                        </span>
                      </div>
                      {filteredTasks.length === 0 ? (
                        <div className="empty-state">
                          {isManager 
                            ? "No tasks created in this sprint yet." 
                            : "No tasks are currently assigned to you in this sprint."}
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Task Name</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Assignee</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>Story Points</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Due Date</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.map(task => (
                              <tr key={task.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', transition: 'background 0.2s' }} className="task-row">
                                <td style={{ padding: '16px', fontWeight: '500', cursor: 'pointer' }} onClick={() => openTaskDetail(task)}>
                                  {task.title}
                                </td>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                  {task.assignee_name || 'Unassigned'}
                                </td>
                                <td style={{ padding: '16px' }}>
                                  <span className={`status-badge ${task.status}`}>
                                    {task.status === 'in_progress' ? 'In Progress' : task.status === 'todo' ? 'To Do' : 'Done'}
                                  </span>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>
                                  {task.story_points || '-'}
                                </td>
                                <td style={{ padding: '16px', color: isOverdue(task.due_date, task.status) ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: isOverdue(task.due_date, task.status) ? '600' : 'normal' }}>
                                  {task.due_date || '-'}
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => openTaskDetail(task)}>
                                      Details
                                    </button>
                                    {isManager && (
                                      <>
                                        <button className="btn-secondary" style={{ padding: '6px', minWidth: '32px' }} onClick={() => openEditTask(task)}>
                                          <Edit3 size={14} />
                                        </button>
                                        <button className="btn-secondary" style={{ padding: '6px', minWidth: '32px', color: 'var(--danger)' }} onClick={() => handleDeleteTask(task.id)}>
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </>
        )}
      </main>

      {/* SPRINT CREATION / EDITING MODAL */}
      {showSprintModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <button className="modal-close" onClick={() => setShowSprintModal(false)}>✕</button>
            <h3 className="modal-title">{editingSprint ? 'Edit Sprint' : 'Create Sprint'}</h3>
            <form onSubmit={handleSprintSubmit}>
              <div className="form-group">
                <label className="form-label">Sprint Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={sprintInputs.name}
                  onChange={e => setSprintInputs({...sprintInputs, name: e.target.value})}
                />
              </div>

              <div className="task-detail-row">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    value={sprintInputs.start_date}
                    onChange={e => setSprintInputs({...sprintInputs, start_date: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    value={sprintInputs.end_date}
                    onChange={e => setSprintInputs({...sprintInputs, end_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select 
                  className="select-input"
                  value={sprintInputs.status}
                  onChange={e => setSprintInputs({...sprintInputs, status: e.target.value})}
                >
                  <option value="Planned">Planned</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Goal / Objective</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={sprintInputs.goal}
                  onChange={e => setSprintInputs({...sprintInputs, goal: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSprintModal(false)}>Cancel</button>
                {editingSprint && (
                  <button type="button" className="btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => { setShowSprintModal(false); handleDeleteSprint(editingSprint.id); }}>Delete</button>
                )}
                <button type="submit" className="btn-primary">Save Sprint</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK CREATION / EDITING MODAL */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <button className="modal-close" onClick={() => setShowTaskModal(false)}>✕</button>
            <h3 className="modal-title">{editingTask ? 'Edit Task' : 'Create Task'}</h3>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={taskInputs.title}
                  onChange={e => setTaskInputs({...taskInputs, title: e.target.value})}
                />
              </div>

              <div className="task-detail-row">
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <select 
                    className="select-input"
                    value={taskInputs.assignee}
                    onChange={e => setTaskInputs({...taskInputs, assignee: e.target.value})}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.username})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Story Points</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 5"
                    value={taskInputs.story_points}
                    onChange={e => setTaskInputs({...taskInputs, story_points: e.target.value})}
                  />
                </div>
              </div>

              <div className="task-detail-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select 
                    className="select-input"
                    value={taskInputs.status}
                    onChange={e => setTaskInputs({...taskInputs, status: e.target.value})}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={taskInputs.due_date}
                    onChange={e => setTaskInputs({...taskInputs, due_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={taskInputs.description}
                  onChange={e => setTaskInputs({...taskInputs, description: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAILED PREVIEW & COMMENTS MODAL */}
      {showTaskDetailModal && activeTask && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ width: '600px' }}>
            <button className="modal-close" onClick={() => setShowTaskDetailModal(false)}>✕</button>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
              <span>{activeTask.title}</span>
              {activeTask.story_points && <span className="task-points-badge">{activeTask.story_points} SP</span>}
            </h3>

            <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
              <span className={`status-badge ${activeTask.status}`}>
                {activeTask.status === 'in_progress' ? 'In Progress' : activeTask.status === 'todo' ? 'To Do' : 'Done'}
              </span>
              {activeTask.due_date && (
                <span className={`status-badge ${isOverdue(activeTask.due_date, activeTask.status) ? 'overdue' : 'todo'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Due: {activeTask.due_date}
                </span>
              )}
            </div>

            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '700' }}>Description</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.01)', padding: '12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
                {activeTask.description || <span style={{ color: 'var(--text-muted)' }}>No description provided for this task.</span>}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
              <div>
                <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Assignee</span>
                <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <div className="task-avatar-mini" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                    {activeTask.assignee_name ? activeTask.assignee_name.substring(0, 2) : '?'}
                  </div>
                  {activeTask.assignee_name || 'Unassigned'}
                </span>
              </div>

              <div>
                <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Update Status</span>
                {/* 
                  Check permissions:
                  - Managers can update status anytime.
                  - Members can ONLY update status if the task is assigned to them.
                */}
                {isManager || (user?.id === activeTask.assignee) ? (
                  <select 
                    className="select-input" 
                    style={{ width: '100%', padding: '8px 12px' }}
                    value={activeTask.status} 
                    onChange={e => updateTaskStatus(activeTask, e.target.value)}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--danger)' }}>
                    Only {activeTask.assignee_name || 'the assignee'} can update this status.
                  </span>
                )}
              </div>
            </div>

            {/* Task comments */}
            <div className="modal-comments">
              <h4 className="comments-title">Discussion ({comments.length})</h4>
              
              <div className="comments-list">
                {comments.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No comments posted. Start the conversation!</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="comment-bubble">
                      <div className="comment-meta">
                        <span className="comment-author">@{c.author_username}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="comment-body">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handlePostComment} className="comment-form">
                <input 
                  type="text" 
                  placeholder="Ask a question or post progress..." 
                  className="form-input comment-input"
                  required
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                />
                <button type="submit" className="btn-primary" style={{ padding: '10px 16px' }}>
                  <Send size={14} />
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowTaskDetailModal(false)}>Close</button>
              {isManager && (
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => { setShowTaskDetailModal(false); openEditTask(activeTask); }}
                >
                  Edit Task Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
