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
const { chromium } = require("playwright");

app.get("/scan/:gt", async (req, res) => {
  const gt = req.params.gt.trim();

  const gtStatus = {
    isGeneralKOS: generalKOS.some(k => normalize(k) === normalize(gt)),
    isDDOS: ddosers.some(d => normalize(d) === normalize(gt))
  };

  try {
    const url = `https://www.xbox.com/en-US/play/user/${encodeURIComponent(gt)}/friends`;

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for friends list to load
    await page.waitForSelector("[data-test='friends-list']", { timeout: 15000 });

    // Extract gamertags
    const friends = await page.$$eval(
      "[data-test='friends-list'] a[href*='/user/']",
      els => els.map(el => el.textContent.trim())
    );

    await browser.close();

    const normalizedFriends = friends.map(f => normalize(f));

    const hitsGeneral = normalizedFriends.filter(f =>
      generalKOS.some(k => normalize(k) === f)
    );

    const hitsDDOS = normalizedFriends.filter(f =>
      ddosers.some(d => normalize(d) === f)
    );

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
