// src/services/notionService.js

// Šīs konstantes varētu vēlāk pārvietot uz atsevišķu config failu
const CACHE_DURATION_MS = 15 * 60 * 1000; 
const INGREDIENTS_DB_ID = "2d8c827236ec806d9b6dee100778aa65";
const MEAL_PLANS_DB_ID = "2d8c827236ec807b907000077c2da2"; // Izlabots ID
const NotionService = {
  async proxyRequest(endpoint, method = 'POST', body = null) {
    try {
      // Izsaucam mūsu Netlify funkciju, nevis tieši Notion API
      const response = await fetch('/.netlify/functions/notion-proxy', {
        method: 'POST', // Visi pieprasījumi uz proxy funkciju ir POST
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, method, body }) // Iepakojam Notion pieprasījuma datus
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Proxy Status: ${response.status}`);
      return data;
    } catch (error) {
      console.error(`Notion Proxy Error [${method}]:`, error);
      throw error;
    }
  },

  async requestAll(dbId) {
    let allResults = [];
    let hasMore = true;
    let cursor = undefined;
    while (hasMore) {
        const body = cursor ? { start_cursor: cursor } : {};
        const response = await this.proxyRequest(`/databases/${dbId}/query`, 'POST', body);
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
      const data = await this.requestAll(INGREDIENTS_DB_ID);
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
      const data = await this.requestAll(MEAL_PLANS_DB_ID);
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

export default NotionService;
