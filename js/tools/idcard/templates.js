/* WebcamClicks ID card maker — built-in designs. Every text that changes per person uses {{Field}} placeholders. */
import { textEl as T, imageEl as I, shapeEl as R, qrEl as Q, barcodeEl as B, solidBg } from './engine.js';

export const SAMPLE_COLUMNS = ['Name', 'ID', 'Role', 'Department', 'Phone', 'Email', 'Blood Group', 'Valid Until', 'Photo'];
export const SAMPLE_ROWS = [
  { Name: 'Aarav Sharma', ID: 'EMP-1042', Role: 'Software Engineer', Department: 'Technology', Phone: '+977 980-1234567', Email: 'aarav@example.com', 'Blood Group': 'B+', 'Valid Until': '12/2027', Photo: '' },
  { Name: 'Sita Gurung', ID: 'EMP-1043', Role: 'Product Designer', Department: 'Design', Phone: '+977 981-2345678', Email: 'sita@example.com', 'Blood Group': 'O+', 'Valid Until': '12/2027', Photo: '' },
  { Name: 'Daniel Okafor', ID: 'EMP-1044', Role: 'Head of Sales', Department: 'Sales', Phone: '+1 555 0134', Email: 'daniel@example.com', 'Blood Group': 'A-', 'Valid Until': '06/2028', Photo: '' }
];
const ORG = { company: 'Acme Corporation', address: 'Kathmandu, Nepal · acme.example.com' };
const back = (bg, color, accent, W, H, extra = []) => ({
  bg, layers: [
    T({ x: W * 0.07, y: H * 0.07, w: W * 0.86, h: H * 0.12, text: ORG.company, font: 'montserrat', weight: 800, size: Math.round(H * 0.075), color: accent }),
    T({ x: W * 0.07, y: H * 0.2, w: W * 0.86, h: H * 0.3, text: 'This card is the property of the company and must be shown on request. If found, please return it to the address below.', size: Math.round(H * 0.042), weight: 400, color, lineH: 1.35 }),
    T({ x: W * 0.07, y: H * 0.5, w: W * 0.55, h: H * 0.08, text: 'Emergency: {{Phone}}', size: Math.round(H * 0.04), weight: 600, color }),
    T({ x: W * 0.07, y: H * 0.58, w: W * 0.55, h: H * 0.08, text: 'Blood group: {{Blood Group}}', size: Math.round(H * 0.04), weight: 600, color }),
    Q({ x: W * 0.72, y: H * 0.44, w: Math.min(W, H) * 0.3, h: Math.min(W, H) * 0.3, value: '{{ID}}' }),
    R({ x: W * 0.07, y: H * 0.8, w: W * 0.34, h: 3, shape: 'line', fill: color }),
    T({ x: W * 0.07, y: H * 0.82, w: W * 0.4, h: H * 0.07, text: 'Authorised signature', size: Math.round(H * 0.034), weight: 400, color }),
    T({ x: W * 0.07, y: H * 0.89, w: W * 0.86, h: H * 0.07, text: ORG.address, size: Math.round(H * 0.034), weight: 600, color: accent }),
    ...extra
  ]
});

export const TEMPLATES = {
  corporate: { name: 'Corporate blue', size: 'cr80l', make: (W, H) => ({
    front: { bg: solidBg('#ffffff'), layers: [
      R({ x: 0, y: 0, w: W, h: H * 0.24, fill: '#1e3a8a', fill2: '#2563eb', angle: 0 }),
      R({ x: W * 0.06, y: H * 0.055, w: H * 0.13, h: H * 0.13, shape: 'circle', fill: '#ffffff' }),
      T({ x: W * 0.06 + H * 0.17, y: H * 0.05, w: W * 0.6, h: H * 0.14, text: ORG.company, font: 'montserrat', weight: 800, size: 46, color: '#ffffff' }),
      I({ x: W * 0.06, y: H * 0.32, w: W * 0.27, h: H * 0.54, shape: 'rounded', radius: 16, border: 6, borderColor: '#dbeafe' }),
      T({ x: W * 0.38, y: H * 0.32, w: W * 0.56, h: H * 0.14, text: '{{Name}}', font: 'montserrat', weight: 800, size: 58, color: '#0f172a' }),
      T({ x: W * 0.38, y: H * 0.46, w: W * 0.56, h: H * 0.08, text: '{{Role}}', size: 34, weight: 600, color: '#2563eb' }),
      T({ x: W * 0.38, y: H * 0.57, w: W * 0.56, h: H * 0.07, text: 'ID: {{ID}}', size: 30, weight: 600, color: '#334155' }),
      T({ x: W * 0.38, y: H * 0.65, w: W * 0.56, h: H * 0.07, text: 'Dept: {{Department}}', size: 30, weight: 400, color: '#334155' }),
      T({ x: W * 0.38, y: H * 0.73, w: W * 0.56, h: H * 0.07, text: 'Valid until {{Valid Until}}', size: 28, weight: 400, color: '#64748b' }),
      R({ x: 0, y: H * 0.93, w: W, h: H * 0.07, fill: '#1e3a8a', fill2: '#2563eb', angle: 0 })] },
    back: back(solidBg('#ffffff'), '#334155', '#1e3a8a', W, H) }) },
  gradient: { name: 'Modern gradient', size: 'cr80p', make: (W, H) => ({
    front: { bg: solidBg('#ffffff'), layers: [
      R({ x: 0, y: 0, w: W, h: H * 0.38, shape: 'arc', fill: '#7c3aed', fill2: '#ec4899', angle: 30 }),
      T({ x: W * 0.08, y: H * 0.04, w: W * 0.84, h: H * 0.07, text: ORG.company, font: 'montserrat', weight: 800, size: 38, color: '#ffffff', align: 'center', upper: true, spacing: 8 }),
      I({ x: W * 0.27, y: H * 0.16, w: W * 0.46, h: W * 0.46, shape: 'circle', border: 10, borderColor: '#ffffff' }),
      T({ x: W * 0.06, y: H * 0.5, w: W * 0.88, h: H * 0.09, text: '{{Name}}', font: 'montserrat', weight: 800, size: 54, color: '#111827', align: 'center' }),
      T({ x: W * 0.06, y: H * 0.59, w: W * 0.88, h: H * 0.05, text: '{{Role}}', size: 32, weight: 600, color: '#7c3aed', align: 'center' }),
      T({ x: W * 0.1, y: H * 0.67, w: W * 0.8, h: H * 0.045, text: 'ID  {{ID}}', size: 28, weight: 600, color: '#374151', align: 'center' }),
      T({ x: W * 0.1, y: H * 0.715, w: W * 0.8, h: H * 0.045, text: '{{Phone}}', size: 26, weight: 400, color: '#6b7280', align: 'center' }),
      B({ x: W * 0.12, y: H * 0.79, w: W * 0.76, h: H * 0.13, value: '{{ID}}' }),
      R({ x: 0, y: H * 0.965, w: W, h: H * 0.035, fill: '#7c3aed', fill2: '#ec4899', angle: 0 })] },
    back: back(solidBg('#faf5ff'), '#374151', '#7c3aed', W, H) }) },
  minimal: { name: 'Minimal white', size: 'cr80p', make: (W, H) => ({
    front: { bg: solidBg('#ffffff'), layers: [
      R({ x: W * 0.08, y: H * 0.05, w: 46, h: 46, shape: 'rect', radius: 10, fill: '#111827' }),
      T({ x: W * 0.08 + 60, y: H * 0.05, w: W * 0.7, h: 46, text: ORG.company, font: 'inter', weight: 800, size: 30, color: '#111827' }),
      I({ x: W * 0.08, y: H * 0.15, w: W * 0.84, h: W * 0.84, shape: 'rounded', radius: 24 }),
      T({ x: W * 0.08, y: H * 0.68, w: W * 0.84, h: H * 0.08, text: '{{Name}}', font: 'inter', weight: 800, size: 50, color: '#111827' }),
      T({ x: W * 0.08, y: H * 0.76, w: W * 0.84, h: H * 0.05, text: '{{Role}}', font: 'inter', size: 30, weight: 400, color: '#6b7280' }),
      R({ x: W * 0.08, y: H * 0.84, w: W * 0.84, h: 2, shape: 'line', fill: '#e5e7eb' }),
      T({ x: W * 0.08, y: H * 0.86, w: W * 0.5, h: H * 0.05, text: '{{ID}}', font: 'mono', size: 28, weight: 700, color: '#111827' }),
      Q({ x: W * 0.72, y: H * 0.855, w: W * 0.2, h: W * 0.2, value: '{{ID}}' })] },
    back: back(solidBg('#ffffff'), '#4b5563', '#111827', W, H) }) },
  student: { name: 'Student ID', size: 'cr80l', make: (W, H) => ({
    front: { bg: { ...solidBg('#ffffff'), pattern: 'guilloche', patternColor: '#15803d', patternOpacity: 0.07 }, layers: [
      R({ x: 0, y: 0, w: W, h: H * 0.2, fill: '#14532d', fill2: '#16a34a', angle: 0 }),
      R({ x: W * 0.04, y: H * 0.035, w: H * 0.13, h: H * 0.13, shape: 'circle', fill: '#fde047' }),
      T({ x: W * 0.04 + H * 0.16, y: H * 0.02, w: W * 0.7, h: H * 0.1, text: 'Greenfield Secondary School', font: 'merriweather', weight: 700, size: 38, color: '#ffffff' }),
      T({ x: W * 0.04 + H * 0.16, y: H * 0.115, w: W * 0.7, h: H * 0.06, text: 'STUDENT IDENTITY CARD', size: 24, weight: 700, color: '#fde047', spacing: 6 }),
      I({ x: W * 0.05, y: H * 0.27, w: W * 0.25, h: H * 0.6, shape: 'rect', border: 6, borderColor: '#14532d' }),
      T({ x: W * 0.35, y: H * 0.27, w: W * 0.6, h: H * 0.12, text: '{{Name}}', font: 'montserrat', weight: 800, size: 52, color: '#14532d' }),
      T({ x: W * 0.35, y: H * 0.41, w: W * 0.6, h: H * 0.07, text: 'Class: {{Department}}', size: 30, weight: 600, color: '#1f2937' }),
      T({ x: W * 0.35, y: H * 0.49, w: W * 0.6, h: H * 0.07, text: 'Roll no: {{ID}}', size: 30, weight: 600, color: '#1f2937' }),
      T({ x: W * 0.35, y: H * 0.57, w: W * 0.6, h: H * 0.07, text: 'Guardian: {{Phone}}', size: 28, weight: 400, color: '#1f2937' }),
      T({ x: W * 0.35, y: H * 0.65, w: W * 0.6, h: H * 0.07, text: 'Blood group: {{Blood Group}}', size: 28, weight: 400, color: '#1f2937' }),
      B({ x: W * 0.35, y: H * 0.76, w: W * 0.4, h: H * 0.15, value: '{{ID}}', showText: false }),
      T({ x: W * 0.78, y: H * 0.82, w: W * 0.18, h: H * 0.08, text: 'Principal', font: 'script', weight: 400, size: 40, color: '#1f2937', align: 'center' })] },
    back: back(solidBg('#f0fdf4'), '#1f2937', '#14532d', W, H) }) },
  medical: { name: 'Medical staff', size: 'cr80p', make: (W, H) => ({
    front: { bg: solidBg('#ffffff'), layers: [
      R({ x: 0, y: 0, w: W, h: H * 0.3, shape: 'wavetop', fill: '#0d9488', fill2: '#14b8a6', angle: 90 }),
      R({ x: W * 0.08, y: H * 0.045, w: 22, h: 66, fill: '#ffffff' }), R({ x: W * 0.08 - 22, y: H * 0.045 + 22, w: 66, h: 22, fill: '#ffffff' }),
      T({ x: W * 0.22, y: H * 0.04, w: W * 0.72, h: H * 0.08, text: 'City General Hospital', font: 'poppins', weight: 700, size: 36, color: '#ffffff' }),
      I({ x: W * 0.25, y: H * 0.19, w: W * 0.5, h: W * 0.58, shape: 'rounded', radius: 22, border: 8, borderColor: '#ffffff' }),
      T({ x: W * 0.06, y: H * 0.58, w: W * 0.88, h: H * 0.08, text: '{{Name}}', weight: 800, size: 50, color: '#134e4a', align: 'center' }),
      T({ x: W * 0.06, y: H * 0.66, w: W * 0.88, h: H * 0.05, text: '{{Role}}', size: 32, weight: 600, color: '#0d9488', align: 'center' }),
      T({ x: W * 0.15, y: H * 0.735, w: W * 0.7, h: H * 0.05, text: '{{Department}}', size: 28, weight: 700, color: '#ffffff', align: 'center', box: '#0d9488' }),
      T({ x: W * 0.06, y: H * 0.82, w: W * 0.88, h: H * 0.045, text: 'Staff ID: {{ID}}', size: 28, weight: 600, color: '#334155', align: 'center' }),
      T({ x: W * 0.06, y: H * 0.865, w: W * 0.88, h: H * 0.045, text: 'Blood: {{Blood Group}}', size: 26, weight: 600, color: '#dc2626', align: 'center' }),
      R({ x: 0, y: H * 0.95, w: W, h: H * 0.05, fill: '#0d9488' })] },
    back: back(solidBg('#f0fdfa'), '#334155', '#0d9488', W, H) }) },
  tech: { name: 'Tech dark', size: 'cr80p', make: (W, H) => ({
    front: { bg: { ...solidBg('#0b1020'), type: 'gradient', c1: '#0b1020', c2: '#111c3a', angle: 160, pattern: 'grid', patternColor: '#38bdf8', patternOpacity: 0.06 }, layers: [
      T({ x: W * 0.08, y: H * 0.05, w: W * 0.84, h: H * 0.06, text: ORG.company, font: 'mono', weight: 700, size: 30, color: '#38bdf8', upper: true, spacing: 10 }),
      R({ x: W * 0.2 - 8, y: H * 0.14 - 8, w: W * 0.6 + 16, h: W * 0.6 + 16, shape: 'circle', fill: '#38bdf8', fill2: '#a855f7', angle: 45 }),
      I({ x: W * 0.2, y: H * 0.14, w: W * 0.6, h: W * 0.6, shape: 'circle' }),
      T({ x: W * 0.06, y: H * 0.56, w: W * 0.88, h: H * 0.09, text: '{{Name}}', font: 'montserrat', weight: 800, size: 54, color: '#f8fafc', align: 'center' }),
      T({ x: W * 0.06, y: H * 0.65, w: W * 0.88, h: H * 0.05, text: '{{Role}}', font: 'mono', size: 28, weight: 500, color: '#a5b4fc', align: 'center' }),
      R({ x: W * 0.3, y: H * 0.72, w: W * 0.4, h: 3, shape: 'line', fill: '#38bdf8' }),
      T({ x: W * 0.06, y: H * 0.74, w: W * 0.88, h: H * 0.05, text: '{{ID}}', font: 'mono', size: 30, weight: 700, color: '#f8fafc', align: 'center' }),
      Q({ x: W * 0.36, y: H * 0.81, w: W * 0.28, h: W * 0.28, value: '{{ID}}', color: '#0b1020', bg: '#e0f2fe' })] },
    back: back({ ...solidBg('#0b1020') }, '#cbd5e1', '#38bdf8', W, H) }) },
  event: { name: 'Event badge', size: 'badgep', make: (W, H) => ({
    front: { bg: solidBg('#ffffff'), layers: [
      R({ x: 0, y: 0, w: W, h: H * 0.3, fill: '#f97316', fill2: '#db2777', angle: 20 }),
      T({ x: W * 0.07, y: H * 0.05, w: W * 0.86, h: H * 0.11, text: 'TECH SUMMIT 2026', font: 'bebas', weight: 400, size: 110, color: '#ffffff' }),
      T({ x: W * 0.07, y: H * 0.17, w: W * 0.86, h: H * 0.06, text: 'Kathmandu · 14–15 March', size: 40, weight: 600, color: '#ffe4e6' }),
      I({ x: W * 0.07, y: H * 0.34, w: W * 0.3, h: W * 0.3, shape: 'circle', border: 8, borderColor: '#f97316' }),
      T({ x: W * 0.07, y: H * 0.58, w: W * 0.86, h: H * 0.16, text: '{{Name}}', font: 'montserrat', weight: 800, size: 96, color: '#111827' }),
      T({ x: W * 0.07, y: H * 0.74, w: W * 0.86, h: H * 0.06, text: '{{Department}}', size: 44, weight: 600, color: '#6b7280' }),
      R({ x: 0, y: H * 0.86, w: W, h: H * 0.14, fill: '#111827' }),
      T({ x: 0, y: H * 0.86, w: W, h: H * 0.14, text: '{{Role}}', font: 'bebas', weight: 400, size: 96, color: '#ffffff', align: 'center', upper: true, spacing: 10 }),
      Q({ x: W * 0.68, y: H * 0.34, w: W * 0.25, h: W * 0.25, value: '{{Email}}' })] },
    back: back(solidBg('#fff7ed'), '#374151', '#db2777', W, H) }) },
  visitor: { name: 'Visitor pass', size: 'cr80l', make: (W, H) => ({
    front: { bg: solidBg('#fef08a'), layers: [
      R({ x: 0, y: 0, w: W * 0.34, h: H, fill: '#111827' }),
      T({ x: W * 0.02, y: H * 0.3, w: W * 0.3, h: H * 0.4, text: 'VISITOR', font: 'bebas', weight: 400, size: 120, color: '#fef08a', align: 'center' }),
      T({ x: W * 0.39, y: H * 0.08, w: W * 0.57, h: H * 0.1, text: ORG.company, font: 'montserrat', weight: 800, size: 38, color: '#111827' }),
      T({ x: W * 0.39, y: H * 0.26, w: W * 0.57, h: H * 0.14, text: '{{Name}}', font: 'montserrat', weight: 800, size: 58, color: '#111827' }),
      T({ x: W * 0.39, y: H * 0.42, w: W * 0.57, h: H * 0.08, text: 'Visiting: {{Department}}', size: 32, weight: 600, color: '#374151' }),
      T({ x: W * 0.39, y: H * 0.51, w: W * 0.57, h: H * 0.08, text: 'Pass no: {{ID}}', size: 32, weight: 600, color: '#374151' }),
      T({ x: W * 0.39, y: H * 0.6, w: W * 0.57, h: H * 0.08, text: 'Valid: {{Valid Until}}', size: 32, weight: 600, color: '#374151' }),
      B({ x: W * 0.39, y: H * 0.74, w: W * 0.55, h: H * 0.19, value: '{{ID}}', bg: '#fef08a' })] },
    back: back(solidBg('#ffffff'), '#374151', '#111827', W, H) }) },
  gold: { name: 'Elegant gold', size: 'cr80l', make: (W, H) => ({
    front: { bg: { ...solidBg('#111111'), type: 'gradient', c1: '#0c0c0c', c2: '#262626', angle: 135, pattern: 'lines', patternColor: '#d4af37', patternOpacity: 0.05 }, layers: [
      R({ x: W * 0.03, y: H * 0.05, w: W * 0.94, h: H * 0.9, shape: 'rect', radius: 14, fill: 'rgba(0,0,0,0)', stroke: '#d4af37', strokeW: 3 }),
      T({ x: W * 0.07, y: H * 0.1, w: W * 0.6, h: H * 0.1, text: ORG.company, font: 'playfair', weight: 800, size: 40, color: '#d4af37', italic: true }),
      I({ x: W * 0.7, y: H * 0.12, w: W * 0.24, h: H * 0.56, shape: 'rounded', radius: 10, border: 4, borderColor: '#d4af37' }),
      T({ x: W * 0.07, y: H * 0.32, w: W * 0.6, h: H * 0.14, text: '{{Name}}', font: 'playfair', weight: 800, size: 58, color: '#ffffff' }),
      T({ x: W * 0.07, y: H * 0.47, w: W * 0.6, h: H * 0.08, text: '{{Role}}', size: 30, weight: 600, color: '#d4af37', upper: true, spacing: 6 }),
      R({ x: W * 0.07, y: H * 0.6, w: W * 0.2, h: 3, shape: 'line', fill: '#d4af37' }),
      T({ x: W * 0.07, y: H * 0.66, w: W * 0.6, h: H * 0.07, text: 'Member no. {{ID}}', size: 28, weight: 400, color: '#e5e5e5' }),
      T({ x: W * 0.07, y: H * 0.74, w: W * 0.6, h: H * 0.07, text: 'Since 2026 · Valid {{Valid Until}}', size: 26, weight: 400, color: '#a3a3a3' }),
      T({ x: W * 0.7, y: H * 0.74, w: W * 0.24, h: H * 0.1, text: '{{Name}}', font: 'script', weight: 400, size: 40, color: '#d4af37', align: 'center' })] },
    back: back(solidBg('#111111'), '#d4d4d4', '#d4af37', W, H) }) },
  security: { name: 'Security staff', size: 'cr80p', make: (W, H) => ({
    front: { bg: solidBg('#ffffff'), layers: [
      R({ x: 0, y: 0, w: W, h: H * 0.16, fill: '#b91c1c' }),
      T({ x: 0, y: 0, w: W, h: H * 0.16, text: 'SECURITY', font: 'bebas', weight: 400, size: 110, color: '#ffffff', align: 'center', spacing: 12 }),
      I({ x: W * 0.22, y: H * 0.2, w: W * 0.56, h: W * 0.66, shape: 'rect', border: 6, borderColor: '#111827' }),
      T({ x: W * 0.06, y: H * 0.63, w: W * 0.88, h: H * 0.08, text: '{{Name}}', font: 'oswald', weight: 700, size: 56, color: '#111827', align: 'center', upper: true }),
      T({ x: W * 0.06, y: H * 0.71, w: W * 0.88, h: H * 0.05, text: '{{Role}}', size: 30, weight: 600, color: '#b91c1c', align: 'center' }),
      T({ x: W * 0.06, y: H * 0.77, w: W * 0.88, h: H * 0.045, text: 'ID {{ID}} · {{Department}}', size: 26, weight: 600, color: '#374151', align: 'center' }),
      B({ x: W * 0.1, y: H * 0.84, w: W * 0.8, h: H * 0.11, value: '{{ID}}' })] },
    back: back(solidBg('#fef2f2'), '#374151', '#b91c1c', W, H) }) },
  member: { name: 'Membership card', size: 'cr80l', make: (W, H) => ({
    front: { bg: { ...solidBg('#4f46e5'), type: 'gradient', c1: '#312e81', c2: '#9333ea', angle: 120, pattern: 'waves', patternColor: '#ffffff', patternOpacity: 0.08 }, layers: [
      T({ x: W * 0.06, y: H * 0.08, w: W * 0.6, h: H * 0.1, text: 'FITZONE GYM', font: 'bebas', weight: 400, size: 66, color: '#ffffff', spacing: 6 }),
      T({ x: W * 0.06, y: H * 0.18, w: W * 0.6, h: H * 0.07, text: 'MEMBER', size: 26, weight: 700, color: '#c4b5fd', spacing: 18 }),
      I({ x: W * 0.72, y: H * 0.08, w: W * 0.22, h: W * 0.22, shape: 'circle', border: 6, borderColor: '#ffffff' }),
      T({ x: W * 0.06, y: H * 0.45, w: W * 0.88, h: H * 0.14, text: '{{Name}}', font: 'montserrat', weight: 800, size: 60, color: '#ffffff' }),
      T({ x: W * 0.06, y: H * 0.64, w: W * 0.5, h: H * 0.08, text: '{{ID}}', font: 'mono', size: 38, weight: 700, color: '#e9d5ff', spacing: 8 }),
      T({ x: W * 0.06, y: H * 0.78, w: W * 0.4, h: H * 0.08, text: 'VALID THRU {{Valid Until}}', size: 26, weight: 600, color: '#ddd6fe' }),
      T({ x: W * 0.56, y: H * 0.78, w: W * 0.38, h: H * 0.08, text: '{{Role}}', size: 28, weight: 800, color: '#fde047', align: 'right', upper: true })] },
    back: back(solidBg('#ffffff'), '#374151', '#6d28d9', W, H) }) },
  volunteer: { name: 'Volunteer', size: 'cr80p', make: (W, H) => ({
    front: { bg: solidBg('#fff7ed'), layers: [
      R({ x: 0, y: H * 0.62, w: W, h: H * 0.38, shape: 'wave', fill: '#ea580c', fill2: '#f59e0b', angle: 0 }),
      T({ x: W * 0.06, y: H * 0.04, w: W * 0.88, h: H * 0.07, text: 'Helping Hands Foundation', weight: 700, size: 32, color: '#9a3412', align: 'center' }),
      I({ x: W * 0.2, y: H * 0.13, w: W * 0.6, h: W * 0.6, shape: 'circle', border: 10, borderColor: '#ea580c' }),
      T({ x: W * 0.06, y: H * 0.54, w: W * 0.88, h: H * 0.08, text: '{{Name}}', font: 'poppins', weight: 800, size: 52, color: '#1c1917', align: 'center' }),
      T({ x: W * 0.06, y: H * 0.74, w: W * 0.88, h: H * 0.1, text: 'VOLUNTEER', font: 'bebas', weight: 400, size: 96, color: '#ffffff', align: 'center', spacing: 10 }),
      T({ x: W * 0.06, y: H * 0.86, w: W * 0.88, h: H * 0.05, text: '{{ID}} · {{Phone}}', size: 26, weight: 600, color: '#ffedd5', align: 'center' })] },
    back: back(solidBg('#ffffff'), '#44403c', '#ea580c', W, H) }) }
};
