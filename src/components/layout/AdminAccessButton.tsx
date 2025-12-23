import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const AdminAccessButton = () => {
  const { mode } = useApp();

  if (mode !== 'builder') return null;

  return (
    <Link 
      to="/run" 
      className="fixed top-4 right-4 z-50 p-2 rounded-full bg-background/50 hover:bg-background border border-border/50 backdrop-blur-sm transition-all shadow-sm group"
      title="Go to Admin Area"
    >
      <Settings className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
};
