// --- NOTION CONFIGURATION ---
const CONFIG = {
  apiKey: import.meta.env.VITE_NOTION_API_KEY,
  ingredientsDbId: import.meta.env.VITE_NOTION_INGREDIENTS_DB_ID,
  mealPlansDbId: import.meta.env.VITE_NOTION_MEALPLANS_DB_ID,
  baseUrl: typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.includes('googleusercontent') || window.location.hostname.includes('csb.app')) 
           ? "https://corsproxy.io/?https://api.notion.com/v1" 
           : "/api/notion" 
};

const CACHE_DURATION_MS = 15 * 60 * 1000; 

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
    let allResults =[];
    let hasMore = true;
    let cursor = undefined;
    while (hasMore) {
        const body = cursor ? { start_cursor: cursor } : {};
        const response = await this.request(`/databases/${dbId}/query`, 'POST', body);
        if (response.results) allResults =[...allResults, ...response.results];
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
          forMeals: p["Ingredients Link"]?.relation?.map(r => r.id) || [][] 
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

        // Palīgfunkcija, lai dabūtu tekstu no Rollup laukiem
        const getRollupText = (prop) => {
          if (!prop || !prop.rollup || !prop.rollup.array || prop.rollup.array.length === 0) return "";
          const val = prop.rollup.array[0];
          if (val.type === 'rich_text' && val.rich_text && val.rich_text.length > 0) return val.rich_text[0].plain_text;
          if (val.title && val.title.length > 0) return val.title[0].plain_text;
          return "";
        };

        return {
          id: page.id,
          isActive: p["Active"]?.checkbox || false,
          menuName: p["Menu Name"]?.select?.name || "Standard",
          day: p["Day"]?.select?.name || "Monday",
          type: p["Meal Type"]?.select?.name || "Other",
          name: getRollupText(p["Recipe"]) || p["Name"]?.title?.[0]?.plain_text || "Meal",
          recipe: getRollupText(p["Recipe"]) || "", 
          order: NotionService.getSafeNumber(p["Order"])
        };
      });

export default NotionService;