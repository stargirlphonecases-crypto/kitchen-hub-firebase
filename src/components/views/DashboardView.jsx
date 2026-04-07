import React from 'react';
import { 
  User, Minus, Plus, Save, ChevronLeft, ChevronRight, 
  List, ChevronDown, CheckCheck, Coffee, Sun, Moon, CalendarX 
} from 'lucide-react';

export default function DashboardView({
  portions,
  setPortions,
  saveDefaultPortions,
  theme,
  selectedDayIndex,
  setSelectedDayIndex,
  DAYS,
  isMenuOpen,
  setIsMenuOpen,
  selectedMenu,
  setSelectedMenu,
  availableMenus,
  currentDayPlan,
  setSelectedRecipe,
  completedMeals
}) {
  return (
    <div className="space-y-6">
      
      {/* 1. Serving Size Control */}
      <div className="bg-white p-4 px-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><User size={18} /></div>
          <div className="text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Serving Size</p>
            <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{portions} People</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPortions(p=>Math.max(1,p-1))} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Minus size={14}/></button>
          <button onClick={() => setPortions(p=>p+1)} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Plus size={14}/></button>
          <button onClick={saveDefaultPortions} className={`ml-1 p-2 rounded-xl text-white shadow-md active:scale-90 transition-transform ${theme.primary}`}><Save size={14}/></button>
        </div>
      </div>

      {/* 2. Day Selector */}
      <div className="flex items-center justify-between bg-slate-900 p-4 px-6 rounded-[2rem] shadow-lg mb-6 active:scale-[0.99] transition-transform">
        <button onClick={() => setSelectedDayIndex(i => (i - 1 + 7) % 7)} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={24} /></button>
        <span className={`text-xl font-black italic uppercase tracking-widest ${theme.text}`}>{DAYS[selectedDayIndex]}</span>
        <button onClick={() => setSelectedDayIndex(i => (i + 1) % 7)} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronRight size={24} /></button>
      </div>

      {/* 3. Menu Selector */}
      <div className="relative">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-full bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98]">
          <div className="flex items-center gap-4">
            <div className={`p-3 bg-slate-900 text-white rounded-2xl`}><List size={18} /></div>
            <div className="text-left">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">MENU</p>
              <p className="text-sm font-black uppercase italic tracking-tight">{selectedMenu || "Select Menu"}</p>
            </div>
          </div>
          <ChevronDown size={20} className={`text-slate-300 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] border border-slate-100 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
            {availableMenus.length > 0 ? availableMenus.map(m => (
              <button key={m} onClick={() => { setSelectedMenu(m); setIsMenuOpen(false); }} className="w-full p-5 text-left text-sm font-black uppercase italic border-b border-slate-50 last:border-0 hover:bg-slate-50">{m}</button>
            )) : <div className="p-5 text-[10px] font-bold text-slate-400 uppercase italic">No Menus Found</div>}
          </div>
        )}
      </div>

      {/* 4. Meal List */}
      <div className="space-y-4">
        {currentDayPlan.length > 0 ? currentDayPlan.map(m => (
          <div key={m.id} onClick={() => setSelectedRecipe(m)} className={`flex items-center gap-5 p-6 rounded-[2.5rem] border shadow-sm bg-white cursor-pointer active:scale-[0.98] transition-all ${completedMeals.includes(m.id) ? 'border-green-100 opacity-60 bg-slate-50' : 'border-slate-100'}`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${completedMeals.includes(m.id) ? 'bg-green-100 text-green-500' : m.type.includes('Breakfast') ? 'bg-amber-50 text-amber-500' : m.type.includes('Lunch') ? 'bg-blue-50 text-blue-500' : 'bg-indigo-50 text-indigo-500'}`}>
              {completedMeals.includes(m.id) ? <CheckCheck size={28}/> : m.type.includes('Breakfast') ? <Coffee size={28}/> : m.type.includes('Lunch') ? <Sun size={28}/> : <Moon size={28}/>}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{m.type}</p>
              <h3 className={`font-black truncate text-base uppercase italic tracking-tight ${completedMeals.includes(m.id) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{m.name}</h3>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl"><ChevronRight size={16} className="text-slate-300"/></div>
          </div>
        )) : (
          <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-[3rem] opacity-30">
            <CalendarX size={48} className="mx-auto mb-4 text-slate-400"/>
            <p className="text-xs font-black uppercase tracking-widest italic text-slate-400">No plan for today</p>
            <p className="text-[10px] font-bold text-slate-300 mt-2">Select a menu or add new recipes</p>
          </div>
        )}
      </div>

    </div>
  );
}