import { ReactNode } from 'react';
import { UserProfile } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Activity, LogOut, User } from 'lucide-react';

export default function Layout({ profile, children }: { profile: UserProfile, children: ReactNode }) {
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 text-slate-900 font-sans overflow-hidden">
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 sm:px-6 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            HospitalTracker <span className="text-slate-400 font-light text-sm hidden sm:inline">| System Status</span>
          </h1>
        </div>
        <div className="flex gap-4 sm:gap-6 text-xs uppercase tracking-widest font-bold items-center">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-blue-400">User Role</span>
            <span className="text-slate-300 font-normal">{profile.role}</span>
          </div>
          <div className="hidden sm:block h-8 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2 text-slate-200">
            <User className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline font-medium">{profile.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center text-slate-400 hover:text-white transition-colors ml-2"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex p-4 overflow-hidden">
        <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
