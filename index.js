import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { load } from 'cheerio'
import puppeteer from 'puppeteer-core'

const app = new Hono()
app.use('*', cors())

const TARGET = "https://drakorid.cam"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// --- ENDPOINT SERIES & DETAIL (Tetap pakai Fetch agar cepat) ---
app.get('/series', async (c) => {
  try {
    const res = await fetch(`${TARGET}/series/`, { headers: { 'User-Agent': UA } });
    const html = await res.text();
    const $ = load(html);
    const data = [];
    $('.bs').each((i, el) => {
      data.push({
        title: $(el).find('.tt').text().trim(),
        link: $(el).find('a').attr('href')
      });
    });
    return c.json({ status: true, data });
  } catch (err) {
    return c.json({ status: false, message: err.message });
  }
});

// --- ENDPOINT SCHEDULE (SOLUSI KHUSUS TEMBUS RECAPTCHA) ---
app.get('/schedule', async (c) => {
  let browser;
  try {
    // Menjalankan browser di Termux
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser', // Path default chromium di Termux
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();
    await page.setUserAgent(UA);

    // Buka halaman dan TUNGGU script grecaptcha selesai kirim form
    await page.goto(`${TARGET}/schedule/`, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Tunggu sampai elemen jadwal yang asli muncul setelah auto-submit
    await page.waitForSelector('.kg-schedule-tab', { timeout: 30000 });

    const html = await page.content();
    const $ = load(html);
    const schedule = [];

    $('.kg-schedule-tab').each((i, el) => {
      const day = $(el).find('h3').text().trim();
      const items = [];
      $(el).find('li').each((j, item) => {
        items.push({
          title: $(item).find('a').text().trim(),
          link: $(item).find('a').attr('href'),
          time: $(item).find('span').text().trim() || 'Update'
        });
      });
      if (day) schedule.push({ day, items });
    });

    return c.json({ status: true, data: schedule });

  } catch (err) {
    return c.json({ status: false, message: "Gagal nembus verifikasi: " + err.message });
  } finally {
    if (browser) await browser.close();
  }
});

export default app
