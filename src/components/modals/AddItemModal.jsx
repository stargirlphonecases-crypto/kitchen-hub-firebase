import React from 'react';
import { X, Plus } from 'lucide-react';

export default function AddItemModal({
  setIsAddModalOpen,
  activeTab,
  handleAddCustomItem,
  newItem,
  setNewItem,
  handleItemNameChange,
  showSuggestions,
  suggestions,
  selectSuggestion,
  theme
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
       <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl relative animate-in slide-in-from-bottom-4 pointer-events-auto">
          
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-black italic uppercase tracking-tighter">
                Add to {activeTab === 'fridge' ? 'Fridge' : 'Cart'}
             </h3>
             <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800">
                <X size={24}/>
             </button>
          </div>

          <form onSubmit={handleAddCustomItem} className="space-y-4">
             <div className="space-y-1 relative">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Item Name</label>
                <input 
                   type="text" 
                   required 
                   value={newItem.Item} 
                   onChange={handleItemNameChange} 
                   placeholder="Start typing..." 
                   className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500" 
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto z-50">
                        {suggestions.map((s, idx) => (
                            <div key={idx} onClick={() => selectSuggestion(s)} className="p-3 px-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center">
                                <span className="font-bold text-sm text-slate-700">{s.name}</span>
                                <span className="text-[10px] uppercase text-slate-400 font-medium tracking-wider">{s.dept}</span>
                            </div>
                        ))}
                    </div>
                )}
             </div>

             <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Amount</label>
                    <input 
                       type="number" 
                       min="0.1" 
                       step="0.1" 
                       required 
                       value={newItem.Amount} 
                       onChange={e => setNewItem({...newItem, Amount: parseFloat(e.target.value)})} 
                       className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black italic focus:outline-none focus:border-orange-500" 
                    />
                </div>
                <div className="space-y-1 flex-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Unit</label>
                    <select 
                       value={newItem.Unit} 
                       onChange={e => setNewItem({...newItem, Unit: e.target.value})} 
                       className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500 appearance-none"
                    >
                        <option value="pcs">pcs</option>
                        <option value="gab">gab</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="l">l</option>
                        <option value="ml">ml</option>
                        <option value="pack">pack</option>
                        <option value="iepak">iepak</option>
                        <option value="tbsp">tbsp</option>
                        <option value="ēd.k.">ēd.k.</option>
                        <option value="tsp">tsp</option>
                        <option value="tējk.">tējk.</option>
                        <option value="pinch">pinch</option>
                        <option value="šķipsna">šķipsna</option>
                    </select>
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Department</label>
                <select 
                   value={newItem.Department} 
                   onChange={e => setNewItem({...newItem, Department: e.target.value})} 
                   className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500 appearance-none"
                >
                    <option value="Produce">Produce</option>
                    <option value="Dārzeņi un augļi">Dārzeņi un augļi</option>
                    <option value="Meat & Fish">Meat & Fish</option>
                    <option value="Gaļa un zivis">Gaļa un zivis</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Piena produkti">Piena produkti</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Maize">Maize</option>
                    <option value="Pantry">Pantry</option>
                    <option value="Bakaleja">Bakaleja</option>
                    <option value="Frozen">Frozen</option>
                    <option value="Saldētie produkti">Saldētie produkti</option>
                    <option value="Household">Household</option>
                    <option value="Saimniecības preces">Saimniecības preces</option>
                    <option value="Other">Other</option>
                    <option value="Cits">Cits</option>
                </select>
             </div>

             <button type="submit" className={`w-full mt-4 p-5 rounded-2xl text-white font-black uppercase italic tracking-widest shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-all ${theme.primary}`}>
                <Plus size={20}/> {activeTab === 'fridge' ? 'Add to Fridge' : 'Add to Cart'}
             </button>
          </form>

       </div>
    </div>
  );
}