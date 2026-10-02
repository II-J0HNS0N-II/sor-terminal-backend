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
app.get("/scan/:gt", async (req, res) => {
  const gt = req.params.gt.trim();

  // Check GT itself
  const gtStatus = {
    isGeneralKOS: generalKOS.some(k => normalize(k) === normalize(gt)),
    isDDOS: ddosers.some(d => normalize(d) === normalize(gt))
  };

  try {
    const url = `https://xbox.com/en-US/play/user/${encodeURIComponent(gt)}/friends`;
    const response = await axios.get(url);

    const $ = cheerio.load(response.data);

    const friends = [];
    $("a").each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 0) friends.push(text);
    });

    const hitsGeneral = friends.filter(f =>
      generalKOS.some(k => normalize(k) === normalize(f))
    );

    const hitsDDOS = friends.filter(f =>
      ddosers.some(d => normalize(d) === normalize(f))
    );

    res.json({
      gamertag: gt,
      gtStatus,
      friends,
      generalKOS: hitsGeneral,
      ddosers: hitsDDOS
    });

  } catch (err) {
    console.error(err);
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
