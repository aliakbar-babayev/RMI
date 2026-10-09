import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getHealth, getRole, setRole } from '../api';
import { S } from '../strings';
import type { Role } from '../types';

const ROLES: Role[] = ['executive', 'analyst', 'auditor'];

export default function Header() {
  const [role, setRoleState] = useState<Role>(getRole());
  const [model, setModel] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getHealth().then((h) => setModel(h.model)).catch(() => {});
  }, []);

  const handleRole = (r: Role) => {
    setRole(r);
    setRoleState(r);
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded text-xs font-medium tracking-wider uppercase transition-all duration-200 ${
      isActive
        ? 'bg-[var(--c-primary-dim)] text-[var(--c-primary)] border border-[var(--c-primary-border)]'
        : 'text-[var(--c-text-secondary)] hover:text-[var(--c-text)] border border-transparent hover:border-[var(--c-border)]'
    }`;

  return (
    <header className="bg-[var(--c-surface)]/80 backdrop-blur-xl border-b border-[var(--c-border)] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--c-primary)] to-[#0090a0] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--c-bg)]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2L3 7v6l7 5 7-5V7l-7-5zM10 4.2L15 7.5v5L10 15.8 5 12.5v-5L10 4.2z"/>
                <path d="M10 7a3 3 0 100 6 3 3 0 000-6z"/>
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-wide text-[var(--c-text)]">{S.appName}</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" className={navClass}>{S.nav.analyze}</NavLink>
            <NavLink to="/dashboard" className={navClass}>{S.nav.dashboard}</NavLink>
            <NavLink to="/actions" className={navClass}>{S.nav.actions}</NavLink>
            <NavLink to="/audit" className={navClass}>{S.nav.audit}</NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {model && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase font-medium text-[var(--c-primary)] bg-[var(--c-primary-dim)] border border-[var(--c-primary-border)] px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-primary)] animate-[pulse-glow_2s_ease-in-out_infinite]" />
              {model}
            </span>
          )}
          <select
            value={role}
            onChange={(e) => handleRole(e.target.value as Role)}
            className="bg-[var(--c-input-bg)] border border-[var(--c-input-border)] text-[var(--c-text)] text-xs tracking-wider uppercase rounded px-2.5 py-1.5 cursor-pointer hover:border-[var(--c-primary-border)] transition-colors"
            aria-label="Select role"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{S.roles[r]}</option>
            ))}
          </select>
          <button
            className="md:hidden p-2 text-[var(--c-text-secondary)] hover:text-[var(--c-primary)] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-[var(--c-border)] px-4 py-3 flex flex-col gap-1 bg-[var(--c-surface)]">
          <NavLink to="/" className={navClass} onClick={() => setMenuOpen(false)}>{S.nav.analyze}</NavLink>
          <NavLink to="/dashboard" className={navClass} onClick={() => setMenuOpen(false)}>{S.nav.dashboard}</NavLink>
          <NavLink to="/actions" className={navClass} onClick={() => setMenuOpen(false)}>{S.nav.actions}</NavLink>
          <NavLink to="/audit" className={navClass} onClick={() => setMenuOpen(false)}>{S.nav.audit}</NavLink>
        </nav>
      )}
    </header>
  );
}
