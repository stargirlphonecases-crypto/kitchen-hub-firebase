import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, LayoutDashboard, RefreshCw, Minus, Plus, X, 
  Sun, Moon, Coffee, ArrowLeft, 
  List, ChevronDown, Package, Check, Trash2, CheckCheck, ChefHat,
  Settings, LogOut, User, ChevronRight, ChevronLeft, Save, Palette
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, addDoc, query } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// --- CONFIGURATION (SECURE NETLIFY VERSION) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "smart-kitchen-hub-26f94.firebaseapp.com",
  projectId: "smart-kitchen-hub-26f94",
  storageBucket: "smart-kitchen-hub-26f94.firebasestorage.app",
  messagingSenderId: "881105921492",
  appId: "1:881105921492:web:92537fd42f1c4f16666241"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CONFIG = {
  apiKey: import.meta.env.VITE_NOTION_API_KEY,
  ingredientsDbId: import.meta.env.VITE_INGREDIENTS_DB_ID,
  mealPlansDbId: import.meta.env.VITE_MEAL_PLANS_DB_ID,
  // CRITICAL: Using Netlify Proxy to bypass CORS
  baseUrl: "/api/notion"
};

const THEMES = {
  classic: { name: "Classic", primary: "bg-orange-500", text: "text-orange-500", border: "border-orange-200", bgLight: "bg-orange-50" },
  mint: { name: "Mint", primary: "bg-teal-500", text: "text-teal-500", border: "border-teal-200", bgLight: "bg-teal-50" },
  lavender: { name: "Lavender", primary: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-200", bgLight: "bg-indigo-50" },
  sunny: { name: "Sunny", primary: "bg-amber-500", text: "text-amber-500", border: "border-amber-200", bgLight: "bg-amber-50" }
};

// --- NOTION API SERVICE ---
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
      console.error(`Notion Error:`, error);
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

  getSafeNumber: (p) => p?.type === 'number' ? (p.number || 0) : p?.type === 'formula' ? (p.formula.number || 0) : 0
};

export default function App() {
  const [user, setUser] = useState(null);
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const theme = THEMES[currentTheme];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    localStorage.setItem('appTheme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) loadNotionData();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return; 
    const q = query(collection(db, "inventory"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setInventory(items);
    });
    return () => unsubscribe();
  }, [user]);

  const loadNotionData = async () => {
    if (!CONFIG.apiKey) return;
    setLoading(true);
    try {
      const [ingData, mealData] = await Promise.all([
          NotionService.requestAll(CONFIG.ingredientsDbId),
          NotionService.requestAll(CONFIG.mealPlansDbId)
      ]);

      setRecipeIngredients(ingData.results.map(page => ({
        id: page.id,
        Item: page.properties.Item?.title?.[0]?.plain_text || "",
        BaseAmount: NotionService.getSafeNumber(page.properties["Amount"]),
        Unit: page.properties.Unit?.select?.name || "pcs",
        forMeals: page.properties["Meal Plans"]?.relation?.map(r => r.id) || []
      })));

      const meals = mealData.results.map(page => {
        const p = page.properties;
        return {
          id: page.id,
          isActive: p["Active"]?.checkbox || false,
          menuName: p["Meal Plan"]?.rich_text?.[0]?.plain_text || "Standard",
          day: p.Day?.select?.name || "Monday",
          type: p.Type?.select?.name || "Other",
          name: p.Name?.title?.[0]?.plain_text || "Meal",
          recipe: p.Recipe?.rich_text?.[0]?.plain_text || "",
          order: NotionService.getSafeNumber(p["Status"])
        };
      });

      setAllMeals(meals);
      const menus = [...new Set(meals.map(m => m.menuName))];
      setAvailableMenus(menus);
      if (!selectedMenu && meals.length > 0) {
        const active = meals.find(m => m.isActive);
        setSelectedMenu(active ? active.menuName : meals[0].menuName);
      }
    } catch (err) { setErrorMsg(`Data Error: ${err.message}`); } 
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await signOut(auth); setInventory([]); setIsSettingsOpen(false); };

  const currentDayPlan = useMemo(() => {
    return allMeals
      .filter(m => m.day.toLowerCase().includes(DAYS[selectedDayIndex].toLowerCase()) && (selectedMenu ? m.menuName === selectedMenu : true))
      .sort((a,b) => (a.order || 99) - (b.order || 99));
  }, [allMeals, selectedDayIndex, selectedMenu]);

  const groupedItems = useMemo(() => {
    const activeMealIds = allMeals.filter(m => m.menuName === selectedMenu).map(m => m.id);
    const totals = {};
    recipeIngredients.forEach(ri => {
        if (ri.forMeals?.some(id => activeMealIds.includes(id))) {
          const key = ri.Item.trim().toLowerCase();
          totals[key] = (totals[key] || 0) + ri.BaseAmount;
        }
    });

    const result = {};
    const allNames = new Set([...Object.keys(totals), ...inventory.map(i => i.Item.toLowerCase())]);

    allNames.forEach(name => {
        const need = (totals[name] || 0) * portions;
        const fire = inventory.find(i => i.Item.toLowerCase() === name);
        const stock = fire?.inStock || 0;
        const diff = need - stock;
        if (diff <= 0) return;
        const dept = fire?.Department || "Other";
        if (!result[dept]) result[dept] = [];
        result[dept].push({ id: fire?.id || `v_${name}`, Item: fire?.Item || name, displayNeed: diff, Unit: fire?.Unit || "pcs" });
    });
    return result;
  }, [inventory, recipeIngredients, portions, selectedMenu, allMeals]);

  if (!user) return <div className="h-screen flex items-center justify-center font-black italic uppercase">Please log in via Firebase...</div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col pb-32">
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full rounded-[3rem] p-8 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black italic uppercase tracking-tighter">Settings</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-slate-300"><X size={24}/></button>
             </div>
             <button onClick={handleLogout} className="w-full p-4 text-red-400 font-black uppercase italic text-xs flex items-center justify-center gap-2 bg-red-50 rounded-2xl">Log Out</button>
          </div>
        </div>
      )}

      <header className="p-8 pb-4 flex justify-between items-start">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Kitchen<br/><span className={theme.text}>Hub</span></h1>
        <div className="flex gap-2">
           <button onClick={() => setIsSettingsOpen(true)} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400"><Settings size={20}/></button>
           <button onClick={loadNotionData} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
        </div>
      </header>

      <main className="flex-1 px-6 space-y-6 overflow-y-auto">
        {selectedRecipe ? (
          <div className="space-y-6">
             <button onClick={() => setSelectedRecipe(null)} className="flex items-center gap-2 font-black text-slate-300 uppercase text-[10px] italic"><ArrowLeft size={16}/> Back</button>
             <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">{selectedRecipe.name}</h2>
             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">{selectedRecipe.recipe || "No instructions provided."}</div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900 p-4 px-6 rounded-[2rem] shadow-lg">
               <button onClick={() => setSelectedDayIndex(i => (i-1+7)%7)} className="p-2 text-slate-500"><ChevronLeft/></button>
               <span className={`text-xl font-black italic uppercase tracking-widest ${theme.text}`}>{DAYS[selectedDayIndex]}</span>
               <button onClick={() => setSelectedDayIndex(i => (i+1)%7)} className="p-2 text-slate-500"><ChevronRight/></button>
            </div>
            
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-full bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center font-black uppercase italic tracking-tight">
               <span>{selectedMenu || "Select Menu"}</span>
               <ChevronDown size={18}/>
            </button>
            {isMenuOpen && (
               <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xl">
                  {availableMenus.map(m => (
                    <button key={m} onClick={() => { setSelectedMenu(m); setIsMenuOpen(false); }} className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 font-bold uppercase italic text-xs last:border-0">{m}</button>
                  ))}
               </div>
            )}

            {currentDayPlan.map(m => (
               <div key={m.id} onClick={() => setSelectedRecipe(m)} className="flex items-center gap-5 p-6 rounded-[2.5rem] border border-slate-100 shadow-sm bg-white cursor-pointer active:scale-95 transition-all">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 ${theme.text}`}><Coffee size={24}/></div>
                  <div className="flex-1 min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-slate-300">{m.type}</p><h3 className="font-black truncate text-base uppercase italic tracking-tight">{m.name}</h3></div>
                  <ChevronRight size={16} className="text-slate-200"/>
               </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter px-2">Cart</h2>
            {Object.keys(groupedItems).map(d => (
              <div key={d} className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-4 italic">{d}</p>
                {groupedItems[d].map(i => (
                  <div key={i.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center shadow-sm">
                    <h3 className="font-black text-sm uppercase italic text-slate-700">{i.Item}</h3>
                    <div className={`${theme.bgLight} ${theme.text} px-3 py-1 rounded-xl text-xs font-black italic`}>{i.displayNeed.toFixed(1)} {i.Unit}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-0 right-0 z-[100] px-8 max-w-md mx-auto pointer-events-none">
        <div className="bg-slate-900 p-2 rounded-[2.5rem] flex items-center justify-around shadow-2xl pointer-events-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center justify-center py-5 rounded-[2rem] flex-1 ${activeTab === 'dashboard' ? `${theme.primary} text-white shadow-lg` : 'text-slate-500'}`}><LayoutDashboard size={22}/></button>
          <button onClick={() => setActiveTab('cart')} className={`flex items-center justify-center py-5 rounded-[2rem] flex-1 ${activeTab === 'cart' ? `${theme.primary} text-white shadow-lg` : 'text-slate-500'}`}><ShoppingCart size={22}/></button>
        </div>
      </nav>
    </div>
  );
}