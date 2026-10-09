import { Monitor, Moon, Sun } from 'lucide-react'
import { useApp } from '../lib/app'
import type { Theme } from '../lib/app'
import { cx } from './ui'

export function ThemeSwitch() {
  const { theme, setTheme } = useApp()
  const items: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  return (
    <div className="flex h-8 items-center rounded-md bg-well p-0.5" role="radiogroup" aria-label="Theme">
      {items.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cx('flex h-7 w-7 items-center justify-center rounded', theme === value ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink')}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
