import { cx } from './ui'

/**
 * The RMI wordmark. Two files exist because the "MI" letters are dark navy: the light-theme file is
 * the original logo, the dark-theme file has white letters. `.brand-on-*` in index.css shows the one
 * that matches the current theme; `onDark` forces the dark-background file (e.g. on a dark panel).
 */
export function BrandLogo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  if (onDark) return <img src="/logo-dark.png" alt="RMI" className={className} />
  return (
    <>
      <img src="/logo-light.png" alt="RMI" className={cx('brand-on-light', className)} />
      <img src="/logo-dark.png" alt="" aria-hidden="true" className={cx('brand-on-dark', className)} />
    </>
  )
}
