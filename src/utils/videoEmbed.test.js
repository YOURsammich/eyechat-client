import { describe, it, expect } from 'vitest';
import { parseVideoLink, autoplayUrl } from './videoEmbed.js';

const YT = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
const YT_THUMB = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';

describe('parseVideoLink: video files', () => {
  it.each([
    'https://example.com/clip.mp4',
    'https://example.com/clip.webm',
    'https://example.com/clip.MOV',
    // A signed CDN query string after the filename doesn't hide the extension.
    'https://cdn.discordapp.com/attachments/1/2/clip.mp4?ex=abc&hm=def',
  ])('%s is a file', (href) => {
    expect(parseVideoLink(href)).toEqual({ kind: 'file', embedUrl: href });
  });
});

describe('parseVideoLink: YouTube', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=tracking',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
  ])('%s embeds with a thumbnail', (href) => {
    expect(parseVideoLink(href)).toEqual({ kind: 'youtube', embedUrl: YT, thumb: YT_THUMB });
  });

  it.each([
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 42],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s', 90],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s', 90],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s', 3723],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=7', 7],
  ])('%s keeps its start time', (href, start) => {
    expect(parseVideoLink(href).embedUrl).toBe(YT + '?start=' + start);
  });

  it('drops an unreadable start time but still embeds', () => {
    expect(parseVideoLink('https://youtu.be/dQw4w9WgXcQ?t=soon').embedUrl).toBe(YT);
  });
});

describe('parseVideoLink: Vimeo, Twitch clips, Streamable', () => {
  it('Vimeo', () => {
    expect(parseVideoLink('https://vimeo.com/76979871')).toEqual({
      kind: 'vimeo', embedUrl: 'https://player.vimeo.com/video/76979871',
    });
  });

  it('an unlisted Vimeo link keeps its hash', () => {
    expect(parseVideoLink('https://vimeo.com/76979871/abc123ef').embedUrl)
      .toBe('https://player.vimeo.com/video/76979871?h=abc123ef');
  });

  it.each([
    'https://clips.twitch.tv/FunnyClipSlug-abc123',
    'https://www.twitch.tv/somestreamer/clip/FunnyClipSlug-abc123',
    'https://m.twitch.tv/somestreamer/clip/FunnyClipSlug-abc123?filter=clips',
  ])('%s is a Twitch clip naming this page as parent', (href) => {
    expect(parseVideoLink(href)).toEqual({
      kind: 'twitch',
      embedUrl: 'https://clips.twitch.tv/embed?clip=FunnyClipSlug-abc123&parent=' + window.location.hostname,
    });
  });

  it.each(['https://streamable.com/moo12', 'https://streamable.com/e/moo12'])('%s is Streamable', (href) => {
    expect(parseVideoLink(href)).toEqual({ kind: 'streamable', embedUrl: 'https://streamable.com/e/moo12' });
  });
});

describe('parseVideoLink: links that stay plain', () => {
  it.each([
    'https://example.com/',
    'https://example.com/picture.png',
    'https://example.com/mp4',
    'not a url',
    'ftp://example.com/clip.mp4',
    'https://www.youtube.com/',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/@somechannel',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/channels/staffpicks',
    'https://www.twitch.tv/somestreamer',
    'https://www.twitch.tv/videos/123456789',
    'https://clips.twitch.tv/embed',
    'https://streamable.com/',
    'https://streamable.com/login',
    'https://www.tiktok.com/@user/video/7234567890123456789',
    'https://x.com/user/status/123',
    'https://www.reddit.com/r/videos/comments/abc/title/',
  ])('%s', (href) => {
    expect(parseVideoLink(href)).toBeNull();
  });
});

describe('autoplayUrl', () => {
  it('adds each site\'s own autoplay flag', () => {
    expect(autoplayUrl(parseVideoLink('https://youtu.be/dQw4w9WgXcQ'))).toBe(YT + '?autoplay=1');
    expect(autoplayUrl(parseVideoLink('https://youtu.be/dQw4w9WgXcQ?t=5'))).toBe(YT + '?start=5&autoplay=1');
    expect(autoplayUrl(parseVideoLink('https://clips.twitch.tv/Slug'))).toMatch(/&autoplay=true$/);
  });
});
