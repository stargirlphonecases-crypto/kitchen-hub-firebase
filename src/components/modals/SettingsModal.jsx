import React from 'react';
import { X, Minus, Plus, Save, CalendarX, ChevronRight, AlertTriangle } from 'lucide-react';

export default function SettingsModal({
  setIsSettingsOpen,
  portions,
  setPortions,
  saveDefaultPortions,
  handleResetWeek,
  handleEmptyFridge,
  THEMES,
  currentTheme,
  setCurrentTheme,
  theme
}) {
  return (
    <div className="fixed top-24 left-0 right-0 z-[150] px-6 max-w-md mx-auto animate-in slide-in-from-top-4 pointer-events-none">
      <div className="bg-white border border-slate-100 rounded-[3rem] p-6 shadow-2xl pointer-events-auto relative">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 px-2">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-slate-300">SETTINGS</h4>
          <button onClick={() => setIsSettingsOpen(false)} className="bg-slate-50 p-2 rounded-full active:scale-90 transition-transform hover:bg-slate-100">
            <X size={18} className="text-slate-400"/>
          </button>
        </div>
        
        <div className="space-y-6">
          
          {/* 1. DEFAULTS (Serving Size) */}
          <div>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">Defaults</p>
             <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Serving Size</p>
                  <p className="text-[9px] text-slate-300 font-medium">{portions} People</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPortions(p=>Math.max(1, p-1))} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Minus size={14}/></button>
                  <span className="w-5 text-center font-black text-lg">{portions}</span>
                  <button onClick={() => setPortions(p=>p+1)} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Plus size={14}/></button>
                  <button onClick={saveDefaultPortions} className={`ml-1 p-2 rounded-xl text-white shadow-md active:scale-90 transition-transform ${theme.primary}`}><Save size={16}/></button>
                </div>
             </div>
          </div>

          {/* 2. PLAN MANAGEMENT (Start New Week & Empty Fridge) */}
          <div>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">Data Management</p>
             <div className="space-y-2">
                 {/* RESET WEEK */}
                 <button onClick={handleResetWeek} className="w-full p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between group active:scale-95 transition-all hover:bg-slate-50 hover:border-slate-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><CalendarX size={20}/></div>
                        <div className="text-left">
                          <h3 className="text-sm font-black uppercase italic text-slate-700">Start New Week</h3>
                          <p className="text-[9px] font-bold text-slate-300">Clear all 'Cooked' statuses</p>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300"/>
                 </button>
                 
                 {/* EMPTY FRIDGE */}
                 <button onClick={handleEmptyFridge} className="w-full p-4 bg-white border border-red-100 rounded-2xl flex items-center justify-between group active:scale-95 transition-all hover:bg-red-50 hover:border-red-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-xl text-red-400 group-hover:bg-red-100"><AlertTriangle size={20}/></div>
                        <div className="text-left">
                          <h3 className="text-sm font-black uppercase italic text-red-600">Empty Fridge</h3>
                          <p className="text-[9px] font-bold text-red-400">Delete all inventory data</p>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-red-300 group-hover:text-red-400"/>
                 </button>
             </div>
          </div>

          {/* 3. APPEARANCE (Themes) */}
          <div>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">Appearance</p>
             <div className="flex justify-between gap-2">
                {Object.keys(THEMES).map(k => (
                   <button 
                      key={k} 
                      onClick={() => setCurrentTheme(k)} 
                      className={`h-12 w-full rounded-2xl flex items-center justify-center transition-all ${THEMES[k].primary} ${currentTheme === k ? 'ring-4 ring-offset-2 ring-slate-100 shadow-inner scale-95' : 'shadow-sm hover:scale-105 active:scale-95'}`}
                      title={THEMES[k].name}
                   >
                      {currentTheme === k && <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{THEMES[k].name}</span>}
                   </button>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}