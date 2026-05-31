import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './Layout.module.css'

export function Layout() {
  const { logout } = useAuth()

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
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
