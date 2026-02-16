import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, LayoutDashboard, RefreshCw, Minus, Plus, X, 
  Sun, Moon, Coffee, ArrowLeft, 
  List, ChevronDown, Package, Check, Trash2, CheckCheck, ChefHat,
  Settings, LogOut, User, ChevronRight, ChevronLeft, Save, Palette, Share2, Copy,
  Refrigerator, Search, Flame, CalendarX
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, addDoc, query, getDoc, deleteDoc, writeBatch
} from "firebase/firestore";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
// Izmantojam tiešās atslēgas stabilitātei
const firebaseConfig = {
  apiKey: "AIzaSyBBiSn47hrseyNZHpvAMpk4LUJ7a0xMgYg",
  authDomain: "smart-kitchen-hub-26f94.firebaseapp.com",
  projectId: "smart-kitchen-hub-26f94",
  storageBucket: "smart-kitchen-hub-26f94.firebasestorage.app",
  messagingSenderId: "881105921492",
  appId: "1:881105921492:web:92537fd42f1c4f16666241"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- NOTION CONFIGURATION ---
const CONFIG = {
  apiKey: "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",
  ingredientsDbId: "2d8c827236ec806d9b6dee100778aa65",
  mealPlansDbId: "2d8c827236ec8015b2add085f2655a8e",
  // SALABOTS: Izmantojam Netlify tuneli priekš produkcijas
  baseUrl: "/api/notion" 
};

const THEMES = {
  classic: { name: "Classic", primary: "bg-orange-500", text: "text-orange-500", border: "border-orange-200", bgLight: "bg-orange-50", hover: "hover:bg-orange-50" },
  mint: { name: "Mint", primary: "bg-teal-500", text: "text-teal-500", border: "border-teal-200", bgLight: "bg-teal-50", hover: "hover:bg-teal-50" },
  lavender: { name: "Lavender", primary: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-200", bgLight: "bg-indigo-50", hover: "hover:bg-indigo-50" },
  sunny: { name: "Sunny", primary: "bg-amber-500", text: "text-amber-500", border: "border-amber-200", bgLight: "bg-amber-50", hover: "hover:bg-amber-50" },
  rose: { name: "Rose", primary: "bg-rose-500", text: "text-rose-500", border: "border-rose-200", bgLight: "bg-rose-50", hover: "hover:bg-rose-50" }
};

// --- API SERVICES ---
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
          menuName: p["Meal Plan"]?.rich_text?.[0]?.plain_text || "Standard",
          day: DAY_MAP[rawDay] || "Monday", 
          type: p.Type?.select?.name || "Other",
          name: titleProp?.title?.[0]?.plain_text || "Meal",
          recipe: getName("Recipe") || "",
          order: this.getSafeNumber(p["Status"])
        };
      });
    } catch (e) { throw new Error(`Meal Plan: ${e.message}`); }
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [inventory, setInventory] = useState([]); 
  const [completedMeals, setCompletedMeals] = useState([]); // JAUNS: Saraksts ar apēstajām maltītēm
  
  const [recipeIngredients, setRecipeIngredients] = useState([]); 
  const [allMeals, setAllMeals] = useState([]); 
  
  const [availableMenus, setAvailableMenus] = useState([]); 
  const [selectedMenu, setSelectedMenu] = useState(null); 
  
  const [portions, setPortions] = useState(() => parseInt(localStorage.getItem('defaultPortions') || "1")); 
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('appTheme') || 'classic');

  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  
  const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ Item: "", Amount: 1, Unit: "pcs", Department: "Other" });
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const theme = THEMES[currentTheme];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => { localStorage.setItem('appTheme', currentTheme); }, [currentTheme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setHouseholdId(userDocSnap.data().householdId);
          } else {
            await setDoc(userDocRef, { email: currentUser.email, householdId: currentUser.uid });
            setHouseholdId(currentUser.uid);
          }
          loadNotionData();
        } catch (e) {
          console.error("Profile Error:", e);
          setErrorMsg("Failed to load user profile.");
        }
      } else {
        setHouseholdId(null);
        setInventory([]);
        setCompletedMeals([]);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DATA LISTENERS ---
  useEffect(() => {
    if (!user || !householdId) return; 
    
    // 1. Klausāmies inventāru
    const inventoryRef = collection(db, "households", householdId, "inventory");
    const unsubInv = onSnapshot(inventoryRef, (querySnapshot) => {
      const items = [];
      querySnapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setInventory(items);
    }, (error) => setErrorMsg("Inventory sync failed."));

    // 2. Klausāmies pabeigtās maltītes (JAUNS)
    const completedRef = collection(db, "households", householdId, "completedMeals");
    const unsubCompleted = onSnapshot(completedRef, (querySnapshot) => {
      const meals = [];
      querySnapshot.forEach((doc) => meals.push(doc.data().mealId));
      setCompletedMeals(meals);
    }, (error) => console.error("Completed meals sync failed"));

    return () => { unsubInv(); unsubCompleted(); };
  }, [user, householdId]);

  // --- MASTER LIST FOR AUTOCOMPLETE ---
  const masterItemList = useMemo(() => {
    const itemsMap = new Map();
    recipeIngredients.forEach(ri => {
        const name = (ri.Item || "").trim();
        if (name) itemsMap.set(name.toLowerCase(), { name: name, unit: ri.Unit || "pcs", dept: "Other" });
    });
    inventory.forEach(inv => {
        const name = (inv.Item || "").trim();
        if (name) {
            const key = name.toLowerCase();
            const existing = itemsMap.get(key);
            if (existing) itemsMap.set(key, { ...existing, dept: inv.Department || existing.dept });
            else itemsMap.set(key, { name: name, unit: inv.Unit || "pcs", dept: inv.Department || "Other" });
        }
    });
    return Array.from(itemsMap.values());
  }, [recipeIngredients, inventory]);

  const handleItemNameChange = (e) => {
      const val = e.target.value;
      setNewItem({ ...newItem, Item: val });
      if (val.length > 1) {
          const matches = masterItemList.filter(i => i.name.toLowerCase().includes(val.toLowerCase()));
          setSuggestions(matches);
          setShowSuggestions(true);
      } else { setShowSuggestions(false); }
  };

  const selectSuggestion = (suggestion) => {
      setNewItem({ ...newItem, Item: suggestion.name, Unit: suggestion.unit, Department: suggestion.dept });
      setShowSuggestions(false);
  };

  const handleJoinHousehold = async () => {
    if (!joinCodeInput.trim()) return;
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { householdId: joinCodeInput.trim() });
      setHouseholdId(joinCodeInput.trim());
      alert("Joined new household successfully!");
      setJoinCodeInput("");
    } catch (e) { alert("Error: " + e.message); } finally { setLoading(false); }
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(user.uid); alert("Copied!"); };

  const loadNotionData = async () => {
    setLoading(true);
    try {
      const [ingredients, meals] = await Promise.all([ NotionService.getRecipeIngredients(), NotionService.getMealPlan() ]);
      setRecipeIngredients(ingredients);
      setAllMeals(meals);
      const menus = [...new Set(meals.map(m => m.menuName))];
      setAvailableMenus(menus);
      if (meals.length > 0) {
        const active = meals.find(m => m.isActive);
        if (active && !selectedMenu) setSelectedMenu(active.menuName);
      }
    } catch (err) { setErrorMsg(`Notion Error: ${err.message}`); } 
    finally { setLoading(false); }
  };

  const handleAuth = async (e) => {
    e.preventDefault(); setErrorMsg(null); setLoading(true);
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { setErrorMsg(error.message); } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await signOut(auth); setInventory([]); setAllMeals([]); setIsSettingsOpen(false);
    setIsMenuOpen(false); setSelectedRecipe(null); setActiveTab('dashboard');
  };

  const handleAddCustomItem = async (e) => {
    e.preventDefault();
    if(!newItem.Item.trim() || !householdId) return;
    setIsAddModalOpen(false); setLoading(true); setShowSuggestions(false);
    try {
      const existing = inventory.find(i => i.Item.toLowerCase() === newItem.Item.toLowerCase());
      const isFridgeTab = activeTab === 'fridge';
      const changeAmount = isFridgeTab ? Math.abs(newItem.Amount) : -Math.abs(newItem.Amount);

      if (existing) {
        const itemRef = doc(db, "households", householdId, "inventory", existing.id);
        const newStock = (existing.inStock || 0) + changeAmount;
        await updateDoc(itemRef, { inStock: newStock });
      } else {
        const invCol = collection(db, "households", householdId, "inventory");
        await addDoc(invCol, { ...newItem, inStock: changeAmount });
      }
      setNewItem({ Item: "", Amount: 1, Unit: "pcs", Department: "Other" });
    } catch (err) { console.error(err); setErrorMsg("Error saving item."); } finally { setLoading(false); }
  };

  const handleFinishShopping = async () => {
    const idsToUpdate = Object.keys(checkedItems).filter(id => checkedItems[id]);
    if (idsToUpdate.length === 0 || !householdId) return;
    setLoading(true);
    try {
      const batchPromises = idsToUpdate.map(async (id) => {
        const isVirtual = id.toString().startsWith("virtual_");
        let item = null;
        let normName = "";

        if (isVirtual) {
            normName = id.replace("virtual_", "");
            const recipeInfo = recipeIngredients.find(ri => (ri.Item || "").trim().toLowerCase() === normName);
            item = {
                Item: recipeInfo ? recipeInfo.Item : normName,
                Unit: recipeInfo ? recipeInfo.Unit : "pcs",
                Department: "Other",
                inStock: 0
            };
        } else {
            item = inventory.find(i => i.id === id);
            if (item) normName = (item.Item || "").trim().toLowerCase();
        }

        if (!item && !isVirtual) return;

        // SVARĪGI: Šeit mēs neņemam vērā "Completed" statusu, jo ja Tu to pērc, tātad vajag.
        const totalRecipeNeed = recipeIngredients
            .filter(ri => (ri.Item || "").trim().toLowerCase() === normName)
            .reduce((sum, ri) => sum + ri.BaseAmount, 0) * portions;

        let newStock = totalRecipeNeed > 0 ? totalRecipeNeed : 0;
        if (!isVirtual && (item.inStock || 0) > newStock) newStock = item.inStock;

        if (isVirtual) {
            const invCol = collection(db, "households", householdId, "inventory");
            await addDoc(invCol, { Item: item.Item, Unit: item.Unit, Department: item.Department, inStock: newStock });
        } else {
            const itemRef = doc(db, "households", householdId, "inventory", id);
            await updateDoc(itemRef, { inStock: newStock });
        }
      });
      await Promise.all(batchPromises); setCheckedItems({});
    } catch (err) { setErrorMsg(err.message); } finally { setLoading(false); }
  };

  // --- COOKING LOGIC: DEDUCT & MARK AS DONE ---
  const handleCookMeal = async () => {
    if (!selectedRecipe || !householdId) return;
    if (!confirm(`Vai tiešām pagatavoji "${selectedRecipe.name}"? Produkti tiks noņemti un maltīte atzīmēta kā pabeigta.`)) return;
    
    setLoading(true);
    try {
      // 1. MARK AS DONE (Pievienojam ID pie pabeigtajiem)
      const completedCol = collection(db, "households", householdId, "completedMeals");
      await addDoc(completedCol, { mealId: selectedRecipe.id, date: new Date().toISOString() });

      // 2. DEDUCT INGREDIENTS
      const ingredientsToDeduct = recipeIngredients.filter(i => i.forMeals && i.forMeals.includes(selectedRecipe.id));
      const batchPromises = ingredientsToDeduct.map(async (ri) => {
          const normName = (ri.Item || "").trim().toLowerCase();
          const amountToDeduct = ri.BaseAmount * portions;
          const fireItem = inventory.find(i => (i.Item || "").trim().toLowerCase() === normName);
          
          if (fireItem) {
              const itemRef = doc(db, "households", householdId, "inventory", fireItem.id);
              const newStock = (fireItem.inStock || 0) - amountToDeduct;
              await updateDoc(itemRef, { inStock: newStock });
          } else {
              const invCol = collection(db, "households", householdId, "inventory");
              await addDoc(invCol, { Item: ri.Item, Unit: ri.Unit || "pcs", Department: "Other", inStock: -amountToDeduct });
          }
      });

      await Promise.all(batchPromises);
      alert("Labu apetīti! 🍽️ Maltīte pabeigta.");
      setSelectedRecipe(null);
    } catch (e) { console.error(e); setErrorMsg("Kļūda reģistrējot gatavošanu."); } finally { setLoading(false); }
  };

  // --- RESET WEEK LOGIC ---
  const handleResetWeek = async () => {
      if(!householdId || !confirm("Vai tiešām sākt jaunu nedēļu? Visas atzīmes 'Pagatavots' tiks dzēstas.")) return;
      setLoading(true);
      try {
          const completedRef = collection(db, "households", householdId, "completedMeals");
          // Firebase prasa dzēst pa vienam (vai batch, bet vienkāršāk pa vienam lasīt un dzēst)
          // Tā kā šis ir klienta kods, mēs vienkārši dzēšam visu kolekciju manuāli
          // Šis ir dārgs process, ja ir daudz ierakstu, bet ģimenei ar 20 maltītēm ir OK.
          const snapshot = await import("firebase/firestore").then(m => m.getDocs(completedRef));
          const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          alert("Jauna nedēļa sākta! 🗓️");
          setIsSettingsOpen(false);
      } catch (e) { setErrorMsg("Kļūda atiestatot nedēļu."); } finally { setLoading(false); }
  };

  const updateStock = async (id, delta) => {
    if (!householdId) return;
    const item = inventory.find(i => i.id === id);
    if (item) {
        const itemRef = doc(db, "households", householdId, "inventory", id);
        const newStock = (item.inStock || 0) + delta;
        await updateDoc(itemRef, { inStock: newStock });
    }
  };
  
  const handleClearCart = async () => { setCheckedItems({}); };
  const saveDefaultPortions = () => { localStorage.setItem('defaultPortions', portions.toString()); alert("Saved!"); };

  const currentDayPlan = useMemo(() => {
    return allMeals.filter(m => m.day === DAYS[selectedDayIndex] && (selectedMenu ? m.menuName === selectedMenu : true)).sort((a,b) => (a.order || 99) - (b.order || 99));
  }, [allMeals, selectedDayIndex, selectedMenu]);

  const selectedRecipeIngredients = useMemo(() => {
    if (!selectedRecipe) return [];
    return recipeIngredients
        .filter(ri => ri.forMeals && ri.forMeals.includes(selectedRecipe.id))
        .map(ri => ({ ...ri, totalAmount: ri.BaseAmount * portions }));
  }, [selectedRecipe, recipeIngredients, portions]);

 // --- GUDRĀ MATEMĀTIKA (AR COMPLETED CHECKS) ---
 const groupedItems = useMemo(() => {
    // 1. Filtrējam aktīvās receptes (Tikai tās, kas NAV completed)
    const activeMealIds = allMeals
        .filter(m => m.menuName === selectedMenu && !completedMeals.includes(m.id)) // SVARĪGI: Ignorējam pabeigtās!
        .map(m => m.id);

    const ingredientsTotals = {};
    recipeIngredients.forEach(ri => {
        // Skaitām tikai, ja recepte vēl nav pagatavota
        const isRelevant = ri.forMeals && ri.forMeals.some(id => activeMealIds.includes(id));
        if (isRelevant) {
            const normName = (ri.Item || "").trim().toLowerCase();
            if (!ingredientsTotals[normName]) ingredientsTotals[normName] = 0;
            ingredientsTotals[normName] += ri.BaseAmount;
        }
    });

    const allItemNames = new Set([...Object.keys(ingredientsTotals), ...inventory.map(i => (i.Item || "").trim().toLowerCase())]);
    const result = {};
    allItemNames.forEach(normName => {
        const recipeNeed = (ingredientsTotals[normName] || 0) * portions;
        const fireItem = inventory.find(i => (i.Item || "").trim().toLowerCase() === normName);
        const inStock = fireItem ? (fireItem.inStock || 0) : 0;
        const finalNeed = recipeNeed - inStock;
        
        if (finalNeed <= 0.1) return; 

        const department = fireItem?.Department || "Other";
        if (!result[department]) result[department] = [];
        result[department].push({
            id: fireItem ? fireItem.id : `virtual_${normName}`,
            Item: fireItem ? fireItem.Item : normName,
            displayNeed: finalNeed,
            Unit: fireItem?.Unit || recipeIngredients.find(r => r.Item.toLowerCase() === normName)?.Unit || "pcs"
        });
    });
    const DEPARTMENT_ORDER = ["Produce", "Bakery", "Meat & Fish", "Dairy", "Pantry", "Frozen", "Household", "Other"];
    const sortedResult = {};
    DEPARTMENT_ORDER.forEach(dept => { if (result[dept]) sortedResult[dept] = result[dept]; });
    Object.keys(result).forEach(dept => { if (!sortedResult[dept]) sortedResult[dept] = result[dept]; });
    return sortedResult;
  }, [inventory, recipeIngredients, portions, allMeals, selectedMenu, completedMeals]);

  const fridgeItems = useMemo(() => {
      return inventory.filter(i => (i.inStock || 0) > 0).sort((a,b) => (a.Department || "").localeCompare(b.Department || ""));
  }, [inventory]);

  if (authLoading) return <div className="flex h-screen items-center justify-center"><RefreshCw className="animate-spin text-orange-500"/></div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-sans">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-4">
            <div className={`w-20 h-20 ${THEMES.classic.primary} rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl rotate-6`}><ChefHat className="text-white" size={40} /></div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Kitchen <span className="text-orange-500">Hub</span></h1>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Your Smart Kitchen</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold text-sm focus:outline-none focus:border-orange-500" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold text-sm focus:outline-none focus:border-orange-500" />
            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black uppercase italic tracking-widest hover:bg-orange-500 transition-all active:scale-95 flex items-center justify-center gap-3">
               {loading ? <RefreshCw size={20} className="animate-spin" /> : (isRegistering ? "Sign Up" : "Sign In")}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">
                {isRegistering ? "Have an account? Sign In" : "Need an account? Sign Up"}
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
          <div className="bg-white border border-slate-100 rounded-[3rem] p-6 shadow-2xl pointer-events-auto relative max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 px-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-slate-300">SETTINGS</h4>
              <button onClick={() => setIsSettingsOpen(false)} className="bg-slate-50 p-2 rounded-full active:scale-90 transition-transform hover:bg-slate-100"><X size={18} className="text-slate-400"/></button>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                  <div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl ${theme.bgLight} ${theme.text}`}><User size={20} /></div><div className="min-w-0"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">User</p><h3 className="text-xs font-black italic text-slate-900 leading-tight truncate max-w-[120px]">{user.email}</h3></div></div>
                  <button onClick={handleLogout} className="p-3 bg-white text-red-400 hover:text-red-500 rounded-xl shadow-sm border border-slate-100 active:scale-90 transition-all" title="Sign Out"><LogOut size={18}/></button>
              </div>
              <div className="space-y-3">
                 <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2">Household Sharing</p>
                 <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">My Household Code</p>
                    <div className="flex items-center gap-2"><code className="flex-1 bg-white/10 p-2 rounded-lg text-xs font-mono truncate">{user.uid}</code><button onClick={copyToClipboard} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 active:scale-90"><Copy size={14}/></button></div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Join a Household</p><div className="flex gap-2"><input type="text" placeholder="Paste code here..." value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-400"/><button onClick={handleJoinHousehold} className={`px-4 rounded-xl text-white font-bold text-[10px] uppercase tracking-widest shadow-md active:scale-95 ${theme.primary}`}>Join</button></div></div>
              </div>
              
              {/* --- JAUNA POGA: RESET WEEK --- */}
              <div>
                 <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">Plan Management</p>
                 <button onClick={handleResetWeek} className="w-full p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between group active:scale-95 transition-all hover:bg-red-50 hover:border-red-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-red-100 group-hover:text-red-500"><CalendarX size={20}/></div>
                        <div className="text-left"><h3 className="text-sm font-black uppercase italic text-slate-700 group-hover:text-red-600">Sākt Jaunu Nedēļu</h3><p className="text-[9px] font-bold text-slate-300 group-hover:text-red-300">Dzēst visus 'Pagatavots' statusus</p></div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-red-400"/>
                 </button>
              </div>

              <div>
                 <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">Appearance & Plan</p>
                 <div className="flex justify-between gap-2 mb-3">{Object.keys(THEMES).map(k => (<button key={k} onClick={() => setCurrentTheme(k)} className={`flex-1 h-10 rounded-xl border flex items-center justify-center transition-all ${currentTheme === k ? `${THEMES[k].bgLight} ${THEMES[k].border} shadow-sm ring-1 ring-offset-1 ring-slate-100` : 'bg-white border-slate-100 hover:bg-slate-50'}`}><div className={`w-3.5 h-3.5 rounded-full ${THEMES[k].primary}`}></div></button>))}</div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between"><div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Family Size</p><p className="text-[9px] text-slate-300 font-medium">{portions} People</p></div><div className="flex items-center gap-2"><button onClick={() => setPortions(p=>Math.max(1, p-1))} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Minus size={14}/></button><span className="w-5 text-center font-black text-lg">{portions}</span><button onClick={() => setPortions(p=>p+1)} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Plus size={14}/></button><button onClick={saveDefaultPortions} className={`ml-1 p-2 rounded-xl text-white shadow-md active:scale-90 transition-transform ${theme.primary}`}><Save size={16}/></button></div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl relative animate-in slide-in-from-bottom-4 pointer-events-auto">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black italic uppercase tracking-tighter">Add to {activeTab === 'fridge' ? 'Fridge' : 'Cart'}</h3><button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800"><X size={24}/></button></div>
             <form onSubmit={handleAddCustomItem} className="space-y-4">
                 <div className="space-y-1 relative">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Item Name</label>
                    <input type="text" required value={newItem.Item} onChange={handleItemNameChange} placeholder="Start typing..." className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500" />
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
                    <div className="space-y-1 flex-1"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Amount</label><input type="number" min="0.1" step="0.1" required value={newItem.Amount} onChange={e => setNewItem({...newItem, Amount: parseFloat(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black italic focus:outline-none focus:border-orange-500" /></div>
                    <div className="space-y-1 flex-1"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Unit</label><select value={newItem.Unit} onChange={e => setNewItem({...newItem, Unit: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500 appearance-none"><option value="pcs">pcs</option><option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="pack">pack</option></select></div>
                 </div>
                 <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Department</label><select value={newItem.Department} onChange={e => setNewItem({...newItem, Department: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold italic focus:outline-none focus:border-orange-500 appearance-none"><option value="Produce">Produce</option><option value="Dairy">Dairy</option><option value="Meat & Fish">Meat & Fish</option><option value="Bakery">Bakery</option><option value="Pantry">Pantry</option><option value="Frozen">Frozen</option><option value="Household">Household</option><option value="Other">Other</option></select></div>
                 <button type="submit" className={`w-full mt-4 p-5 rounded-2xl text-white font-black uppercase italic tracking-widest shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-all ${theme.primary}`}><Plus size={20}/> {activeTab === 'fridge' ? 'Add to Fridge' : 'Add to Cart'}</button>
              </form>
           </div>
        </div>
      )}

      <header className="px-6 pt-8 pb-4 flex justify-between items-start z-[110]">
        <div><h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-slate-900">Kitchen<br/><span className={theme.text}>Hub</span></h1><div className="flex items-center gap-1.5 mt-2"><div className={`w-1.5 h-1.5 rounded-full bg-green-500`}></div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">Synced</span></div></div>
        <div className="flex flex-col items-end gap-3"><div className="flex gap-3"><button onClick={()=>setIsSettingsOpen(!isSettingsOpen)} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 active:scale-90 transition-all border border-slate-100"><Settings size={18} /></button><button onClick={loadNotionData} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 active:scale-90 transition-all border border-slate-100"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div></div>
      </header>

      <main className="flex-1 p-6 pt-0 space-y-6 overflow-y-auto">
        {selectedRecipe ? (
          <div className="space-y-6 animate-in slide-in-from-right">
             <div className="flex items-start gap-4 px-2"><button onClick={() => setSelectedRecipe(null)} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button><div className="flex-1"><p className={`text-[9px] font-black uppercase tracking-widest italic ${theme.text}`}>{selectedRecipe.menuName}</p><h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-tight">{selectedRecipe.name}</h2></div></div>
             
             {/* Sastāvdaļu Saraksts */}
             <div className="space-y-3">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-2">Sastāvdaļas</h3>
               {selectedRecipeIngredients.length > 0 ? selectedRecipeIngredients.map(i => (
                  <div key={i.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                     <span className="font-bold text-sm text-slate-700">{i.Item}</span>
                     <span className="text-xs font-black bg-slate-50 px-2 py-1 rounded-lg text-slate-400">
                        {Number(i.totalAmount.toFixed(1))} {i.Unit}
                     </span>
                  </div>
               )) : <div className="p-4 text-center text-xs font-bold text-slate-300 italic">Nav sastāvdaļu saraksta</div>}
             </div>

             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm min-h-[300px] font-medium text-slate-600 whitespace-pre-line leading-relaxed">{selectedRecipe.recipe || "Instructions not available."}</div>
             
             {/* Poga: Rāda, ja vēl nav gatavs */}
             {!completedMeals.includes(selectedRecipe.id) ? (
                 <button onClick={handleCookMeal} className={`w-full p-6 rounded-[2.5rem] text-white shadow-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all bg-slate-900 hover:${theme.primary}`}>
                    <ChefHat size={28} />
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Maltīte</p>
                        <p className="text-xl font-black uppercase italic leading-none">Pagatavots</p>
                    </div>
                 </button>
             ) : (
                 <div className="w-full p-6 rounded-[2.5rem] bg-green-50 border border-green-100 text-green-600 flex items-center justify-center gap-3 shadow-inner">
                    <CheckCheck size={24}/>
                    <span className="font-black uppercase italic tracking-wider">Maltīte jau izbaudīta</span>
                 </div>
             )}
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="bg-white p-4 px-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><User size={18} /></div><div className="text-left"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Serving Size</p><p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{portions} People</p></div></div><div className="flex items-center gap-1"><button onClick={() => setPortions(p=>Math.max(1,p-1))} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Minus size={14}/></button><button onClick={() => setPortions(p=>p+1)} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 hover:bg-slate-100"><Plus size={14}/></button><button onClick={saveDefaultPortions} className={`ml-1 p-2 rounded-xl text-white shadow-md active:scale-90 transition-transform ${theme.primary}`}><Save size={14}/></button></div></div>
            <div className="flex items-center justify-between bg-slate-900 p-4 px-6 rounded-[2rem] shadow-lg mb-6 active:scale-[0.99] transition-transform"><button onClick={() => setSelectedDayIndex(i => (i - 1 + 7) % 7)} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={24} /></button><span className={`text-xl font-black italic uppercase tracking-widest ${theme.text}`}>{DAYS[selectedDayIndex]}</span><button onClick={() => setSelectedDayIndex(i => (i + 1) % 7)} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronRight size={24} /></button></div>
            <div className="relative"><button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-full bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98]"><div className="flex items-center gap-4"><div className={`p-3 bg-slate-900 text-white rounded-2xl`}><List size={18} /></div><div className="text-left"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">MENU</p><p className="text-sm font-black uppercase italic tracking-tight">{selectedMenu || "Select Menu"}</p></div></div><ChevronDown size={20} className={`text-slate-300 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} /></button>{isMenuOpen && (<div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] border border-slate-100 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">{availableMenus.length > 0 ? availableMenus.map(m => (<button key={m} onClick={() => { setSelectedMenu(m); setIsMenuOpen(false); }} className="w-full p-5 text-left text-sm font-black uppercase italic border-b border-slate-50 last:border-0 hover:bg-slate-50">{m}</button>)) : <div className="p-5 text-[10px] font-bold text-slate-400 uppercase italic">No Menus Found</div>}</div>)}</div>
            <div className="space-y-4">{currentDayPlan.length > 0 ? currentDayPlan.map(m => (
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
            )) : <div className="p-16 text-center opacity-20 italic font-black text-xs tracking-widest border-2 border-dashed border-slate-200 rounded-[3rem]">No Plan</div>}</div>
          </div>
        ) : activeTab === 'fridge' ? (
          <div className="space-y-8 animate-in fade-in">
             <div className="flex justify-between items-end px-2"><h2 className="text-3xl font-black italic uppercase tracking-tighter">My Fridge</h2><div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Inventory</div></div>
             <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-white border border-slate-200 border-dashed p-4 rounded-[2rem] text-slate-400 font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:border-slate-400 hover:text-slate-600 transition-colors active:scale-95 mb-4"><Plus size={20}/> Add to Fridge</button>
             <div className="space-y-4">
                {fridgeItems.length > 0 ? fridgeItems.map(i => (
                    <div key={i.id} className="p-5 px-7 bg-white border border-slate-100 rounded-[1.8rem] flex justify-between items-center shadow-sm">
                       <div className="flex items-center gap-4"><div className={`p-2 rounded-xl bg-slate-50 text-slate-400`}><Package size={18}/></div><div><h3 className="font-black text-[14px] uppercase italic text-slate-700">{i.Item}</h3><p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{i.Department || "Other"}</p></div></div>
                       <div className="flex items-center gap-3"><button onClick={() => updateStock(i.id, -1)} className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center active:scale-90 hover:bg-slate-100"><Minus size={14}/></button><div className="text-center min-w-[40px]"><span className="text-lg font-black italic">{i.inStock}</span><span className="text-[9px] block uppercase font-bold text-slate-300">{i.Unit}</span></div><button onClick={() => updateStock(i.id, 1)} className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center active:scale-90 hover:bg-slate-100"><Plus size={14}/></button></div>
                    </div>
                )) : (<div className="p-24 flex flex-col items-center opacity-20"><Refrigerator size={48} /><p className="italic uppercase font-black text-xs tracking-[0.2em] mt-4">Fridge is Empty</p></div>)}
             </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-end px-2"><h2 className="text-3xl font-black italic uppercase tracking-tighter">Cart</h2><button onClick={handleClearCart} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-600 flex items-center gap-2 group"><Trash2 size={12}/> Clear List</button></div>
            <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-white border border-slate-200 border-dashed p-4 rounded-[2rem] text-slate-400 font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:border-slate-400 hover:text-slate-600 transition-colors active:scale-95 mb-4"><Plus size={20}/> Add to Cart</button>
            {Object.keys(groupedItems).length > 0 ? Object.keys(groupedItems).map(d => (
                <div key={d} className="space-y-4">
                    <div className="flex items-center gap-3 px-4"><div className="h-px flex-1 bg-slate-100"></div><h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 italic">{d}</h3><div className="h-px flex-1 bg-slate-100"></div></div>
                    <div className="space-y-2">{groupedItems[d].map(i => (<div key={i.id} onClick={() => setCheckedItems(p => ({ ...p, [i.id]: !p[i.id] }))} className={`p-5 px-7 bg-white border rounded-[1.8rem] flex justify-between items-center shadow-sm cursor-pointer transition-all ${checkedItems[i.id] ? `${theme.border} ${theme.bgLight} opacity-60` : 'border-slate-100'}`}> <div className="flex items-center gap-4"><div className={`p-1.5 rounded-lg border-2 ${checkedItems[i.id] ? `${theme.primary} border-transparent text-white` : 'border-slate-100 text-transparent'}`}><Check size={12} strokeWidth={4}/></div><div><h3 className={`font-black text-[14px] uppercase italic ${checkedItems[i.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{i.Item || "Unknown Item"}</h3></div></div><div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-2xl ${checkedItems[i.id] ? 'bg-slate-100 text-slate-400' : `${theme.bgLight} ${theme.text} border ${theme.border}`}`}><span className="text-lg font-black italic leading-none">{i.displayNeed.toFixed(0)}</span><span className="text-[10px] font-black uppercase italic tracking-tighter">{i.Unit || "pcs"}</span></div></div>))}</div>
                </div>
            )) : (<div className="p-24 flex flex-col items-center opacity-20"><Package size={48} /><p className="italic uppercase font-black text-xs tracking-[0.2em] mt-4">Cart is Empty</p></div>)}
            {Object.keys(checkedItems).filter(id => checkedItems[id]).length > 0 && (<div className="pt-4"><button onClick={handleFinishShopping} className={`w-full bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all hover:${theme.primary}`}><CheckCheck size={24}/><div className="text-left"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Finish</p><p className="text-lg font-black uppercase italic leading-none">Shopping</p></div></button></div>)}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 left-0 right-0 z-[100] px-6 max-w-md mx-auto pointer-events-none">
        <nav className="bg-slate-900 border border-white/5 p-2 rounded-[2.5rem] flex items-center justify-around shadow-2xl pointer-events-auto">
          <button onClick={() => { setActiveTab('dashboard'); setSelectedRecipe(null); }} className={`flex items-center justify-center gap-3 py-4 rounded-[1.8rem] transition-all flex-1 ${activeTab === 'dashboard' ? `${theme.primary} text-white` : 'text-slate-500'}`}><LayoutDashboard size={20}/></button>
          <button onClick={() => { setActiveTab('fridge'); setSelectedRecipe(null); }} className={`flex items-center justify-center gap-3 py-4 rounded-[1.8rem] transition-all flex-1 ${activeTab === 'fridge' ? `${theme.primary} text-white` : 'text-slate-500'}`}><Refrigerator size={20}/></button>
          <button onClick={() => { setActiveTab('inventory'); setSelectedRecipe(null); }} className={`flex items-center justify-center gap-3 py-4 rounded-[1.8rem] transition-all flex-1 ${activeTab === 'inventory' ? `${theme.primary} text-white` : 'text-slate-500'}`}><ShoppingCart size={20}/></button>
        </nav>
      </div>
    </div>
  );
}