import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Test Case Generator</div>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          {user?.role === "generator" && <NavLink to="/generate">Generate</NavLink>}
          {user?.role === "admin" && <NavLink to="/generate">Generate</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="user">
          <span className="muted">
            {user?.name} · {user?.role}
          </span>
          <button className="ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
