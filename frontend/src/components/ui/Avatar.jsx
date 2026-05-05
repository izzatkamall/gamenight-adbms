export default function Avatar({ username = '', size = 'md', className = '' }) {
  const initials = username
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  }

  return (
    <div
      className={`${sizes[size]} ${className} rounded-full flex items-center justify-center font-display font-bold text-white flex-shrink-0`}
      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)' }}
    >
      {initials}
    </div>
  )
}
