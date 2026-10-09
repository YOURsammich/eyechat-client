// Which chat links are videos, and how to play them (feedback #62). A link is
// either a video file the browser plays itself in a <video>, or a page on one of
// a few sites whose player we load in an iframe. Anything else — TikTok, X,
// Reddit, live Twitch channels — returns null and stays a plain link.
//
// parseVideoLink(href) → { kind, embedUrl, thumb? } | null
//   kind:     'file' | 'youtube' | 'vimeo' | 'twitch' | 'streamable'
//   embedUrl: the <video> src for a file, the iframe src for the rest
//   thumb:    a poster image, YouTube only (the others need an API call)

const VIDEO_FILE_TYPES = ['mp4', 'webm', 'mov'];
const STREAMABLE_PAGES = ['login', 'signup', 'upload', 'pricing', 'settings', 'documentation', 'terms', 'privacy'];

// The name shown on the click-to-load card and the pop-out window's title bar.
export const VIDEO_SITE_NAMES = {
  file: 'Video',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  streamable: 'Streamable',
};

// A YouTube start time as seconds: t=90, t=90s, t=1m30s, t=1h2m3s. Anything
// unreadable is dropped rather than failing the whole embed.
function parseStartTime (t) {
  if (!t) return 0;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !(m[1] || m[2] || m[3])) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function youtube (id, url) {
  if (!/^[\w-]{11}$/.test(id || '')) return null;
  const start = parseStartTime(url.searchParams.get('t') || url.searchParams.get('start'));
  return {
    kind: 'youtube',
    embedUrl: 'https://www.youtube.com/embed/' + id + (start ? '?start=' + start : ''),
    thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
  };
}

function twitch (slug) {
  if (!/^[\w-]+$/.test(slug || '')) return null;
  // Twitch refuses to play unless the embedding page's hostname is named.
  const parent = (typeof window !== 'undefined' && window.location?.hostname) || 'localhost';
  return {
    kind: 'twitch',
    embedUrl: 'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug) + '&parent=' + encodeURIComponent(parent),
  };
}

export function parseVideoLink (href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  // The extension is read from the path only, so a signed CDN query string
  // (?ex=..&hm=..) after the filename doesn't hide it.
  const ext = url.pathname.split('.').pop().toLowerCase();
  if (url.pathname.includes('.') && VIDEO_FILE_TYPES.includes(ext)) {
    return { kind: 'file', embedUrl: href };
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com') {
    if (parts[0] === 'watch') return youtube(url.searchParams.get('v'), url);
    if (parts[0] === 'shorts') return youtube(parts[1], url);
    return null;
  }
  if (host === 'youtu.be') return youtube(parts[0], url);

  if (host === 'vimeo.com') {
    if (!/^\d+$/.test(parts[0] || '')) return null;
    // An unlisted video's link carries its privacy hash as a second segment.
    const hash = /^[0-9a-f]+$/i.test(parts[1] || '') ? '?h=' + parts[1] : '';
    return { kind: 'vimeo', embedUrl: 'https://player.vimeo.com/video/' + parts[0] + hash };
  }

  if (host === 'clips.twitch.tv') {
    return parts.length === 1 && parts[0] !== 'embed' ? twitch(parts[0]) : null;
  }
  if (host === 'twitch.tv') {
    return parts[1] === 'clip' && parts.length === 3 ? twitch(parts[2]) : null;
  }

  if (host === 'streamable.com') {
    const id = parts[0] === 'e' ? parts[1] : (parts.length === 1 ? parts[0] : null);
    // Its own pages (streamable.com/login) look like ids, so they're named out.
    if (!/^[a-z0-9]+$/i.test(id || '') || STREAMABLE_PAGES.includes(id.toLowerCase())) return null;
    return { kind: 'streamable', embedUrl: 'https://streamable.com/e/' + id };
  }

  return null;
}

// The iframe src once someone has asked to watch: each site spells "start
// playing" its own way. Video files don't need this — <video> has autoPlay.
export function autoplayUrl (video) {
  const flag = video.kind === 'twitch' ? 'autoplay=true' : 'autoplay=1';
  return video.embedUrl + (video.embedUrl.includes('?') ? '&' : '?') + flag;
}
