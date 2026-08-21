import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <i className="bi bi-check2-square" /> Todo List
      </Link>
      <div className="nav-links">
        <NavLink to="/" end>
          My Todos
        </NavLink>
        {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        <span className="nav-user">{user.fullName}</span>
        <button type="button" onClick={handleLogout} className="link-button">
          Log out
        </button>
      </div>
    </nav>
  );
}
