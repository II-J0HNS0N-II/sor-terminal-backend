const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// LOAD EXTERNAL KOS LISTS
// ===============================
const generalKOS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/generalKOS.json"), "utf8")
);

const ddosers = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/ddosers.json"), "utf8")
);

// Normalization helper
const normalize = s => s.trim().toLowerCase();

// ===============================
// SCAN ENDPOINT
// ===============================
const puppeteer = require("puppeteer");

app.get("/scan/:gt", async (req, res) => {
  const gt = req.params.gt.trim();

  // Check GT itself against KOS/DDOS lists
  const gtStatus = {
    isGeneralKOS: generalKOS.some(k => normalize(k) === normalize(gt)),
    isDDOS: ddosers.some(d => normalize(d) === normalize(gt))
  };

  try {
    const url = `https://www.xbox.com/en-US/play/user/${encodeURIComponent(gt)}/friends`;

    // Launch Puppeteer with Render-safe flags
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process"
      ]
    });

    const page = await browser.newPage();

    // Spoof a real Chrome browser so Xbox doesn't block headless mode
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/118.0.5993.90 Safari/537.36"
    );

    // Navigate to the Xbox friends page
    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for the friends list container to load
    await page.waitForSelector("[data-test='friends-list']", { timeout: 15000 });

    // Extract gamertags from friend tiles
    const friends = await page.evaluate(() => {
      const tiles = document.querySelectorAll("[data-test='friends-list'] a[href*='/user/']");
      return Array.from(tiles).map(el => el.textContent.trim());
    });

    await browser.close();

    // Normalize friend names
    const normalizedFriends = friends.map(f => normalize(f));

    // Detect KOS/DDOS matches
    const hitsGeneral = normalizedFriends.filter(f =>
      generalKOS.some(k => normalize(k) === f)
    );

    const hitsDDOS = normalizedFriends.filter(f =>
      ddosers.some(d => normalize(d) === f)
    );

    // Return final JSON
    res.json({
      gamertag: gt,
      gtStatus,
      friends,
      generalKOS: hitsGeneral,
      ddosers: hitsDDOS
    });

  } catch (err) {
    console.error("SCRAPER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch or parse friends list." });
  }
});

// ===============================
// START SERVER
// ===============================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SOR backend running on port ${PORT}`);
});
