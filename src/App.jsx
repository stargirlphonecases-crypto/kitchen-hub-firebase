import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, LayoutDashboard, RefreshCw, Minus, Plus, X, 
  Sun, Moon, Coffee, ArrowLeft, 
  List, ChevronDown, Package, Check, Trash2, CheckCheck, ChefHat,
  Settings, LogOut, User, ChevronRight, ChevronLeft, Save, Palette, Share2, Copy,
  Refrigerator, Search, Flame, CalendarX, MessageSquare, Users, MessageCircle, AlertTriangle
} from 'lucide-react';

console.log("Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY);
// --- FIREBASE ---
import { db, auth } from './services/firebase';
import { 
  collection, onSnapshot, doc, updateDoc, setDoc, addDoc, getDoc, deleteDoc 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "firebase/auth";
import ProfileModal from './components/modals/ProfileModal';
import SettingsModal from './components/modals/SettingsModal';
import AddItemModal from './components/modals/AddItemModal';
import DashboardView from './components/views/DashboardView';
import FridgeView from './components/views/FridgeView';

// --- NOTION CONFIGURATION ---
console.log("Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY);
// ...
const CONFIG = {
  apiKey: import.meta.env.VITE_NOTION_API_KEY,
  ingredientsDbId: import.meta.env.VITE_NOTION_INGREDIENTS_DB_ID,
  mealPlansDbId: import.meta.env.VITE_NOTION_MEALPLANS_DB_ID,
  // Ja mēs esam lokāli (localhost) vai Sandbox, izmantojam CORS proxy. Ja Netlify, tad /api/notion
  baseUrl: typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.includes('googleusercontent') || window.location.hostname.includes('csb.app')) 
           ? "https://corsproxy.io/?https://api.notion.com/v1" 
           : "/api/notion" 
};
// --- FEEDBACK CONFIG ---
const FEEDBACK_EMAIL = "info@virtuveshub.lv"; 
const CACHE_DURATION_MS = 15 * 60 * 1000; 

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
    const origin = typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : 'http://localhost';
    const baseUrl = CONFIG.baseUrl.startsWith('http') ? CONFIG.baseUrl : `${origin}${CONFIG.baseUrl}`;
    const url = `${baseUrl}${endpoint}`;
    
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

  async getRecipeIngredients(forceRefresh = false) {
    const CACHE_KEY = 'cache_ingredients';
    const CACHE_TIME_KEY = 'cache_ingredients_time';
    
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    if (!forceRefresh && cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_DURATION_MS)) {
        return JSON.parse(cachedData);
    }

    try {
      const data = await this.requestAll(CONFIG.ingredientsDbId);
      const parsedData = data.results.map(page => {
        const p = page.properties;
        const titleProp = Object.values(p).find(prop => prop.type === 'title');
        
        let extractedDept = "Other";
        if (p.Department) {
            if (p.Department.type === 'rollup' && p.Department.rollup?.array?.[0]?.select) {
                extractedDept = p.Department.rollup.array[0].select.name;
            } else if (p.Department.type === 'select' && p.Department.select) {
                extractedDept = p.Department.select.name;
            }
        }

        return { 
          id: page.id, 
          Item: titleProp?.title?.[0]?.plain_text || "", 
          BaseAmount: this.getSafeNumber(p["Amount"]), 
          Unit: p.Unit?.select?.name || null, 
          Department: extractedDept,
          forMeals: p["Meal Plans"]?.relation?.map(r => r.id) || [] 
        };
      });
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsedData));
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      return parsedData;
    } catch (e) { throw new Error(`Ingredients: ${e.message}`); }
  },

  async getMealPlan(forceRefresh = false) {
    const CACHE_KEY = 'cache_meals';
    const CACHE_TIME_KEY = 'cache_meals_time';
    
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    if (!forceRefresh && cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_DURATION_MS)) {
        return JSON.parse(cachedData);
    }

    try {
      const data = await this.requestAll(CONFIG.mealPlansDbId);
      const DAY_MAP = { 
        'Pirmdiena': 'Monday', 'Otrdiena': 'Tuesday', 'Trešdiena': 'Wednesday', 
        'Ceturtdiena': 'Thursday', 'Piektdiena': 'Friday', 'Sestdiena': 'Saturday', 'Svētdiena': 'Sunday',
        'Monday': 'Monday', 'Tuesday': 'Tuesday', 'Wednesday': 'Wednesday', 
        'Thursday': 'Thursday', 'Friday': 'Friday', 'Saturday': 'Saturday', 'Sunday': 'Sunday' 
      };

      const parsedData = data.results.map(page => {
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

      localStorage.setItem(CACHE_KEY, JSON.stringify(parsedData));
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      return parsedData;

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
  const [completedMeals, setCompletedMeals] = useState([]); 
  
  const [recipeIngredients, setRecipeIngredients] = useState([]); 
  const [allMeals, setAllMeals] = useState([]); 
  
  const [availableMenus, setAvailableMenus] = useState([]); 
  const [selectedMenu, setSelectedMenu] = useState(null); 
  
  const [portions, setPortions] = useState(() => parseInt(localStorage.getItem('defaultPortions') || "1")); 
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('appTheme') || 'classic');

  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); 
  const [isProfileOpen, setIsProfileOpen] = useState(false);   

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
          loadNotionData(false); 
       } catch (e) {
            console.error("Pilnā datubāzes kļūda:", e);
            setErrorMsg(`Datubāzes kļūda: ${e.code || e.message}`);
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

  useEffect(() => {
    if (!user || !householdId) return; 
    
    const inventoryRef = collection(db, "households", householdId, "inventory");
    const unsubInv = onSnapshot(inventoryRef, (querySnapshot) => {
      const items = [];
      querySnapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setInventory(items);
    }, (error) => setErrorMsg("Inventory sync failed."));

    const completedRef = collection(db, "households", householdId, "completedMeals");
    const unsubCompleted = onSnapshot(completedRef, (querySnapshot) => {
      const meals = [];
      querySnapshot.forEach((doc) => meals.push(doc.data().mealId));
      setCompletedMeals(meals);
    }, (error) => console.error("Completed meals sync failed"));

    return () => { unsubInv(); unsubCompleted(); };
  }, [user, householdId]);

  const masterItemList = useMemo(() => {
    const itemsMap = new Map();
    recipeIngredients.forEach(ri => {
        const name = (ri.Item || "").trim();
        if (name) itemsMap.set(name.toLowerCase(), { name: name, unit: ri.Unit || "pcs", dept: ri.Department || "Other" });
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

  const loadNotionData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const [ingredients, meals] = await Promise.all([ 
          NotionService.getRecipeIngredients(forceRefresh), 
          NotionService.getMealPlan(forceRefresh) 
      ]);
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
    await signOut(auth); setInventory([]); setAllMeals([]); setIsSettingsOpen(false); setIsProfileOpen(false);
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
                Department: recipeInfo?.Department || "Other",
                inStock: 0
            };
        } else {
            item = inventory.find(i => i.id === id);
            if (item) normName = (item.Item || "").trim().toLowerCase();
        }

        if (!item && !isVirtual) return;

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

  const handleCookMeal = async () => {
    if (!selectedRecipe || !householdId) return;
    if (!confirm(`Did you finish cooking "${selectedRecipe.name}"? Ingredients will be deducted from your fridge and meal marked as completed.`)) return;
    
    setLoading(true);
    try {
      const completedCol = collection(db, "households", householdId, "completedMeals");
      await addDoc(completedCol, { mealId: selectedRecipe.id, date: new Date().toISOString() });

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
              await addDoc(invCol, { Item: ri.Item, Unit: ri.Unit || "pcs", Department: ri.Department || "Other", inStock: -amountToDeduct });
          }
      });

      await Promise.all(batchPromises);
      alert("Bon Appétit! 🍽️ Meal completed.");
      setSelectedRecipe(null);
    } catch (e) { console.error(e); setErrorMsg("Error recording cooking."); } finally { setLoading(false); }
  };

  const handleResetWeek = async () => {
      if(!householdId || !confirm("Are you sure you want to start a new week? All 'Cooked' statuses will be cleared.")) return;
      setLoading(true);
      try {
          const completedRef = collection(db, "households", householdId, "completedMeals");
          const snapshot = await import("firebase/firestore").then(m => m.getDocs(completedRef));
          const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          alert("New week started! 🗓️");
          setIsSettingsOpen(false);
      } catch (e) { setErrorMsg("Error resetting week."); } finally { setLoading(false); }
  };

  // --- UZLABOTA: EMPTY FRIDGE FUNCTION (Bez amnēzijas) ---
  const handleEmptyFridge = async () => {
      if(!householdId || !confirm("Are you sure you want to empty your fridge?")) return;
      setLoading(true);
      try {
          const invRef = collection(db, "households", householdId, "inventory");
          const snapshot = await import("firebase/firestore").then(m => m.getDocs(invRef));
          
          // VECĀ VERSIJA: snapshot.docs.map(d => deleteDoc(d.ref));
          // JAUNĀ VERSIJA: Saglabājam produktu "atmiņu", bet noliekam atlikumu uz 0
          const updatePromises = snapshot.docs.map(d => updateDoc(d.ref, { inStock: 0 }));
          
          await Promise.all(updatePromises);
          alert("Fridge emptied! 🧹 (Items saved in smart dictionary)");
          setIsSettingsOpen(false);
      } catch (e) { setErrorMsg("Error emptying fridge."); } finally { setLoading(false); }
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

  const groupedItems = useMemo(() => {
    const activeMealIds = allMeals
        .filter(m => m.menuName === selectedMenu && !completedMeals.includes(m.id))
        .map(m => m.id);

    const ingredientsTotals = {};
    recipeIngredients.forEach(ri => {
        const isRelevant = ri.forMeals && ri.forMeals.some(id => activeMealIds.includes(id));
        if (isRelevant) {
            const normName = (ri.Item || "").trim().toLowerCase();
            if (!ingredientsTotals[normName]) ingredientsTotals[normName] = 0;
            ingredientsTotals[normName] += ri.BaseAmount;
        }
    });

    // ŠĪS ir tās rindiņas, kuras tev netīšām izdzēsās:
    const allItemNames = new Set([...Object.keys(ingredientsTotals), ...inventory.map(i => (i.Item || "").trim().toLowerCase())]);
    const result = {};

    allItemNames.forEach(normName => {
        const recipeNeed = (ingredientsTotals[normName] || 0) * portions;
        
        const fireItem = inventory.find(i => (i.Item || "").trim().toLowerCase() === normName);
        const recipeInfo = recipeIngredients.find(r => (r.Item || "").trim().toLowerCase() === normName);
        
        // Atstājam visus mīnusus kā ir, jo tas ir manuāli pievienots grozam
        const inStock = fireItem ? (fireItem.inStock || 0) : 0;
        const finalNeed = recipeNeed - inStock;
        
        // Ja neko nevajag pirkt (vai ledusskapī ir vairāk nekā vajag), tad grozā neliekam
        if (finalNeed <= 0.1) return; 

        const department = fireItem?.Department || recipeInfo?.Department || "Other";
        if (!result[department]) result[department] =[];
        result[department].push({
            id: fireItem ? fireItem.id : `virtual_${normName}`,
            Item: fireItem ? fireItem.Item : normName,
            displayNeed: finalNeed,
            Unit: fireItem?.Unit || recipeInfo?.Unit || "pcs"
        });
    });
    
    const DEPARTMENT_ORDER =[
        "Produce", "Dārzeņi un augļi", 
        "Meat & Fish", "Gaļa un zivis", 
        "Dairy", "Piena produkti", 
        "Bakery", "Maize", 
        "Pantry", "Bakaleja", 
        "Frozen", "Saldētie produkti", 
        "Household", "Saimniecības preces", 
        "Other", "Cits"
    ];
    const sortedResult = {};
    DEPARTMENT_ORDER.forEach(dept => { if (result[dept]) sortedResult[dept] = result[dept]; });
    Object.keys(result).forEach(dept => { if (!sortedResult[dept]) sortedResult[dept] = result[dept]; });
    return sortedResult;
  },[inventory, recipeIngredients, portions, allMeals, selectedMenu, completedMeals]);

  const fridgeItems = useMemo(() => {
      return inventory.filter(i => (i.inStock || 0) > 0).sort((a,b) => (a.Department || "Other").localeCompare(b.Department || "Other"));
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
      
{/* --- PROFILE MODAL --- */}
      {isProfileOpen && (
        <ProfileModal
          user={user}
          theme={theme}
          joinCodeInput={joinCodeInput}
          setJoinCodeInput={setJoinCodeInput}
          handleJoinHousehold={handleJoinHousehold}
          copyToClipboard={copyToClipboard}
          loading={loading}
          handleLogout={handleLogout}
          setIsProfileOpen={setIsProfileOpen}
        />
      )}

      
{/* --- APP SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <SettingsModal
          setIsSettingsOpen={setIsSettingsOpen}
          portions={portions}
          setPortions={setPortions}
          saveDefaultPortions={saveDefaultPortions}
          handleResetWeek={handleResetWeek}
          handleEmptyFridge={handleEmptyFridge}
          THEMES={THEMES}
          currentTheme={currentTheme}
          setCurrentTheme={setCurrentTheme}
          theme={theme}
        />
      )}

      {/* --- FLOATING SUPPORT BUTTON --- */}
      <a 
        href={`mailto:${FEEDBACK_EMAIL}?subject=Kitchen%20Hub%20Feedback`} 
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-6 z-[120] w-12 h-12 bg-green-500 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95 hover:bg-green-600"
      >
        <MessageCircle size={24} />
      </a>

{isAddModalOpen && (
        <AddItemModal
          setIsAddModalOpen={setIsAddModalOpen}
          activeTab={activeTab}
          handleAddCustomItem={handleAddCustomItem}
          newItem={newItem}
          setNewItem={setNewItem}
          handleItemNameChange={handleItemNameChange}
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          selectSuggestion={selectSuggestion}
          theme={theme}
        />
      )}

      {/* --- NEW SPLIT HEADER --- */}
      <header className="px-6 pt-8 pb-4 flex justify-between items-start z-[110]">
        <div><h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-slate-900">Kitchen<br/><span className={theme.text}>Hub</span></h1><div className="flex items-center gap-1.5 mt-2"><div className={`w-1.5 h-1.5 rounded-full bg-green-500`}></div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">Synced</span></div></div>
        <div className="flex flex-col items-end gap-3">
            <div className="flex gap-3">
                {/* PROFILE BUTTON */}
                <button 
                    onClick={()=>{setIsProfileOpen(!isProfileOpen); setIsSettingsOpen(false);}} 
                    className={`w-10 h-10 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-all border ${isProfileOpen ? `${theme.border} ${theme.text} bg-slate-50` : 'bg-white border-slate-100 text-slate-600'}`}
                >
                    <User size={18} />
                </button>
                
                {/* SETTINGS BUTTON */}
                <button 
                    onClick={()=>{setIsSettingsOpen(!isSettingsOpen); setIsProfileOpen(false);}} 
                    className={`w-10 h-10 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-all border ${isSettingsOpen ? `${theme.border} ${theme.text} bg-slate-50` : 'bg-white border-slate-100 text-slate-600'}`}
                >
                    <Settings size={18} />
                </button>
                
                {/* REFRESH BUTTON */}
                <button onClick={() => loadNotionData(true)} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 active:scale-90 transition-all border border-slate-100">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
      </header>

      <main className="flex-1 p-6 pt-0 space-y-6 overflow-y-auto">
        {selectedRecipe ? (
          <div className="space-y-6 animate-in slide-in-from-right">
             <div className="flex items-start gap-4 px-2"><button onClick={() => setSelectedRecipe(null)} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button><div className="flex-1"><p className={`text-[9px] font-black uppercase tracking-widest italic ${theme.text}`}>{selectedRecipe.menuName}</p><h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-tight">{selectedRecipe.name}</h2></div></div>
             
             <div className="space-y-3">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-2">Ingredients</h3>
               {selectedRecipeIngredients.length > 0 ? selectedRecipeIngredients.map(i => (
                  <div key={i.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                     <span className="font-bold text-sm text-slate-700">{i.Item}</span>
                     <span className="text-xs font-black bg-slate-50 px-2 py-1 rounded-lg text-slate-400">
                        {Number(i.totalAmount.toFixed(1))} {i.Unit}
                     </span>
                  </div>
               )) : <div className="p-4 text-center text-xs font-bold text-slate-300 italic">No ingredients list</div>}
             </div>

             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm min-h-[300px] font-medium text-slate-600 whitespace-pre-line leading-relaxed">{selectedRecipe.recipe || "Instructions not available."}</div>
             
             {!completedMeals.includes(selectedRecipe.id) ? (
                 <button onClick={handleCookMeal} className={`w-full p-6 rounded-[2.5rem] text-white shadow-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all bg-slate-900 hover:${theme.primary}`}>
                    <ChefHat size={28} />
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Meal</p>
                        <p className="text-xl font-black uppercase italic leading-none">Cooked</p>
                    </div>
                 </button>
             ) : (
                 <div className="w-full p-6 rounded-[2.5rem] bg-green-50 border border-green-100 text-green-600 flex items-center justify-center gap-3 shadow-inner">
                    <CheckCheck size={24}/>
                    <span className="font-black uppercase italic tracking-wider">Meal already enjoyed</span>
                 </div>
             )}
          </div>
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            portions={portions}
            setPortions={setPortions}
            saveDefaultPortions={saveDefaultPortions}
            theme={theme}
            selectedDayIndex={selectedDayIndex}
            setSelectedDayIndex={setSelectedDayIndex}
            DAYS={DAYS}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            selectedMenu={selectedMenu}
            setSelectedMenu={setSelectedMenu}
            availableMenus={availableMenus}
            currentDayPlan={currentDayPlan}
            setSelectedRecipe={setSelectedRecipe}
            completedMeals={completedMeals}
          />
        ) : activeTab === 'fridge' ? (
          <FridgeView
            setIsAddModalOpen={setIsAddModalOpen}
            fridgeItems={fridgeItems}
            updateStock={updateStock}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-end px-2"><h2 className="text-3xl font-black italic uppercase tracking-tighter">Cart</h2><button onClick={handleClearCart} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-600 flex items-center gap-2 group"><Trash2 size={12}/> Clear List</button></div>
            <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-white border border-slate-200 border-dashed p-4 rounded-[2rem] text-slate-400 font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:border-slate-400 hover:text-slate-600 transition-colors active:scale-95 mb-4"><Plus size={20}/> Add to Cart</button>
            {Object.keys(groupedItems).length > 0 ? Object.keys(groupedItems).map(d => (
                <div key={d} className="space-y-4">
                    <div className="flex items-center gap-3 px-4"><div className="h-px flex-1 bg-slate-100"></div><h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 italic">{d}</h3><div className="h-px flex-1 bg-slate-100"></div></div>
                    <div className="space-y-2">{groupedItems[d].map(i => (<div key={i.id} onClick={() => setCheckedItems(p => ({ ...p, [i.id]: !p[i.id] }))} className={`p-5 px-7 bg-white border rounded-[1.8rem] flex justify-between items-center shadow-sm cursor-pointer transition-all ${checkedItems[i.id] ? `${theme.border} ${theme.bgLight} opacity-60` : 'border-slate-100'}`}> <div className="flex items-center gap-4"><div className={`p-1.5 rounded-lg border-2 ${checkedItems[i.id] ? `${theme.primary} border-transparent text-white` : 'border-slate-100 text-transparent'}`}><Check size={12} strokeWidth={4}/></div><div><h3 className={`font-black text-[14px] uppercase italic ${checkedItems[i.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{i.Item || "Unknown Item"}</h3></div></div><div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-2xl ${checkedItems[i.id] ? 'bg-slate-100 text-slate-400' : `${theme.bgLight} ${theme.text} border ${theme.border}`}`}><span className="text-lg font-black italic leading-none">{i.displayNeed.toFixed(0)}</span><span className="text-[10px] font-black uppercase italic tracking-tighter">{i.Unit || "pcs"}</span></div></div>))}</div>
                </div>
            )) : (
                <div className="p-24 flex flex-col items-center opacity-30">
                    <Package size={48} className="text-slate-400 mb-4"/>
                    <p className="italic uppercase font-black text-xs tracking-[0.2em] text-slate-400">Cart is empty</p>
                    <p className="text-[9px] font-bold text-slate-300 mt-2 text-center">Select recipes to fill it</p>
                </div>
            )}
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