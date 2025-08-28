// Static placeholder images in WebP format with fallbacks
export const placeholderImages = {
  tennis: '/placeholder-tennis.jpg',
  football: '/placeholder-football.jpg', 
  padel: '/placeholder-padel.jpg',
  basketball: '/placeholder-basketball.jpg',
  swimming: '/placeholder-swimming.jpg',
  volleyball: '/placeholder-volleyball.jpg',
  pingpong: '/placeholder-ping-pong.jpg',
  squash: '/placeholder-squash.jpg',
  foottennis: '/placeholder-foot-tennis.jpg'
} as const;

// WebP versions for modern browsers (will be served when available)
export const webpImages = {
  tennis: '/placeholder-tennis.webp',
  football: '/placeholder-football.webp', 
  padel: '/placeholder-padel.webp',
  basketball: '/placeholder-basketball.webp',
  swimming: '/placeholder-swimming.webp',
  volleyball: '/placeholder-volleyball.webp',
  pingpong: '/placeholder-ping-pong.webp',
  squash: '/placeholder-squash.webp',
  foottennis: '/placeholder-foot-tennis.webp'
} as const;