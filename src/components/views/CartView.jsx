import React from 'react';
import { Trash2, Plus, Package, Check, CheckCheck } from 'lucide-react';

export default function CartView({
  handleClearCart,
  setIsAddModalOpen,
  groupedItems,
  checkedItems,
  setCheckedItems,
  theme,
  handleFinishShopping
}) {
  return (
    <div className="space-y-8 animate-in fade-in">
      
      <div className="flex justify-between items-end px-2">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Cart</h2>
        <button onClick={handleClearCart} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-600 flex items-center gap-2 group">
          <Trash2 size={12}/> Clear List
        </button>
      </div>

      <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-white border border-slate-200 border-dashed p-4 rounded-[2rem] text-slate-400 font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:border-slate-400 hover:text-slate-600 transition-colors active:scale-95 mb-4">
        <Plus size={20}/> Add to Cart
      </button>

      {Object.keys(groupedItems).length > 0 ? Object.keys(groupedItems).map(d => (
          <div key={d} className="space-y-4">
              <div className="flex items-center gap-3 px-4">
                 <div className="h-px flex-1 bg-slate-100"></div>
                 <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 italic">{d}</h3>
                 <div className="h-px flex-1 bg-slate-100"></div>
              </div>
              <div className="space-y-2">
                 {groupedItems[d].map(i => (
                    <div key={i.id} onClick={() => setCheckedItems(p => ({ ...p, [i.id]: !p[i.id] }))} className={`p-5 px-7 bg-white border rounded-[1.8rem] flex justify-between items-center shadow-sm cursor-pointer transition-all ${checkedItems[i.id] ? `${theme.border} ${theme.bgLight} opacity-60` : 'border-slate-100'}`}>
                       <div className="flex items-center gap-4">
                          <div className={`p-1.5 rounded-lg border-2 ${checkedItems[i.id] ? `${theme.primary} border-transparent text-white` : 'border-slate-100 text-transparent'}`}>
                             <Check size={12} strokeWidth={4}/>
                          </div>
                          <div>
                             <h3 className={`font-black text-[14px] uppercase italic ${checkedItems[i.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {i.Item || "Unknown Item"}
                             </h3>
                          </div>
                       </div>
                       <div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-2xl ${checkedItems[i.id] ? 'bg-slate-100 text-slate-400' : `${theme.bgLight} ${theme.text} border ${theme.border}`}`}>
                          <span className="text-lg font-black italic leading-none">{i.displayNeed.toFixed(0)}</span>
                          <span className="text-[10px] font-black uppercase italic tracking-tighter">{i.Unit || "pcs"}</span>
                       </div>
                    </div>
                 ))}
              </div>
          </div>
      )) : (
          <div className="p-24 flex flex-col items-center opacity-30">
              <Package size={48} className="text-slate-400 mb-4"/>
              <p className="italic uppercase font-black text-xs tracking-[0.2em] text-slate-400">Cart is empty</p>
              <p className="text-[9px] font-bold text-slate-300 mt-2 text-center">Select recipes to fill it</p>
          </div>
      )}

      {Object.keys(checkedItems).filter(id => checkedItems[id]).length > 0 && (
        <div className="pt-4">
           <button onClick={handleFinishShopping} className={`w-full bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all hover:${theme.primary}`}>
              <CheckCheck size={24}/>
              <div className="text-left">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Finish</p>
                 <p className="text-lg font-black uppercase italic leading-none">Shopping</p>
              </div>
           </button>
        </div>
      )}
    </div>
  );
}