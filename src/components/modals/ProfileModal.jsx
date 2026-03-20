import React from 'react';
import { X, User, Copy, Users, LogOut } from 'lucide-react';

export default function ProfileModal({
  user,
  theme,
  joinCodeInput,
  setJoinCodeInput,
  handleJoinHousehold,
  copyToClipboard,
  loading,
  handleLogout,
  setIsProfileOpen
}) {
  return (
    <div className="fixed top-24 left-0 right-0 z-[150] px-6 max-w-md mx-auto animate-in slide-in-from-top-4 pointer-events-none">
      <div className="bg-white border border-slate-100 rounded-[3rem] p-6 shadow-2xl pointer-events-auto relative">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-2">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-slate-300">PROFILE</h4>
          <button onClick={() => setIsProfileOpen(false)} className="bg-slate-50 p-2 rounded-full active:scale-90 transition-transform hover:bg-slate-100">
            <X size={18} className="text-slate-400"/>
          </button>
        </div>

        {/* User Identity */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-4 shadow-sm border border-slate-50 ${theme.bgLight} ${theme.text}`}>
            <User size={36} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Logged In As</p>
          <h3 className="text-sm font-black italic text-slate-800 tracking-tight text-center break-all px-4">{user.email}</h3>
        </div>

        {/* Household Sharing Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2 mb-2">
             <div className="h-px flex-1 bg-slate-100"></div>
             <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 italic">Family Sharing</h3>
             <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          <div className="bg-slate-50 p-4 rounded-[1.8rem] border border-slate-100 flex items-center justify-between group hover:border-slate-200 transition-colors">
             <div className="min-w-0 flex-1 px-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">My Invite Code</p>
                <p className="text-xs font-mono font-bold text-slate-700 truncate">{user.uid}</p>
             </div>
             <button onClick={copyToClipboard} className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-100 active:scale-90 transition-all text-slate-400 hover:${theme.text}`}>
                <Copy size={16}/>
             </button>
          </div>

          <div className="bg-white p-2 pl-4 rounded-[1.8rem] border border-slate-200 shadow-sm flex items-center gap-3 focus-within:border-slate-300 focus-within:shadow-md transition-all">
             <Users size={16} className="text-slate-300" />
             <input 
                type="text" 
                placeholder="Enter code to join..." 
                value={joinCodeInput} 
                onChange={(e) => setJoinCodeInput(e.target.value)} 
                className="flex-1 bg-transparent text-xs font-bold focus:outline-none text-slate-700 placeholder:text-slate-300"
             />
             <button 
                onClick={handleJoinHousehold} 
                disabled={!joinCodeInput.trim() || loading} 
                className={`px-5 py-3.5 rounded-[1.4rem] text-white font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all ${joinCodeInput.trim() ? theme.primary : 'bg-slate-200 shadow-none'}`}
             >
                Join
             </button>
          </div>
        </div>

        {/* Logout Button */}
        <button onClick={handleLogout} className="w-full mt-8 p-4 rounded-[2rem] bg-red-50 text-red-500 font-black uppercase italic tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-red-100 active:scale-95 transition-all border border-red-100">
           <LogOut size={16} /> Sign Out
        </button>

      </div>
    </div>
  );
}