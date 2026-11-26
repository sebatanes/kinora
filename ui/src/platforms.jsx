import { Instagram, Youtube, Facebook, Whatsapp, Snapchat, Twitch, Dribbble, VideoPlay, Gallery, Monitor, Global } from 'iconsax-reactjs';

const svg = (d, vb = '0 0 24 24') => ({ size = 20 }) => (
  <svg width={size} height={size} viewBox={vb} fill="currentColor" aria-hidden="true"><path d={d} /></svg>
);

export const XLogo = svg('M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z');
export const TikTok = svg('M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v3.1c-1.4.1-2.6-.3-3.9-1.1v5.6c0 7.1-7.7 9.3-10.8 4.2-2-3.3-.8-9 5.6-9.3v3.2c-.5.1-1 .2-1.5.4-1.4.5-2.2 1.3-2 2.8.4 3 5.8 3.9 5.4-1.9V3h3.3Z');
export const LinkedIn = svg('M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm7 0h3.8v1.5h.05c.53-1 1.84-2.05 3.8-2.05 4.06 0 4.35 2.67 4.35 6.15v5.4h-4v-4.8c0-1.15-.02-2.62-1.6-2.62-1.6 0-1.85 1.25-1.85 2.54v4.88H10v-11Z');
export const Pinterest = svg('M12 2a10 10 0 0 0-3.64 19.31c-.09-.79-.17-2 .03-2.86l1.19-5.05s-.3-.61-.3-1.5c0-1.4.81-2.45 1.83-2.45.86 0 1.28.65 1.28 1.43 0 .87-.56 2.17-.84 3.37-.24 1.01.5 1.83 1.5 1.83 1.8 0 3.18-1.9 3.18-4.63 0-2.42-1.74-4.11-4.22-4.11-2.87 0-4.56 2.16-4.56 4.39 0 .87.34 1.8.75 2.31.08.1.09.19.07.29l-.28 1.14c-.04.18-.15.22-.34.13-1.26-.59-2.05-2.43-2.05-3.91 0-3.18 2.31-6.1 6.66-6.1 3.5 0 6.21 2.49 6.21 5.82 0 3.47-2.19 6.27-5.23 6.27-1.02 0-1.98-.53-2.31-1.16l-.63 2.4c-.23.87-.84 1.97-1.25 2.63A10 10 0 1 0 12 2Z');
export const Threads = svg('M16.3 11.2c-.1 0-.2-.1-.3-.1-.2-3.2-1.9-5-4.8-5h-.1c-1.7 0-3.2.7-4.1 2.1l1.6 1.1c.7-1 1.7-1.2 2.5-1.2h.1c1 0 1.8.3 2.2.9.3.4.6 1.1.7 1.8-.8-.1-1.7-.2-2.6-.1-2.6.2-4.3 1.7-4.2 3.9.1 1.1.6 2.1 1.6 2.7.8.5 1.9.8 3 .7 1.4-.1 2.6-.6 3.4-1.6.6-.8 1-1.8 1.2-3 .7.4 1.2 1 1.5 1.6.5 1.2.5 3.1-1 4.6-1.3 1.3-3 1.9-5.4 1.9-2.7 0-4.8-.9-6.1-2.6C4.3 17.3 3.6 15 3.6 12s.7-5.3 2-6.9c1.3-1.7 3.4-2.6 6.1-2.6 2.8 0 4.9.9 6.3 2.6.7.8 1.2 1.9 1.5 3.1l1.9-.5c-.4-1.5-1-2.8-1.9-3.9C17.7 1.6 15.1.5 11.7.5 8.4.5 5.8 1.6 4 3.8 2.4 5.7 1.6 8.5 1.6 12s.8 6.3 2.4 8.2c1.8 2.2 4.4 3.3 7.7 3.3 3 0 5-.8 6.8-2.5 2.2-2.2 2.2-5 1.4-6.8-.5-1.3-1.7-2.4-3.6-3Zm-4.4 4.6c-1.2.1-2.4-.5-2.5-1.5 0-.8.6-1.7 2.4-1.8h.6c.7 0 1.3.1 1.8.2-.2 2.5-1.3 3-2.3 3.1Z');
export const Discord = svg('M20.3 4.4A19.7 19.7 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.5 0L8.7 3a19.6 19.6 0 0 0-4.9 1.5C.7 9.1-.2 13.6.3 18a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14.1 14.1 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.6-3.7-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.4 8 10.4s2.2 1.1 2.2 2.5-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.5 2.2-2.5 2.2 1.1 2.2 2.5-1 2.4-2.2 2.4Z');
export const Vimeo = svg('M22 7.4c-.1 2-1.5 4.7-4.1 8-2.7 3.5-5 5.3-6.8 5.3-1.2 0-2.2-1.1-3-3.2l-1.6-6C5.9 9.4 5.3 8.3 4.7 8.3c-.1 0-.6.3-1.4.9L2.5 8.1l2.6-2.3c1.2-1 2-1.5 2.6-1.6 1.4-.1 2.3.8 2.6 2.9.4 2.2.6 3.6.7 4.1.4 1.8.9 2.7 1.4 2.7.4 0 1-.6 1.8-1.9.8-1.3 1.2-2.2 1.3-2.9.1-1.1-.3-1.6-1.3-1.6-.5 0-.9.1-1.4.3.9-3 2.7-4.5 5.3-4.4 1.9.1 2.8 1.3 2.7 3.8Z');

const brand = { Instagram, Youtube, Facebook, Whatsapp, Snapchat, Twitch, Dribbble };
export const PlatformIcon = ({ id, size = 20 }) => {
  const I = { x: XLogo, tiktok: TikTok, linkedin: LinkedIn, pinterest: Pinterest, threads: Threads, discord: Discord, vimeo: Vimeo }[id];
  if (I) return <I size={size} />;
  const B = { instagram: brand.Instagram, youtube: brand.Youtube, facebook: brand.Facebook, whatsapp: brand.Whatsapp, snapchat: brand.Snapchat, twitch: brand.Twitch, dribbble: brand.Dribbble, gif: Gallery, web: Global, resolucion: Monitor, original: VideoPlay }[id] || VideoPlay;
  return <B size={size} variant="Linear" />;
};

// Recommended upload specs per platform, as published by each platform in 2026.
const v = (ancho, alto, extra = {}) => ({ formato: 'mp4', calidad: 'alta', ancho, alto, ajuste: 'encajar', ...extra });
export const DESTINOS = [
  { grupo: 'Original', icon: 'original', items: [
    { id: 'original', nombre: 'Original', detalle: 'Project size and quality', o: { formato: 'mp4', calidad: 'alta' } },
  ] },
  { grupo: 'YouTube', icon: 'youtube', items: [
    { id: 'yt-1080', nombre: 'YouTube 1080p', detalle: '1920×1080 · 16:9', o: v(1920, 1080) },
    { id: 'yt-4k', nombre: 'YouTube 4K', detalle: '3840×2160 · 16:9', o: v(3840, 2160) },
    { id: 'yt-shorts', nombre: 'YouTube Shorts', detalle: '1080×1920 · 9:16 · up to 3 min', o: v(1080, 1920), maxSeg: 180 },
  ] },
  { grupo: 'Instagram', icon: 'instagram', items: [
    { id: 'ig-reels', nombre: 'Instagram Reels', detalle: '1080×1920 · 9:16', o: v(1080, 1920) },
    { id: 'ig-feed', nombre: 'Instagram Feed', detalle: '1080×1350 · 4:5', o: v(1080, 1350) },
    { id: 'ig-square', nombre: 'Instagram Square', detalle: '1080×1080 · 1:1', o: v(1080, 1080) },
    { id: 'ig-story', nombre: 'Instagram Story', detalle: '1080×1920 · 9:16 · up to 60 s', o: v(1080, 1920), maxSeg: 60 },
  ] },
  { grupo: 'TikTok', icon: 'tiktok', items: [
    { id: 'tiktok', nombre: 'TikTok', detalle: '1080×1920 · 9:16', o: v(1080, 1920) },
  ] },
  { grupo: 'X', icon: 'x', items: [
    { id: 'x-h', nombre: 'X horizontal', detalle: '1920×1080 · 16:9 · up to 512 MB', o: v(1920, 1080, { calidad: 'media' }), limiteMB: 512 },
    { id: 'x-v', nombre: 'X vertical', detalle: '1080×1920 · 9:16', o: v(1080, 1920, { calidad: 'media' }), limiteMB: 512 },
    { id: 'x-sq', nombre: 'X square', detalle: '1080×1080 · 1:1', o: v(1080, 1080, { calidad: 'media' }), limiteMB: 512 },
    { id: 'x-gif', nombre: 'GIF for X', detalle: '640 px · 15 fps · up to 15 MB', o: { formato: 'gif', calidad: 'media', ancho: 640, fps: 15 }, limiteMB: 15 },
  ] },
  { grupo: 'LinkedIn', icon: 'linkedin', items: [
    { id: 'li-h', nombre: 'LinkedIn horizontal', detalle: '1920×1080 · 16:9', o: v(1920, 1080) },
    { id: 'li-sq', nombre: 'LinkedIn square', detalle: '1080×1080 · 1:1', o: v(1080, 1080) },
    { id: 'li-v', nombre: 'LinkedIn vertical', detalle: '1080×1350 · 4:5', o: v(1080, 1350) },
  ] },
  { grupo: 'Facebook', icon: 'facebook', items: [
    { id: 'fb-feed', nombre: 'Facebook Feed', detalle: '1080×1350 · 4:5', o: v(1080, 1350) },
    { id: 'fb-reels', nombre: 'Facebook Reels', detalle: '1080×1920 · 9:16', o: v(1080, 1920) },
  ] },
  { grupo: 'Threads', icon: 'threads', items: [
    { id: 'threads', nombre: 'Threads', detalle: '1080×1350 · 4:5', o: v(1080, 1350) },
  ] },
  { grupo: 'Pinterest', icon: 'pinterest', items: [
    { id: 'pin-std', nombre: 'Pinterest Pin', detalle: '1000×1500 · 2:3', o: v(1000, 1500) },
    { id: 'pin-v', nombre: 'Pinterest vertical', detalle: '1080×1920 · 9:16', o: v(1080, 1920) },
  ] },
  { grupo: 'Snapchat', icon: 'snapchat', items: [
    { id: 'snap', nombre: 'Snapchat Spotlight', detalle: '1080×1920 · 9:16', o: v(1080, 1920) },
  ] },
  { grupo: 'WhatsApp', icon: 'whatsapp', items: [
    { id: 'wa-estado', nombre: 'WhatsApp Status', detalle: '1080×1920 · 9:16 · up to 16 MB', o: v(1080, 1920, { calidad: 'media' }), limiteMB: 16 },
    { id: 'wa-chat', nombre: 'WhatsApp chat', detalle: '1280×720 · light · up to 16 MB', o: v(1280, 720, { calidad: 'liviana' }), limiteMB: 16 },
  ] },
  { grupo: 'Discord', icon: 'discord', items: [
    { id: 'discord', nombre: 'Discord', detalle: '1280×720 · up to 10 MB without Nitro', o: v(1280, 720, { calidad: 'liviana' }), limiteMB: 10 },
  ] },
  { grupo: 'Twitch', icon: 'twitch', items: [
    { id: 'twitch', nombre: 'Twitch clip', detalle: '1920×1080 · 16:9', o: v(1920, 1080) },
  ] },
  { grupo: 'Vimeo', icon: 'vimeo', items: [
    { id: 'vimeo', nombre: 'Vimeo', detalle: '1920×1080 · high quality', o: v(1920, 1080) },
  ] },
  { grupo: 'Dribbble', icon: 'dribbble', items: [
    { id: 'dribbble', nombre: 'Dribbble', detalle: '1600×1200 · 4:3 · up to 24 s', o: v(1600, 1200), maxSeg: 24 },
  ] },
  { grupo: 'Web', icon: 'web', items: [
    { id: 'web-webm', nombre: 'Web WebM', detalle: '1280×720 · light', o: { formato: 'webm', calidad: 'media', ancho: 1280, alto: 720 } },
    { id: 'web-hero', nombre: 'Web hero', detalle: '1920×1080 · WebM', o: { formato: 'webm', calidad: 'media', ancho: 1920, alto: 1080 } },
    { id: 'web-mp4', nombre: 'Web MP4 light', detalle: '1280×720', o: v(1280, 720, { calidad: 'liviana' }) },
    { id: 'web-gif', nombre: 'Light GIF', detalle: '480 px · 12 fps', o: { formato: 'gif', calidad: 'liviana', ancho: 480, fps: 12 } },
  ] },
  { grupo: 'Resolutions', icon: 'resolucion', items: [
    { id: 'r-4k', nombre: '4K', detalle: '3840×2160', o: v(3840, 2160) },
    { id: 'r-1440', nombre: '1440p', detalle: '2560×1440', o: v(2560, 1440) },
    { id: 'r-1080', nombre: '1080p', detalle: '1920×1080', o: v(1920, 1080) },
    { id: 'r-720', nombre: '720p', detalle: '1280×720', o: v(1280, 720) },
    { id: 'r-480', nombre: '480p', detalle: '854×480', o: v(854, 480) },
  ] },
];
export const ALL = DESTINOS.flatMap(g => g.items.map(i => ({ ...i, grupo: g.grupo, icon: g.icon })));
export const MAIN = ['original', 'yt-1080', 'ig-reels', 'tiktok', 'x-h', 'x-gif'];
export const SHORT = { original: ['Original', 'From the project'], 'yt-1080': ['YouTube', '1080p · 16:9'], 'ig-reels': ['Reels', '9:16 · 1080p'], tiktok: ['TikTok', '9:16 · 1080p'], 'x-h': ['X', '16:9 · 1080p'], 'x-gif': ['GIF for X', '640 px · 15 fps'] };
