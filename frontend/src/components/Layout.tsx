import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './Layout.module.css'

export function Layout() {
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Show back button on sub-pages (anything deeper than /collections or /decks)
  const isSubPage =
    location.pathname !== '/home' &&
    location.pathname !== '/collections' &&
    location.pathname !== '/decks' &&
    location.pathname !== '/'

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        {isSubPage ? (
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            &larr;
          </button>
        ) : (
          <span />
        )}
        <h1 className={styles.headerTitle}>トレカAR</h1>
        <button className={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.tabBar}>
        <NavLink
          to="/collections"
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ''}`
          }
        >
          Collections
        </NavLink>
        <NavLink
          to="/decks"
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ''}`
          }
        >
          Decks
        </NavLink>
      </nav>
    </div>
  )
}
