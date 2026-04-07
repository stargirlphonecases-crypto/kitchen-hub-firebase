import React from 'react';
import { Plus, Minus, Package, Refrigerator } from 'lucide-react';

export default function FridgeView({
  setIsAddModalOpen,
  fridgeItems,
  updateStock
}) {
  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-end px-2">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">My Fridge</h2>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Inventory</div>
       </div>
       
       <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-white border border-slate-200 border-dashed p-4 rounded-[2rem] text-slate-400 font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:border-slate-400 hover:text-slate-600 transition-colors active:scale-95 mb-4">
          <Plus size={20}/> Add to Fridge
       </button>
       
       <div className="space-y-4">
          {fridgeItems.length > 0 ? fridgeItems.map(i => (
              <div key={i.id} className="p-5 px-7 bg-white border border-slate-100 rounded-[1.8rem] flex justify-between items-center shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl bg-slate-50 text-slate-400`}><Package size={18}/></div>
                    <div>
                       <h3 className="font-black text-[14px] uppercase italic text-slate-700">{i.Item}</h3>
                       <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{i.Department || "Other"}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <button onClick={() => updateStock(i.id, -1)} className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center active:scale-90 hover:bg-slate-100"><Minus size={14}/></button>
                    <div className="text-center min-w-[40px]">
                       <span className="text-lg font-black italic">{i.inStock}</span>
                       <span className="text-[9px] block uppercase font-bold text-slate-300">{i.Unit}</span>
                    </div>
                    <button onClick={() => updateStock(i.id, 1)} className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center active:scale-90 hover:bg-slate-100"><Plus size={14}/></button>
                 </div>
              </div>
          )) : (
              <div className="p-24 flex flex-col items-center opacity-30">
                  <Refrigerator size={48} className="text-slate-400 mb-4"/>
                  <p className="italic uppercase font-black text-xs tracking-[0.2em] text-slate-400">Fridge is empty</p>
                  <p className="text-[9px] font-bold text-slate-300 mt-2 text-center">Add items using the + button</p>
              </div>
          )}
       </div>
    </div>
  );
}