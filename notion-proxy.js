// netlify/functions/notion-proxy.js

const fetch = require('node-fetch'); // Netlify Functions izmanto Node.js, tāpēc fetch ir jāimportē
const { URL } = require('url'); // Lai parsētu URL

exports.handler = async (event, context) => {
  // Pārbaudām, vai pieprasījums ir POST un vai ir body
  if (event.httpMethod !== 'POST' || !event.body) {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed or Missing Body' }),
    };
  }

  try {
    const { endpoint, method, body } = JSON.parse(event.body);

    // Pārbaudām, vai ir Notion API atslēga no vides mainīgajiem
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28'; // Var arī definēt kā vides mainīgo

    if (!NOTION_API_KEY) {
      console.error('Notion API Key is not set in Netlify Environment Variables.');
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Server configuration error: Notion API Key missing.' }),
      };
    }

    // Veidojam pilnu Notion API URL
    const notionApiBaseUrl = 'https://api.notion.com/v1';
    const fullUrl = `${notionApiBaseUrl}${endpoint}`;

    // Veidojam pieprasījuma opcijas
    const requestOptions = {
      method: method || 'POST', // Noklusējuma metode ir POST
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    // Nosūtam pieprasījumu uz Notion API
    const notionResponse = await fetch(fullUrl, requestOptions);
    const notionData = await notionResponse.json();

    // Atgriežam Notion API atbildi atpakaļ React lietotnei
    return {
      statusCode: notionResponse.status,
      body: JSON.stringify(notionData),
    };

  } catch (error) {
    console.error('Error in Notion proxy function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};