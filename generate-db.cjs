const fs = require("fs");
const path = require("path");

const geojsonPath = path.join(__dirname, "public", "data", "tn-234-constituencies.geojson");
const outputPath = path.join(__dirname, "db.json");

const geo = JSON.parse(fs.readFileSync(geojsonPath, "utf8"));

const parties = ["DMK", "AIADMK", "BJP", "INC", "NTK", "PMK"];
const alliances = {
  DMK: "INDIA",
  INC: "INDIA",
  AIADMK: "NDA",
  BJP: "NDA",
  PMK: "NDA",
  NTK: "OTHERS",
};

const sentiments = ["positive", "neutral", "negative"];

const constituencies = [];

geo.features.forEach((feature, index) => {
  const p = feature.properties || {};

  const constituencyNo = Number(p.AC_NO);

  // ❗ skip invalid entries
  if (!constituencyNo) return;

  const name = p.AC_NAME || `Constituency ${constituencyNo}`;
  const district = p.DIST_NAME || "Unknown";

  const party = parties[index % parties.length];

  constituencies.push({
    constituencyNo,
    name,
    district,
    party,
    mla: `MLA ${constituencyNo}`,
    alliance: alliances[party],
    winningMargin: Math.floor(Math.random() * 20000),
    sentiment: sentiments[index % sentiments.length],
    alertCount: Math.floor(Math.random() * 5),
  });
});

// 🔥 REMOVE duplicates (important)
const unique = Array.from(
  new Map(constituencies.map(item => [item.constituencyNo, item])).values()
);

// 🔥 SORT properly
unique.sort((a, b) => a.constituencyNo - b.constituencyNo);

fs.writeFileSync(outputPath, JSON.stringify({ constituencies: unique }, null, 2));

console.log("✅ Created db.json with", unique.length, "constituencies");