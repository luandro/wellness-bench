import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const AdminAccessButton = () => {
  const { mode } = useApp();

  if (mode !== 'builder') return null;

  return (
    <Link 
      to="/run" 
      className="fixed top-8 left-8 z-50 p-3 rounded-full bg-background/80 hover:bg-background border border-border backdrop-blur-md transition-all shadow-md group hover:scale-105 active:scale-95"
      title="Go to Admin Area"
    >
      <Settings className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
};
