const axios = require('axios');
const cheerio = require('cheerio');

const OXAM_EMAIL = process.env.OXAAM_EMAIL;
const OXAM_PASSWORD = process.env.OXAAM_PASSWORD;

const BASE_URL = 'https://oxaam.com';
const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

async function login() {
  // Get login page to extract CSRF token (if any)
  const loginPage = await client.get('/login'); // change if login URL is different
  const $ = cheerio.load(loginPage.data);
  const token = $('input[name="_token"]').val(); // adjust if field name differs

  const payload = { email: OXAM_EMAIL, password: OXAM_PASSWORD };
  if (token) payload._token = token;

  await client.post('/login', payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  // Cookies are stored automatically
}

async function fetchKrunshyRoleCredentials() {
  if (!client.defaults.headers.Cookie) await login();

  const { data: html } = await client.get('/freeservice.php');

  // Find KrunshyRole section
  const krunshyMatch = html.match(
    /<details[^>]*>[\s\S]*?KrunshyRole[^<]*<\/summary>([\s\S]*?)<\/details>/i
  );
  if (!krunshyMatch) throw new Error('KrunshyRole section not found');

  const section = krunshyMatch[1];
  const arrayMatch = section.match(/const\s+CREDENTIALS\s*=\s*\[([\s\S]*?)\];/i);
  if (!arrayMatch) throw new Error('CREDENTIALS array not found');

  const objRegex = /\{\s*email\s*:\s*"([^"]+)"\s*,\s*password\s*:\s*"([^"]+)"\s*\}/g;
  const credentials = [];
  let match;
  while ((match = objRegex.exec(arrayMatch[1])) !== null) {
    credentials.push({ email: match[1], password: match[2] });
  }

  if (credentials.length === 0) throw new Error('No credentials found');
  const randomIndex = Math.floor(Math.random() * credentials.length);
  return credentials[randomIndex];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const creds = await fetchKrunshyRoleCredentials();
    res.status(200).json(creds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
};