import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, LayoutDashboard, RefreshCw, Minus, Plus, X, 
  Sun, Moon, Coffee, ArrowLeft, 
  List, ChevronDown, Package, Check, Trash2, CheckCheck, ChefHat,
  Settings, LogOut, User, ChevronRight, ChevronLeft, Save, Palette
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, addDoc, query
} from "firebase/firestore";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";

// --- FIREBASE CONFIGURATION (Izmanto vides mainīgos) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "smart-kitchen-hub-26f94.firebaseapp.com",
  projectId: "smart-kitchen-hub-26f94",
  storageBucket: "smart-kitchen-hub-26f94.firebasestorage.app",
  messagingSenderId: "881105921492",
  appId: "1:881105921492:web:92537fd42f1c4f16666241"
};

// Inicializējam Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- NOTION CONFIGURATION (Izmanto vides mainīgos) ---
const CONFIG = {
  apiKey: import.meta.env.VITE_NOTION_API_KEY,
  ingredientsDbId: import.meta.env.VITE_INGREDIENTS_DB_ID,
  mealPlansDbId: import.meta.env.VITE_MEAL_PLANS_DB_ID,
  baseUrl: "https://corsproxy.io/?https://api.notion.com/v1" 
};

const THEMES = {
  classic: { name: "Klasiskā", primary: "bg-orange-500", text: "text-orange-500", border: "border-orange-200", bgLight: "bg-orange-50", hover: "hover:bg-orange-50" },
  mint: { name: "Piparmētru", primary: "bg-teal-500", text: "text-teal-500", border: "border-teal-200", bgLight: "bg-teal-50", hover: "hover:bg-teal-50" },
  lavender: { name: "Lavandas", primary: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-200", bgLight: "bg-indigo-50", hover: "hover:bg-indigo-50" },
  sunny: { name: "Saulainā", primary: "bg-amber-500", text: "text-amber-500", border: "border-amber-200", bgLight: "bg-amber-50", hover: "hover:bg-amber-50" },
  rose: { name: "Rozā", primary: "bg-rose-500", text: "text-rose-500", border: "border-rose-200", bgLight: "bg-rose-50", hover: "hover:bg-rose-50" }
};

// --- API SERVISI ---
const NotionService = {
  async request(endpoint, method = 'POST', body = null) {
    const url = `${CONFIG.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${CONFIG.apiKey}`, 
          'Notion-Version': '2022-06-28', 
          'Content-Type': 'application/json' 
        },
        body: body ? JSON.stringify(body) : null
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `API Status: ${response.status}`);
      return data;
    } catch (error) {
      console.error(`Notion API Error [${method}]:`, error);
      throw error;
    }
  },

  async requestAll(dbId) {
    let allResults = [];
    let hasMore = true;
    let cursor = undefined;
    while (hasMore) {
        const body = cursor ? { start_cursor: cursor } : {};
        const response = await this.request(`/databases/${dbId}/query`, 'POST', body);
        if (response.results) allResults = [...allResults, ...response.results];
        hasMore = response.has_more;
        cursor = response.next_cursor;
    }
    return { results: allResults };
  },

  getSafeNumber(prop) {
    if (!prop) return 0;
    if (prop.type === 'number') return prop.number || 0;
    if (prop.type === 'formula') {
        if (prop.formula.type === 'number') return prop.formula.number || 0;
        if (prop.formula.type === 'string') return parseFloat(prop.formula.string) || 0;
    }
    return 0;
  },

  async getRecipeIngredients() {
    try {
      const data = await this.requestAll(CONFIG.ingredientsDbId);
      return data.results.map(page => {
        const p = page.properties;
        const titleProp = Object.values(p).find(prop => prop.type === 'title');
        return { 
          id: page.id, 
          Item: titleProp?.title?.[0]?.plain_text || "", 
          BaseAmount: this.getSafeNumber(p["Amount"]), 
          Unit: p.Unit?.select?.name || null, 
          forMeals: p["Meal Plans"]?.relation?.map(r => r.id) || [] 
        };
      });
    } catch (e) { throw new Error(`Ingredients: ${e.message}`); }
  },

  async getMealPlan() {
    try {
      const data = await this.requestAll(CONFIG.mealPlansDbId);
      const DAY_MAP = { 
        'Pirmdiena': 'Monday', 'Otrdiena': 'Tuesday', 'Trešdiena': 'Wednesday', 
        'Ceturtdiena': 'Thursday', 'Piektdiena': 'Friday', 'Sestdiena': 'Saturday', 'Svētdiena': 'Sunday',
        'Monday': 'Monday', 'Tuesday': 'Tuesday', 'Wednesday': 'Wednesday', 
        'Thursday': 'Thursday', 'Friday': 'Friday', 'Saturday': 'Saturday', 'Sunday': 'Sunday' 
      };

      return data.results.map(page => {
        const p = page.properties;
        const titleProp = Object.values(p).find(prop => prop.type === 'title');
        const getName = (n) => p[n]?.title?.[0]?.plain_text || p[n]?.rich_text?.[0]?.plain_text || "";
        const rawDay = p.Day?.select?.name || "Monday";

        return {
          id: page.id,
          isActive: p["Active"]?.checkbox || false,
          menuName: p["Meal Plan"]?.rich_text?.[0]?.plain_text || "Standarta",
          day: DAY_MAP[rawDay] || "Monday",
          type: p.Type?.select?.name || "Cits",
          name: titleProp?.title?.[0]?.plain_text || "Maltīte",
          recipe: getName("Recipe") || "",
          order: this.getSafeNumber(p["Status"])
        };
      });
    } catch (e) { throw new Error(`Meal Plan: ${e.message}`); }
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [inventory, setInventory] = useState([]); 
  const [recipeIngredients, setRecipeIngredients] = useState([]); 
  const [allMeals, setAllMeals] = useState([]); 
  
  const [availableMenus, setAvailableMenus] = useState([]); 
  const [selectedMenu, setSelectedMenu] = useState(null); 
  
  const [portions, setPortions] = useState(() => parseInt(localStorage.getItem('defaultPortions') || "1")); 
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('appTheme') || 'classic');

  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  
  const [checkedItems, setCheckedItems] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [newItem, setNewItem] = useState({ Item: "", Amount: 1, Unit: "pcs", Department: "Other" });

  const theme = THEMES[currentTheme];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    localStorage.setItem('appTheme', currentTheme);
  }, [currentTheme]);

  const saveDefaultPortions = () => {
    localStorage.setItem('defaultPortions', portions.toString());
    alert("Noklusējuma porciju skaits saglabāts!");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadNotionData();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return; 

    const q = query(collection(db, "inventory"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setInventory(items);
    }, (error) => {
      console.error("Firebase Inventory Error:", error);
      setErrorMsg("Neizdevās savienoties ar datubāzi.");
    });

    return () => unsubscribe();
  }, [user]);

  const loadNotionData = async () => {
    setLoading(true);
    try {
      const [ingredients, meals] = await Promise.all([
          NotionService.getRecipeIngredients(),
          NotionService.getMealPlan()
      ]);
      setRecipeIngredients(ingredients);
      setAllMeals(meals);
      
      const menus = [...new Set(meals.map(m => m.menuName))];
      setAvailableMenus(menus);

      if (meals.length > 0) {
        const active = meals.find(m => m.isActive);
        if (active && !selectedMenu) setSelectedMenu(active.menuName);
      }
    } catch (err) { 
        setErrorMsg(`Notion kļūda: ${err.message}`); 
    } 
    finally { setLoading(false); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setInventory([]);
    setAllMeals([]);
    setIsSettingsOpen(false);
    setIsMenuOpen(false);
    setSelectedRecipe(null);
    setActiveTab('dashboard');
  };

  const handleAddCustomItem = async (e) => {
    e.preventDefault();
    if(!newItem.Item.trim()) return;
    setIsAddModalOpen(false); 
    setLoading(true);

    try {
      const existing = inventory.find(i => i.Item.toLowerCase() === newItem.Item.toLowerCase());
      
      if (existing) {
        const currentStock = existing.inStock || 0;
        const newStock = currentStock - Math.abs(newItem.Amount);
        const itemRef = doc(db, "inventory", existing.id);
        await updateDoc(itemRef, { inStock: newStock });
      } else {
        await addDoc(collection(db, "inventory"), {
          Item: newItem.Item,
          Department: newItem.Department,
          Unit: newItem.Unit,
          inStock: -Math.abs(newItem.Amount)
        });
      }
      setNewItem({ Item: "", Amount: 1, Unit: "pcs", Department: "Other" });
    } catch (err) {
      console.error(err);
      setErrorMsg("Kļūda saglabājot Firebase.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishShopping = async () => {
    const idsToUpdate = Object.keys(checkedItems).filter(id => checkedItems[id]);
    if (idsToUpdate.length === 0) return;
    
    setLoading(true);
    try {
      const batchPromises = idsToUpdate.map(async (id) => {
        const item = inventory.find(i => i.id === id);
        if (item) {
           const itemRef = doc(db, "inventory", id);
           await updateDoc(itemRef, { inStock: 0 });
        }
      });

      await Promise.all(batchPromises);
      setCheckedItems({});
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearCart = async () => {
     setCheckedItems({});
  };

  const currentDayPlan = useMemo(() => {
    return allMeals
      .filter(m => m.day === DAYS[selectedDayIndex] && (selectedMenu ? m.menuName === selectedMenu : true))
      .sort((a,b) => (a.order || 99) - (b.order || 99));
  }, [allMeals, selectedDayIndex, selectedMenu]);

  const currentRecipeIngredients = useMemo(() => {
    if (!selectedRecipe) return [];
    const relevantIngredients = recipeIngredients.filter(i => i.forMeals && i.forMeals.includes(selectedRecipe.id));
    const aggregated = {};
    relevantIngredients.forEach(i => {
        const key = (i.Item || "").trim().toLowerCase(); 
        if (!aggregated[key]) aggregated[key] = { ...i, totalBase: 0 };
        aggregated[key].totalBase += i.BaseAmount; 
    });
    return Object.values(aggregated).map(i => ({
      ...i, 
      displayAmount: (i.totalBase * portions).toFixed(i.Unit === 'pcs' || !i.Unit ? 1 : 0) 
    }));
  }, [selectedRecipe, recipeIngredients, portions]);

 const groupedItems = useMemo(() => {
    const ingredientsTotals = {};
    recipeIngredients.forEach(ri => {
        const normName = (ri.Item || "").trim().toLowerCase();
        if (!ingredientsTotals[normName]) ingredientsTotals[normName] = 0;
        ingredientsTotals[normName] += ri.BaseAmount;
    });

    const allItemNames = new Set([
        ...Object.keys(ingredientsTotals),
        ...inventory.map(i => (i.Item || "").trim().toLowerCase())
    ]);

    const result = {};

    allItemNames.forEach(normName => {
        const recipeNeed = (ingredientsTotals[normName] || 0) * portions;
        const fireItem = inventory.find(i => (i.Item || "").trim().toLowerCase() === normName);
        const inStock = fireItem ? (fireItem.inStock || 0) : 0;
        const dbId = fireItem ? fireItem.id : `virtual_${normName}`;
        const department = fireItem?.Department || "Other";
        const unit = fireItem?.Unit || "pcs";

        const finalNeed = recipeNeed - inStock;

        if (finalNeed <= 0) return;

        if (!result[department]) result[department] = [];
        result[department].push({
            id: dbId,
            Item: fireItem ? fireItem.Item : normName,
            totalNeed: recipeNeed,
            inStock,
            displayNeed: finalNeed,
            Unit: unit
        });
    });

    const DEPARTMENT_ORDER = ["Produce", "Bakery", "Meat & Fish", "Dairy", "Pantry", "Frozen", "Household", "Other"];
    const sortedResult = {};
    DEPARTMENT_ORDER.forEach(dept => { if (result[dept]) sortedResult[dept] = result[dept]; });
    Object.keys(result).forEach(dept => { if (!sortedResult[dept]) sortedResult[dept] = result[dept]; });
    return sortedResult;
  }, [inventory, recipeIngredients, portions]);

  if (authLoading) return <div className="flex h-screen items-center justify-center"><RefreshCw className="animate-spin text-orange-500"/></div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-sans">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-4">
            <div className={`w-20 h-20 ${THEMES.classic.primary} rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl rotate-6`}><ChefHat className="text-white" size={40} /></div>
            
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Virtuves <span className="text-orange-500">Hub</span></h1>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tava viedā virtuve</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-pasts" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold text-sm focus:outline-none focus:border-orange-500" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parole (min. 6 zīmes)" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold text-sm focus:outline-none focus:border-orange-500" />
            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black uppercase italic tracking-widest hover:bg-orange-500 transition-all active:scale-95 flex items-center justify-center gap-3">
               {loading ? <RefreshCw size={20} className="animate-spin" /> : (isRegistering ? "Reģistrēties" : "Ienākt")}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">
                {isRegistering ? "Jau ir konts? Ienākt" : "Nav konta? Reģistrēties"}
            </button>
          </form>
          {errorMsg && <div className="p-4 bg-red-50 text-red-500 text-xs font-bold rounded-xl">{errorMsg}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative max-w-md mx-auto min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col pb-32 transition-all`}>
      
      {isSettingsOpen && (
        <div className="fixed top-24 left-0 right-0 z-[150] px-6 max-w-md mx-auto animate-in slide-in-from-top-4 pointer-events-none">
          <div className="bg-white border border-slate-100 rounded-[3rem] p-6 shadow-2xl pointer-events-auto relative">
            
            <div className="flex justify-between items-center mb-4 px-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-slate-300">IESTATĪJUMI</h4>
              <button onClick={() => setIsSettingsOpen(false)} className="bg-slate-50 p-2 rounded-full active:scale-90 transition-transform hover:bg-slate-100"><X size={18} className="text-slate-400"/></button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                  <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${theme.bgLight} ${theme.text}`}><User size={20} /></div>
                      <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Lietotājs</p>
                          <h3 className="text-xs font-black italic text-slate-900 leading-tight truncate max-w-[120px]">{user.email}</h3>
                      </div>
                  </div>
                  <button onClick={handleLogout} className="p-3 bg-white text-red-400 hover:text-red-500 rounded-xl shadow-sm border border-slate-100 active:scale-90 transition-all">
                      <LogOut size={18}/>
                  </button>
              </div>

              <div>
                 <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">Krāsu tēma</p>
                 <div className="flex justify-between gap-2">
                    {Object.keys(THEMES).map(k => (
                       <button 
                          key={k} 
                          onClick={() => setCurrentTheme(k)} 
                          className={`flex-1 h-10 rounded-xl border flex items-center justify-center transition-all ${currentTheme === k ? `${THEMES[k].bgLight} ${THEMES[k].border} shadow-sm` : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                       >
                          <div className={`w-3.5 h-3.5 rounded-full ${THEMES[k].primary}`}></div>
                       </button>
                    ))}
                 </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Noklusējuma porcijas</p>
                    <p className="text-[9px] text-slate-300 font-medium">Saimniecības izmērs: {portions}</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setPortions(p=>Math.max(1, p-1))} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90"><Minus size={14}/></button>
                    <span className="w-5 text-center font-black text-lg">{portions}</span>
                    <button onClick={() => setPortions(p=>p+1)} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90"><Plus size={14}/></button>
                    <button onClick={saveDefaultPortions} className={`ml-1 p-2 rounded-xl text-white shadow-md active:scale-90 ${theme.primary}`}><Save size={16}/></button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl relative animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black italic uppercase tracking-tighter">Pievienot preci</h3>
                 <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800"><X size={24}/></button>
              </div>
             <form onSubmit={handleAddCustomItem} className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Preces nosaukums</label>
                    <input type="text" required value={newItem.Item} onChange={e => setNewItem({...newItem, Item: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500" />
                 </div>
                 <div className="flex gap-4">
                    <div className="space-y-1 flex-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Daudzums</label>
                       <input type="number" min="0.1" step="0.1" required value={newItem.Amount} onChange={e => setNewItem({...newItem, Amount: parseFloat(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black italic" />
                    </div>
                    <div className="space-y-1 flex-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Mērvienība</label>
                       <select value={newItem.Unit} onChange={e => setNewItem({...newItem, Unit: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic appearance-none">
                          <option value="pcs">gab</option><option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="pack">paka</option>
                       </select>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Nodaļa</label>
                    <select value={newItem.Department} onChange={e => setNewItem({...newItem, Department: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic appearance-none">
                       <option value="Produce">Dārzeņi/Augļi</option><option value="Dairy">Piena produkti</option><option value="Meat & Fish">Gaļa/Zivis</option><option value="Bakery">Maize</option><option value="Pantry">Bakaleja</option><option value="Frozen">Saldētais</option><option value="Household">Mājsaimniecība</option><option value="Other">Cits</option>
                    </select>
                 </div>
                 <button type="submit" className={`w-full mt-4 p-5 rounded-2xl text-white font-black uppercase italic tracking-widest shadow-lg flex justify-center items-center gap-2 active:scale-95 ${theme.primary}`}>
                    <Plus size={20}/> Pievienot
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* HEADER */}
      <header className="px-6 pt-8 pb-4 flex justify-between items-start z-[110]">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-slate-900">Virtuves<br/><span className={theme.text}>Hub</span></h1>
          <div className="flex items-center gap-1.5 mt-2"><div className={`w-1.5 h-1.5 rounded-full bg-green-500`}></div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">Sinhronizēts</span></div>
        </div>
        
        <div className="flex flex-col items-end gap-3">
           <div className="flex gap-3">
              <button onClick={()=>setIsSettingsOpen(!isSettingsOpen)} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 active:scale-90 border border-slate-100">
                 <Settings size={18} />
              </button>
              <button onClick={loadNotionData} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 active:scale-90 border border-slate-100">
                 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
           </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 pt-0 space-y-6 overflow-y-auto">
        {selectedRecipe ? (
          <div className="space-y-6 animate-in slide-in-from-right">
             <div className="flex items-start gap-4 px-2"><button onClick={() => setSelectedRecipe(null)} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button><div className="flex-1"><p className={`text-[9px] font-black uppercase tracking-widest italic ${theme.text}`}>{selectedRecipe.menuName}</p><h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-tight">{selectedRecipe.name}</h2></div></div>
             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm min-h-[300px] font-medium text-slate-600 whitespace-pre-line leading-relaxed">{selectedRecipe.recipe || "Instrukcijas nav pieejamas."}</div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-6">
            
            <div className="bg-white p-4 px-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl">
                     <User size={18} />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Porciju skaits</p>
                     <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{portions} Cilvēki</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-1">
                  <button onClick={() => setPortions(p=>Math.max(1,p-1))} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90"><Minus size={14}/></button>
                  <button onClick={() => setPortions(p=>p+1)} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90"><Plus size={14}/></button>
                  <button onClick={saveDefaultPortions} className={`ml-1 p-2 rounded-xl text-white shadow-md active:scale-90 ${theme.primary}`}><Save size={14}/></button>
               </div>
            </div>

            <div className="flex items-center justify-between bg-slate-900 p-4 px-6 rounded-[2rem] shadow-lg mb-6 active:scale-[0.99]">
               <button onClick={() => setSelectedDayIndex(i => (i - 1 + 7) % 7)} className="p-2 text-slate-500 hover:text-white">
                  <ChevronLeft size={24} />
               </button>
               <span className={`text-xl font-black italic uppercase tracking-widest ${theme.text}`}>
                  {DAYS[selectedDayIndex]}
               </span>
               <button onClick={() => setSelectedDayIndex(i => (i + 1) % 7)} className="p-2 text-slate-500 hover:text-white">
                  <ChevronRight size={24} />
               </button>
            </div>

            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-full bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group"><div className="flex items-center gap-4"><div className={`p-3 bg-slate-900 text-white rounded-2xl`}><List size={18} /></div><div className="text-left"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ĒDIENKARTE</p><p className="text-sm font-black uppercase italic tracking-tight">{selectedMenu || "Izvēlēties ēdienkarti"}</p></div></div><ChevronDown size={20} className={`text-slate-300 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} /></button>
              {isMenuOpen && (<div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] border border-slate-100 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">{availableMenus.length > 0 ? availableMenus.map(m => (<button key={m} onClick={() => { setSelectedMenu(m); setIsMenuOpen(false); }} className="w-full p-5 text-left text-sm font-black uppercase italic border-b border-slate-50 last:border-0 hover:bg-slate-50">{m}</button>)) : <div className="p-5 text-[10px] font-bold text-slate-400 uppercase italic">Nav ēdienkaršu</div>}</div>)}
            </div>

            <div className="space-y-4">{currentDayPlan.length > 0 ? currentDayPlan.map(m => (<div key={m.id} onClick={() => setSelectedRecipe(m)} className="flex items-center gap-5 p-6 rounded-[2.5rem] border border-slate-100 shadow-sm bg-white cursor-pointer active:scale-[0.98]"><div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${m.type.includes('Breakfast') ? 'bg-amber-50 text-amber-500' : m.type.includes('Lunch') ? 'bg-blue-50 text-blue-500' : 'bg-indigo-50 text-indigo-500'}`}>{m.type.includes('Breakfast') ? <Coffee size={28}/> : m.type.includes('Lunch') ? <Sun size={28}/> : <Moon size={28}/>}</div><div className="flex-1 min-w-0 text-left"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{m.type}</p><h3 className="font-black truncate text-base uppercase italic tracking-tight text-slate-800">{m.name}</h3></div><div className="p-2 bg-slate-50 rounded-xl"><ChevronRight size={16} className="text-slate-300"/></div></div>)) : <div className="p-16 text-center opacity-20 italic font-black text-xs tracking-widest border-2 border-dashed border-slate-200 rounded-[3rem]">Nav plāna</div>}</div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-end px-2"><h2 className="text-3xl font-black italic uppercase tracking-tighter">Grozs</h2><button onClick={handleClearCart} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-600 flex items-center gap-2"><Trash2 size={12}/> Iztīrīt</button></div>
            
            <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-white border border-slate-200 border-dashed p-4 rounded-[2rem] text-slate-400 font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:border-slate-400 active:scale-95 mb-4">
               <Plus size={20}/> Pievienot preci
            </button>

            {Object.keys(groupedItems).length > 0 ? Object.keys(groupedItems).map(d => (
                <div key={d} className="space-y-4">
                    <div className="flex items-center gap-3 px-4"><div className="h-px flex-1 bg-slate-100"></div><h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 italic">{d}</h3><div className="h-px flex-1 bg-slate-100"></div></div>
                    <div className="space-y-2">{groupedItems[d].map(i => (<div key={i.id} onClick={() => setCheckedItems(p => ({ ...p, [i.id]: !p[i.id] }))} className={`p-5 px-7 bg-white border rounded-[1.8rem] flex justify-between items-center shadow-sm cursor-pointer transition-all ${checkedItems[i.id] ? `${theme.border} ${theme.bgLight} opacity-60` : 'border-slate-100'}`}> <div className="flex items-center gap-4">
                                <div className={`p-1.5 rounded-lg border-2 ${checkedItems[i.id] ? `${theme.primary} border-transparent text-white` : 'border-slate-100 text-transparent'}`}><Check size={12} strokeWidth={4}/></div>
                                <div>
                                    <h3 className={`font-black text-[14px] uppercase italic ${checkedItems[i.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{i.Item || "Nezināms"}</h3>
                                </div>
                            </div><div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-2xl ${checkedItems[i.id] ? 'bg-slate-100 text-slate-400' : `${theme.bgLight} ${theme.text} border ${theme.border}`}`}><span className="text-lg font-black italic leading-none">{i.displayNeed.toFixed(0)}</span><span className="text-[10px] font-black uppercase italic tracking-tighter">{i.Unit || "gab"}</span></div></div>))}</div>
                </div>
            )) : (<div className="p-24 flex flex-col items-center opacity-20"><Package size={48} /><p className="italic uppercase font-black text-xs tracking-[0.2em] mt-4">Grozs ir tukšs</p></div>)}
            
            {Object.keys(checkedItems).filter(id => checkedItems[id]).length > 0 && (<div className="pt-4"><button onClick={handleFinishShopping} className={`w-full bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all hover:${theme.primary}`}><CheckCheck size={24}/><div className="text-left"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Pabeigt</p><p className="text-lg font-black uppercase italic leading-none">Iepirkšanos</p></div></button></div>)}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 left-0 right-0 z-[100] px-6 max-w-md mx-auto pointer-events-none">
        <nav className="bg-slate-900 border border-white/5 p-2 rounded-[2.5rem] flex items-center justify-around shadow-2xl pointer-events-auto">
          <button onClick={() => { setActiveTab('dashboard'); setSelectedRecipe(null); }} className={`flex items-center justify-center gap-3 py-4 rounded-[1.8rem] transition-all flex-1 ${activeTab === 'dashboard' ? `${theme.primary} text-white` : 'text-slate-500'}`}><LayoutDashboard size={20}/></button>
          <button onClick={() => { setActiveTab('inventory'); setSelectedRecipe(null); }} className={`flex items-center justify-center gap-3 py-4 rounded-[1.8rem] transition-all flex-1 ${activeTab === 'inventory' ? `${theme.primary} text-white` : 'text-slate-500'}`}><ShoppingCart size={20}/></button>
        </nav>
      </div>
    </div>
  );
}