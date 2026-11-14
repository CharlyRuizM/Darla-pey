import './panel.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel del consultorio' };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function PanelLayout({ children }) {
  return children;
}
