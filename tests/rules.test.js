/* Table-driven tests for the label rule engine.
   Run: node --test tests/rules.test.js      (no dependencies, no network) */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../assets/rules.js");

const C = R.CONSTANTS;

/* ---------------------------------------------------------------- helpers */

/* A label that passes every check, used as the base for single-rule tests. */
function clean(patch) {
  const base = {
    market: "IN",
    foodName: "Masala peanuts",
    brandName: "Anjali",
    descriptor: "Roasted coated peanut snack",
    veg: "veg",
    maker: "Anjali Foods LLP",
    makerAddress: "Plot 14, Food Park Road, Nellore 524004",
    consumerCare: "care@anjalifoods.example | 1800 000 0000",
    lotCode: "MP-11A",
    storage: "Store in a cool, dry place away from sunlight",
    usage: "Ready to eat. Reseal after opening.",
    imported: false,
    origin: "",
    netValue: 180,
    netUnit: "g",
    drainedValue: null,
    mrp: 60,
    pdpAreaCm2: 160,
    surfaceAreaCm2: 420,
    blownOrMoulded: false,
    packHeightMm: 150,
    packForm: "package",
    typeSizeMm: 1.5,
    qtyNumeralMm: 3,
    symbolSizeMm: 4,
    symbolPrinted: true,
    logoPrinted: true,
    allergensEmphasised: true,
    fssaiNumber: "10012345678901",
    fdaNumber: "",
    packedOn: "01/11/2026",
    shelfLifeMonths: 6,
    dateMode: "use-by",
    sulphiteMgKg: 0,
    allergensDeclared: ["peanut", "gluten"],
    ingredients: [
      { name: "Groundnut", pct: 62 },
      { name: "Gram flour", pct: 20 },
      { name: "Wheat flour", pct: 8 },
      { name: "Edible palmolein oil", pct: 5 },
      { name: "Salt", pct: 3 },
      { name: "Red chilli powder", pct: 1 },
      { name: "Acidity regulator (INS 330)", pct: 1 }
    ],
    nutrition: {
      energyKcal: 550, proteinG: 24, carbG: 28, totalSugarG: 3, addedSugarG: 1,
      totalFatG: 38, satFatG: 7, transFatG: 0.2, cholesterolMg: null, fibreG: null,
      sodiumMg: 780, servingSizeG: 30, servingsPerPack: 6
    }
  };
  return Object.assign({}, base, patch || {});
}

/* The Philippine twin of the same pack. */
function cleanPH(patch) {
  return clean(Object.assign({
    market: "PH",
    fdaNumber: "FR-4000012345678",
    dateMode: "use-by",
    nutrition: {
      energyKcal: 550, proteinG: 24, carbG: 28, totalSugarG: 3, addedSugarG: 1,
      totalFatG: 38, satFatG: 7, transFatG: 0.2, cholesterolMg: 0, fibreG: 4,
      sodiumMg: 780, servingSizeG: 30, servingsPerPack: 6
    }
  }, patch || {}));
}

function find(res, id) { return res.findings.filter((f) => f.id === id); }
function sev(res, id) {
  const hits = find(res, id);
  return hits.length ? hits[0].severity : "absent";
}
function msg(res, id) {
  const hits = find(res, id);
  return hits.length ? hits[0].message : "";
}

/* ------------------------------------------------------------ constants */

test("statutory constants hold their documented default values", () => {
  const table = [
    ["IN_SCHEDULE_II_MIN_MM", 3],
    ["IN_EXEMPT_SURFACE_CM2", 100],
    ["IN_NO_DATE_SURFACE_CM2", 30],
    ["LM_G_TO_KG_AT", 1000],
    ["LM_ML_TO_L_AT", 1000],
    ["LM_SMALL_PACK_EXEMPT_G", 10],
    ["LM_UNIT_PRICE_DP", 2],
    ["IN_SHORT_SHELF_MONTHS", 3],
    ["IN_FAT_DECLARE_MIN_PCT", 0.5],
    ["IN_POLYOL_WARNING_PCT", 10],
    ["SULPHITE_DECLARE_MG_KG", 10],
    ["GLUTEN_CARVEOUT_MG_KG", 20],
    ["IN_RDA_ENERGY_KCAL", 2000],
    ["IN_RDA_TOTAL_FAT_G", 67],
    ["IN_RDA_SAT_FAT_G", 22],
    ["IN_RDA_TRANS_FAT_G", 2],
    ["IN_RDA_ADDED_SUGAR_G", 50],
    ["IN_RDA_SODIUM_MG", 2000],
    ["IN_RDA_SALT_G", 5],
    ["PH_RNI_ENERGY_KCAL", 2530],
    ["PH_RNI_PROTEIN_G", 71],
    ["PH_RNI_FIBRE_G", 25],
    ["PH_RNI_SODIUM_MG", 2000],
    ["PH_SMALL_SURFACE_CM2", 30],
    ["PH_SMALL_SURFACE_TYPE_MM", 1.5],
    ["PH_LABEL_SPACE_EXEMPT_CM2", 10],
    ["PH_TFA_LIMIT_G_PER_100G", 2],
    ["FSSAI_DIGITS", 14],
    ["KCAL_PER_G_PROTEIN", 4],
    ["KCAL_PER_G_CARB", 4],
    ["KCAL_PER_G_FAT", 9],
    ["SODIUM_TO_SALT_FACTOR", 2.5],
    ["ENERGY_TOLERANCE_PCT", 20],
    ["SHELF_LIFE_LONG_MONTHS", 18]
  ];
  for (const [key, want] of table) {
    assert.equal(C[key], want, key + " changed — update the documented assumptions too");
  }
});

test("the two Indian type-size tables are the ones the rules print", () => {
  /* FSSAI Reg. 6(3) Table I: general mandatory information. */
  assert.deepEqual(C.IN_TYPE_TABLE.map((r) => [r.upToCm2, r.mm, r.blownMm]), [
    [200, 1, 2], [500, 2, 4], [2500, 3, 5], [Infinity, 6, 8]
  ]);
  /* Legal Metrology r. 7(2) Table I: net quantity, price, dates, consumer care.
     Row 1 blown is 2.0 after the 2017 correction, not the 1.5 stale copies print. */
  assert.deepEqual(C.LM_TYPE_TABLE.map((r) => [r.upToCm2, r.mm, r.blownMm]), [
    [50, 1, 2], [100, 1.5, 3], [500, 2.5, 4], [2500, 4, 6], [Infinity, 6, 6]
  ]);
  /* FSSAI Reg. 5(4)(c): circle for vegetarian, triangle for non-vegetarian. */
  assert.deepEqual(C.IN_SYMBOL_TABLE.map((r) => [r.upToCm2, r.circleMm, r.triangleMm, r.squareMm]), [
    [100, 3, 2.5, 6], [500, 4, 3.5, 8], [2500, 6, 5, 12], [Infinity, 8, 7, 16]
  ]);
});

test("every allergen group and nutrient carries the fields the engine needs", () => {
  for (const g of R.ALLERGENS) {
    assert.ok(g.id && g.label && g.say && g.short && g.sayIn, g.id + " needs id/short/label/say/sayIn");
    assert.ok(Array.isArray(g.keywords) && g.keywords.length > 0, g.id + " needs keywords");
    assert.ok(Array.isArray(g.notWhen), g.id + " needs a notWhen list");
  }
  for (const market of ["IN", "PH"]) {
    for (const n of R.NUTRIENTS[market]) {
      assert.ok(n.key && n.label && n.unit, market + " nutrient needs key/label/unit");
      if (n.rda) assert.equal(typeof C[n.rda], "number", n.rda + " must be a named constant");
    }
  }
  /* The Philippines has no reference value for fat, saturated fat, carbohydrate or
     sugars, so those rows must carry no rda key at all. */
  for (const key of ["totalFatG", "satFatG", "carbG", "totalSugarG"]) {
    const row = R.NUTRIENTS.PH.filter((n) => n.key === key)[0];
    assert.ok(row, "PH panel should list " + key);
    assert.equal(row.rda, undefined, key + " must not claim a Philippine reference value");
  }
});

/* ------------------------------------------------------------ dates */

test("parseDate accepts and rejects the right strings", () => {
  const table = [
    ["01/11/2026", true, { y: 2026, m: 11, d: 1 }],
    ["1/1/2026", true, { y: 2026, m: 1, d: 1 }],
    ["31/12/2025", true, { y: 2025, m: 12, d: 31 }],
    ["29/02/2024", true, { y: 2024, m: 2, d: 29 }],   // leap year
    ["29.02.2024", true, { y: 2024, m: 2, d: 29 }],   // dot separator
    ["29-02-2024", true, { y: 2024, m: 2, d: 29 }],   // dash separator
    ["2026-02-05", true, { y: 2026, m: 2, d: 5 }],    // ISO offered
    ["29/02/2025", false, "day"],                     // not a leap year
    ["29/02/2100", false, "day"],                     // century, not a leap year
    ["29/02/2000", true, { y: 2000, m: 2, d: 29 }],   // 400-year rule
    ["31/04/2026", false, "day"],
    ["00/11/2026", false, "day"],
    ["01/13/2026", false, "month"],
    ["01/00/2026", false, "month"],
    ["05/01/26", false, "two-digit-year"],
    ["01/11/1800", false, "year"],
    ["Nov 2026", false, "format"],
    ["01112026", false, "format"],
    ["", false, "empty"],
    [null, false, "empty"],
    [undefined, false, "empty"],
    [{}, false, "empty"],
    [12345, false, "format"]
  ];
  for (const [input, ok, want] of table) {
    const got = R.parseDate(input);
    assert.equal(got.ok, ok, JSON.stringify(input) + " -> ok=" + got.ok);
    if (ok) {
      assert.equal(got.y, want.y);
      assert.equal(got.m, want.m);
      assert.equal(got.d, want.d);
    } else {
      assert.equal(got.reason, want, JSON.stringify(input) + " reason");
    }
  }
});

test("addMonths clamps to the shorter month and rolls the year", () => {
  const table = [
    ["31/01/2026", 1, "28/02/2026"],   // clamp
    ["31/01/2024", 1, "29/02/2024"],   // clamp, leap
    ["30/11/2026", 1, "30/12/2026"],
    ["31/12/2025", 1, "31/01/2026"],   // year roll
    ["01/11/2026", 12, "01/11/2027"],
    ["29/02/2024", 12, "28/02/2025"],  // leap day a year on
    ["15/06/2026", 0, "15/06/2026"],
    ["15/06/2026", 18, "15/12/2027"],
    ["15/06/2026", 2.7, "15/08/2026"], // fractional months truncate
    ["15/06/2026", 240, "15/06/2046"]
  ];
  for (const [from, months, want] of table) {
    const start = R.parseDate(from);
    assert.equal(start.ok, true);
    assert.equal(R.fmtDate(R.addMonths(start, months), "dmy"), want, from + " + " + months + "m");
  }
});

test("daysInMonth knows the leap rules", () => {
  const table = [[2024, 2, 29], [2025, 2, 28], [2100, 2, 28], [2000, 2, 29],
    [2026, 1, 31], [2026, 4, 30], [2026, 12, 31]];
  for (const [y, m, want] of table) assert.equal(R.daysInMonth(y, m), want, y + "-" + m);
});

test("the printed date form follows the shelf life, with three months in the day bucket", () => {
  const cfg = R.makeConfig();
  const table = [[null, "short"], [0.5, "short"], [1, "short"], [2.9, "short"],
    [3, "short"], [3.1, "month"], [6, "month"], [24, "month"]];
  for (const [months, want] of table) {
    assert.equal(R.inDateStyle(months, cfg), want, months + " months");
  }
  const d = R.parseDate("01/05/2027");
  assert.equal(R.fmtDate(d, "short"), "01/05/27");
  assert.equal(R.fmtDate(d, "month"), "MAY 2027");    // month in capitals, never 05/2027
  assert.equal(R.fmtDate(d, "words"), "01 May 2027"); // the Philippine form
  assert.equal(R.fmtDate(d, "dmy"), "01/05/2027");

  /* A short-dated product prints the day; a long-dated one the month in words. */
  const shortDated = R.lint(clean({ shelfLifeMonths: 2 }));
  assert.ok(shortDated.labelText.indexOf("01/01/27") !== -1, "expected DD/MM/YY on a 2-month product");
  const longDated = R.lint(clean({ shelfLifeMonths: 6 }));
  assert.ok(longDated.labelText.indexOf("MAY 2027") !== -1, "expected MMM YYYY on a 6-month product");
  assert.equal(/\b05\/2027\b/.test(longDated.labelText), false, "an all-numeric month-year is not permitted");
});

/* ------------------------------------------------------------ net quantity */

test("formatNetQuantity prints numeral, one space, lower-case symbol", () => {
  const table = [
    [500, "g", "Net quantity: 500 g"],
    [0.5, "kg", "Net quantity: 0.5 kg"],
    [1, "l", "Net quantity: 1 l"],
    [250, "ml", "Net quantity: 250 ml"],
    [1.25, "kg", "Net quantity: 1.25 kg"],
    [180.0, "G", "Net quantity: 180 g"],      // case-insensitive unit input
    [0, "g", "Net quantity: 0 g"],
    [-5, "g", ""],                            // negative is not a quantity
    [500, "oz", ""],                          // non-metric unit rejected
    [null, "g", ""],
    ["abc", "g", ""]
  ];
  for (const [v, u, want] of table) assert.equal(R.formatNetQuantity(v, u), want, v + " " + u);
  assert.equal(R.formatNetQuantity(180, "g", "Net content"), "Net content: 180 g");
});

test("the unit switches at a kilogram, and either unit is lawful exactly on it", () => {
  const cfg = R.makeConfig();
  const table = [
    [1, "mass", "g"], [999, "mass", "g"], [999.99, "mass", "g"],
    [1000, "mass", "both"],                 // r. 13(3) proviso: 1 kg or 1000 g
    [1000.01, "mass", "kg"], [25000, "mass", "kg"],
    [1, "volume", "ml"], [999, "volume", "ml"],
    [1000, "volume", "both"], [2000, "volume", "l"]
  ];
  for (const [base, kind, want] of table) {
    assert.equal(R.preferredUnitOrBoth(base, kind, cfg), want, base + " " + kind);
  }
  /* and the finding follows: neither form is flagged at exactly a kilogram */
  assert.equal(sev(R.lint(clean({ netValue: 1000, netUnit: "g", qtyNumeralMm: 6 })), "NQ-UNIT"), "pass");
  assert.equal(sev(R.lint(clean({ netValue: 1, netUnit: "kg", qtyNumeralMm: 6 })), "NQ-UNIT"), "pass");
  assert.equal(sev(R.lint(clean({ netValue: 999, netUnit: "g" })), "NQ-UNIT"), "pass");
  assert.equal(sev(R.lint(clean({ netValue: 1001, netUnit: "g" })), "NQ-UNIT"), "must-fix");
  assert.equal(sev(R.lint(clean({ netValue: 0.5, netUnit: "kg" })), "NQ-UNIT"), "must-fix");
  assert.equal(sev(R.lint(clean({ netValue: 0, netUnit: "g" })), "NQ-VALUE"), "must-fix");
  assert.equal(sev(R.lint(clean({ netValue: null })), "NQ-VALUE"), "must-fix");
});

test("net-quantity text is measured against the Legal Metrology table, not the FSSAI one", () => {
  const cfg = R.makeConfig();
  /* r. 7(2) Table I, both columns, at and just past every band edge */
  const table = [
    [50, false, 1], [50.01, false, 1.5], [100, false, 1.5], [100.01, false, 2.5],
    [500, false, 2.5], [500.01, false, 4], [2500, false, 4], [2500.01, false, 6],
    [50, true, 2], [100, true, 3], [500, true, 4], [2500, true, 6], [5000, true, 6]
  ];
  for (const [area, blown, want] of table) {
    assert.equal(R.lmLetterMm(area, cfg, blown), want, area + " cm2 blown=" + blown);
  }
  /* 160 cm2 needs 2.5 mm for the net quantity but only 1 mm for everything else */
  assert.equal(R.lmLetterMm(160, cfg, false), 2.5);
  assert.equal(R.minLetterMm(160, "IN", cfg, false), 1);
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 160, qtyNumeralMm: 2.4 })), "NQ-HEIGHT"), "must-fix");
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 160, qtyNumeralMm: 2.5 })), "NQ-HEIGHT"), "pass");
  assert.equal(sev(R.lint(clean({ qtyNumeralMm: null })), "NQ-HEIGHT"), "advisory");
  /* blown or moulded lettering has to be bigger */
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 160, qtyNumeralMm: 3, blownOrMoulded: true })), "NQ-HEIGHT"), "must-fix");
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 160, qtyNumeralMm: 4, blownOrMoulded: true })), "NQ-HEIGHT"), "pass");
});

test("a pack of ten grams or less falls outside the Legal Metrology rules", () => {
  assert.equal(sev(R.lint(clean({ netValue: 10, netUnit: "g", qtyNumeralMm: 2.5 })), "NQ-SMALL"), "advisory");
  assert.match(msg(R.lint(clean({ netValue: 10, netUnit: "g" })), "NQ-SMALL"), /food-safety rules still apply/);
  assert.equal(sev(R.lint(clean({ netValue: 11, netUnit: "g", qtyNumeralMm: 2.5 })), "NQ-SMALL"), "absent");
  assert.equal(sev(R.lint(clean({ drainedValue: 500 })), "NQ-DRAINED"), "must-fix");
  assert.equal(sev(R.lint(clean({ drainedValue: 120 })), "NQ-DRAINED"), "pass");
});

test("the Philippine net-contents type size comes off the 1984 package-height table", () => {
  const cfg = R.makeConfig();
  const table = [
    [50, false, 400, 2], [60, false, 400, 2],
    [70, false, 400, 2.5],      // the 60-80 mm band the order leaves undefined
    [160, false, 400, 2.5], [161, false, 400, 3.5], [260, false, 400, 3.5],
    [300, false, 400, 5],
    [200, true, 400, 2], [400, true, 400, 2.5], [650, true, 400, 3.5], [700, true, 400, 5],
    [150, false, 20, 1.5],      // surface under 30 cm2 overrides the height bands
    [null, false, 400, null]
  ];
  for (const [h, bottle, area, want] of table) {
    assert.equal(R.phNetContentMinMm(h, bottle, area, cfg).mm, want,
      "height " + h + " bottle=" + bottle + " area=" + area);
  }
  assert.equal(R.phNetContentMinMm(70, false, 400, cfg).gap, true, "60-80 mm is the drafting gap");
  /* it is a warning, never a blocker: the 1984 order's survival is a judgement call */
  assert.equal(sev(R.lint(cleanPH({ packHeightMm: 150, qtyNumeralMm: 1 })), "NQ-HEIGHT"), "advisory");
  assert.equal(sev(R.lint(cleanPH({ packHeightMm: 150, qtyNumeralMm: 3 })), "NQ-HEIGHT"), "pass");
  assert.equal(sev(R.lint(cleanPH({ packHeightMm: null })), "NQ-HEIGHT"), "advisory");
});

/* ------------------------------------------------------------ price */

test("the retail price has no prescribed wording, and the unit sale price follows r. 6(11)", () => {
  const cfg = R.makeConfig();
  const table = [
    [60, 180, "g", false, 0.3333333333333333, "per g"],
    [250, 1, "kg", true, null, null],          // exactly 1 kg: unit price equals the retail price
    [250, 1000, "g", true, null, null],        // same pack, declared the other lawful way
    [300, 2, "kg", false, 150, "per kg"],
    [40, 250, "ml", false, 0.16, "per ml"],
    [90, 1.5, "l", false, 60, "per l"]
  ];
  for (const [mrp, value, unit, same, per, label] of table) {
    const got = R.unitSalePrice(mrp, R.baseQty(value, unit), unit, cfg);
    assert.equal(got.sameAsRetail, same, mrp + " / " + value + unit);
    if (!same) {
      assert.equal(Math.round(got.value * 1e6) / 1e6, Math.round(per * 1e6) / 1e6, mrp + "/" + value + unit);
      assert.equal(got.per, label);
    }
  }
  assert.equal(R.unitSalePrice(60, null, "g", cfg), null);
  assert.equal(R.unitSalePrice(null, 180, "g", cfg), null);
  assert.equal(R.unitSalePrice(60, 180, "oz", cfg), null);

  assert.equal(sev(R.lint(clean({ mrp: null })), "PR-MRP"), "must-fix");
  assert.equal(sev(R.lint(clean({ mrp: 60 })), "PR-MRP"), "pass");
  assert.match(msg(R.lint(clean({})), "PR-MRP"), /No wording is prescribed any more/);
  assert.match(msg(R.lint(clean({})), "PR-UNIT"), /1 January 2024/);
  assert.equal(sev(R.lint(clean({ netValue: 1, netUnit: "kg", qtyNumeralMm: 6 })), "PR-UNIT"), "pass");
  /* and no price group at all on a Philippine label */
  assert.equal(sev(R.lint(cleanPH({})), "PR-MRP"), "absent");
});

/* ------------------------------------------------------------ type & symbol */

test("minimum letter and symbol heights follow the panel-area tables", () => {
  const cfg = R.makeConfig();
  const typeTable = [
    [200, false, 1], [200.01, false, 2], [500, false, 2], [500.01, false, 3],
    [2500, false, 3], [2500.01, false, 6],
    [200, true, 2], [500, true, 4], [2500, true, 5], [4000, true, 8]
  ];
  for (const [area, blown, want] of typeTable) {
    assert.equal(R.minLetterMm(area, "IN", cfg, blown), want, area + " cm2 blown=" + blown);
  }
  assert.equal(R.minLetterMm(160, "PH", cfg, false), null, "no numeric minimum in the Philippines");

  const symbolTable = [
    [100, "veg", 3], [100, "nonveg", 2.5],
    [100.01, "veg", 4], [500, "nonveg", 3.5],
    [500.01, "veg", 6], [2500, "nonveg", 5],
    [2500.01, "veg", 8], [9000, "nonveg", 7]
  ];
  for (const [area, veg, want] of symbolTable) {
    assert.equal(R.minSymbolMm(area, cfg, veg), want, area + " cm2 " + veg);
  }
  assert.equal(R.symbolSizes(160, cfg).squareMm, 8);

  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 160, typeSizeMm: 0.9 })), "AR-TYPE"), "must-fix");
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 160, typeSizeMm: 1 })), "AR-TYPE"), "pass");
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 600, typeSizeMm: 2.9 })), "AR-TYPE"), "must-fix");
  assert.equal(sev(R.lint(clean({ typeSizeMm: null })), "AR-TYPE"), "advisory");
  assert.equal(sev(R.lint(cleanPH({ typeSizeMm: 0.1 })), "AR-TYPE"), "advisory");

  assert.equal(sev(R.lint(clean({ symbolPrinted: false })), "AR-SYMBOL"), "must-fix");
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 600, symbolSizeMm: 5 })), "AR-SYMBOL"), "must-fix");
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 600, symbolSizeMm: 6 })), "AR-SYMBOL"), "pass");
  /* the non-vegetarian triangle is allowed to be smaller than the vegetarian circle */
  assert.equal(sev(R.lint(clean({ pdpAreaCm2: 600, veg: "nonveg", symbolSizeMm: 5 })), "AR-SYMBOL"), "pass");
  assert.equal(sev(R.lint(cleanPH({})), "AR-SYMBOL"), "absent");
});

test("small-package relief is keyed to surface area, not to the display panel", () => {
  assert.equal(sev(R.lint(clean({ surfaceAreaCm2: 100 })), "AR-SMALL"), "advisory");
  assert.equal(sev(R.lint(clean({ surfaceAreaCm2: 101 })), "AR-SMALL"), "absent");
  assert.equal(sev(R.lint(clean({ surfaceAreaCm2: 29 })), "DT-SMALL"), "advisory");
  assert.equal(sev(R.lint(clean({ surfaceAreaCm2: 30 })), "DT-SMALL"), "absent");
  assert.match(msg(R.lint(clean({ surfaceAreaCm2: 29 })), "DT-SMALL"), /multi-unit pack/);
  assert.equal(sev(R.lint(cleanPH({ pdpAreaCm2: 9 })), "NQ-SMALL"), "advisory");
  assert.equal(sev(R.lint(cleanPH({ pdpAreaCm2: 11 })), "NQ-SMALL"), "absent");
});

/* ------------------------------------------------------------ ingredients */

test("descending-order rule names the offending pair", () => {
  const table = [
    [[["A", 50], ["B", 30], ["C", 20]], "pass"],
    [[["A", 50], ["B", 50]], "pass"],                       // equal shares are in order
    [[["A", 30], ["B", 50], ["C", 20]], "must-fix"],
    [[["A", 50], ["B", 20], ["C", 30]], "must-fix"],
    [[["A", 50], ["B", null], ["C", 20]], "pass"],          // unknown share cannot breach
    [[["A", null], ["B", null]], "pass"],
    [[["A", 100]], "advisory"]                              // single ingredient: IL-COUNT note
  ];
  for (const [rows, want] of table) {
    const res = R.lint(clean({
      ingredients: rows.map(([name, pct]) => ({ name, pct })),
      allergensDeclared: []
    }));
    const got = rows.length === 1 ? sev(res, "IL-COUNT") : sev(res, "IL-ORDER");
    assert.equal(got, want, JSON.stringify(rows));
  }
  const res = R.lint(clean({
    ingredients: [{ name: "Sugar", pct: 20 }, { name: "Wheat flour", pct: 45 }]
  }));
  assert.match(msg(res, "IL-ORDER"), /Wheat flour \(45%\)/);
  assert.match(msg(res, "IL-ORDER"), /Sugar \(20%\)/);
});

test("ingredient percentage total, duplicates and additive declarations", () => {
  const pctTable = [
    [[60, 40], "pass"],
    [[60, 41], "pass"],          // within the 1-point tolerance
    [[60, 41.5], "must-fix"],    // over 100 beyond tolerance
    [[60, 20], "advisory"],      // adds up short
    [[50, 49], "pass"]
  ];
  for (const [pcts, want] of pctTable) {
    const res = R.lint(clean({
      ingredients: pcts.map((p, i) => ({ name: "Item" + i, pct: p })),
      allergensDeclared: []
    }));
    assert.equal(sev(res, "IL-SUM"), want, JSON.stringify(pcts));
  }

  const dup = R.lint(clean({
    ingredients: [{ name: "Sugar", pct: 50 }, { name: "sugar", pct: 30 }, { name: "Salt", pct: 20 }],
    allergensDeclared: []
  }));
  assert.equal(sev(dup, "IL-DUP"), "advisory");

  const insTable = [
    ["Acidity regulator (INS 330)", "pass"],
    ["Preservative (INS 211)", "pass"],
    ["Preservative", "must-fix"],
    ["Colour", "must-fix"],
    ["Emulsifier", "must-fix"],
    ["INS 330", "advisory"],
    ["Salt", "pass"]
  ];
  for (const [name, want] of insTable) {
    const res = R.lint(clean({
      ingredients: [{ name: "Groundnut", pct: 90 }, { name, pct: 10 }],
      allergensDeclared: ["peanut"]
    }));
    assert.equal(sev(res, "IL-INS"), want, name);
  }

  const water = R.lint(clean({
    ingredients: [{ name: "Water", pct: 60 }, { name: "Sugar", pct: 40 }],
    allergensDeclared: []
  }));
  assert.equal(sev(water, "IL-WATER"), "advisory");
  assert.equal(sev(R.lint(clean({ ingredients: [], allergensDeclared: [] })), "IL-COUNT"), "must-fix");
});

test("ingredients that drag a statutory warning in with them", () => {
  const msgPack = R.lint(clean({
    ingredients: [{ name: "Groundnut", pct: 90 }, { name: "Flavour enhancer (INS 621)", pct: 10 }],
    allergensDeclared: ["peanut"]
  }));
  assert.equal(sev(msgPack, "IL-WARN-MSG"), "advisory");
  assert.ok(msgPack.labelText.indexOf("contains added MONOSODIUM GLUTAMATE") !== -1);
  assert.ok(msgPack.labelText.indexOf("NOT RECOMMENDED FOR INFANTS BELOW 12 MONTHS") !== -1);

  /* the polyol warning is a percentage rule, so it fires at the threshold and not below */
  const table = [[9.9, "absent"], [10, "advisory"], [25, "advisory"]];
  for (const [pct, want] of table) {
    const res = R.lint(clean({
      ingredients: [{ name: "Sugar", pct: 100 - pct }, { name: "Sorbitol", pct }],
      allergensDeclared: []
    }));
    assert.equal(sev(res, "IL-WARN-POLYOL"), want, "sorbitol at " + pct + "%");
  }
  const laxative = R.lint(clean({
    ingredients: [{ name: "Sugar", pct: 80 }, { name: "Sorbitol", pct: 20 }], allergensDeclared: []
  }));
  assert.ok(laxative.labelText.indexOf("EXCESS CONSUMPTION MAY HAVE LAXATIVE EFFECT") !== -1);
  /* neither warning belongs on a Philippine label */
  assert.equal(sev(R.lint(cleanPH({
    ingredients: [{ name: "Flavour enhancer (INS 621)", pct: 100 }], allergensDeclared: []
  })), "IL-WARN-MSG"), "absent");
});

/* ------------------------------------------------------------ allergens */

test("allergen detection catches the real names and ignores the lookalikes", () => {
  const cfg = R.makeConfig();
  const table = [
    ["Ghee", ["milk"]],
    ["Skimmed milk powder", ["milk"]],
    ["Paneer", ["milk"]],
    ["Dahi", ["milk"]],
    ["Whey protein concentrate", ["milk"]],
    ["Coconut milk", []],
    ["Almond milk", []],
    ["Cocoa butter", []],
    ["Peanut butter", ["peanut"]],
    ["Coconut milk and milk solids", ["milk"]],
    ["Wheat flour (maida)", ["gluten"]],
    ["Suji", ["gluten"]],
    ["Barley malt extract", ["gluten"]],
    ["Buckwheat flour", []],
    ["Groundnut oil", ["peanut"]],
    ["Peanuts", ["peanut"]],
    ["Moongphali", ["peanut"]],
    ["Cashew nuts", ["treenut"]],
    ["Badam", ["treenut"]],
    ["Nutmeg", []],
    ["Nutritional yeast", []],
    ["Water chestnut flour", []],
    ["Soya lecithin", ["soy"]],
    ["Tofu", ["soy"]],
    ["Egg albumen", ["egg"]],
    ["Eggplant", []],
    ["Prawn paste", ["crustacea"]],
    ["Anchovy extract", ["fish"]],
    ["Patis", ["fish"]],
    ["Sodium metabisulphite", ["sulphite"]],
    ["INS 223", ["sulphite"]],
    ["Salt", []],
    ["", []],
    [null, []]
  ];
  for (const [name, want] of table) {
    const hits = R.detectAllergens([{ name, pct: 10 }], null, cfg).map((h) => h.group);
    assert.deepEqual(hits.sort(), want.slice().sort(), JSON.stringify(name));
  }
  /* malformed ingredient arrays must not throw */
  assert.deepEqual(R.detectAllergens(null, null, cfg), []);
  assert.deepEqual(R.detectAllergens("milk", null, cfg), []);
  assert.deepEqual(R.detectAllergens([null, {}, 7], null, cfg), []);
});

test("the allergen statement uses each regulator's own wording", () => {
  /* India declares peanuts and tree nuts as "Nut" and gluten by the cereal's name. */
  const table = [
    ["Wheat flour", "Contains Wheat."],
    ["Maida", "Contains Wheat."],
    ["Suji", "Contains Wheat."],
    ["Barley malt extract", "Contains Barley."],
    ["Oats", "Contains Oats."],
    ["Cashew nuts", "Contains Nut."],
    ["Groundnut oil", "Contains Nut."],
    ["Ghee", "Contains Milk."],
    ["Prawn", "Contains Crustacean."]
  ];
  for (const [ingredient, want] of table) {
    const res = R.lint(clean({
      ingredients: [{ name: ingredient, pct: 100 }],
      allergensDeclared: ["gluten", "peanut", "treenut", "milk", "crustacea"]
    }));
    assert.ok(res.labelText.indexOf(want) !== -1, ingredient + " should print: " + want);
  }
  /* the Philippines uses the Codex group names and its own lead-in */
  const ph = R.lint(cleanPH({}));
  assert.ok(ph.labelText.indexOf("Contains food allergen:") !== -1, ph.labelText);
  assert.ok(ph.labelText.indexOf("peanuts") !== -1);
});

test("sulphite threshold is a boundary, inclusive", () => {
  const cfg = R.makeConfig();
  const table = [[0, []], [9.9, []], [10, ["sulphite"]], [10.1, ["sulphite"]], [500, ["sulphite"]],
    [null, []], ["abc", []], [-5, []]];
  for (const [ppm, want] of table) {
    const hits = R.detectAllergens([{ name: "Dried mango", pct: 100 }], ppm, cfg).map((h) => h.group);
    assert.deepEqual(hits, want, "sulphite " + ppm);
  }
  const undeclared = R.lint(clean({ sulphiteMgKg: 10 }));
  assert.equal(sev(undeclared, "AL-SULPHITE"), "must-fix");
  assert.equal(sev(undeclared, "AL-UNDECLARED"), "must-fix");
  const declared = R.lint(clean({ sulphiteMgKg: 10, allergensDeclared: ["peanut", "gluten", "sulphite"] }));
  assert.equal(sev(declared, "AL-SULPHITE"), "pass");
  /* and the threshold itself is user-overridable */
  const raised = R.lint(clean({ sulphiteMgKg: 10 }), { SULPHITE_DECLARE_MG_KG: 50 });
  assert.equal(sev(raised, "AL-SULPHITE"), "pass");
  assert.equal(sev(raised, "AL-UNDECLARED"), "pass");
});

test("undeclared allergens block, orphan declarations only advise", () => {
  const undeclared = R.lint(clean({ allergensDeclared: [] }));
  assert.equal(sev(undeclared, "AL-UNDECLARED"), "must-fix");
  assert.match(msg(undeclared, "AL-UNDECLARED"), /Peanut|peanut/);
  assert.match(msg(undeclared, "AL-UNDECLARED"), /gluten|Cereals/);

  const orphan = R.lint(clean({ allergensDeclared: ["peanut", "gluten", "crustacea"] }));
  assert.equal(sev(orphan, "AL-ORPHAN"), "advisory");
  assert.equal(sev(R.lint(clean({})), "AL-ORPHAN"), "pass");

  /* emphasis is good practice, never a blocker: no rule set requires it */
  assert.equal(sev(R.lint(clean({ allergensEmphasised: false })), "AL-EMPHASIS"), "advisory");
  assert.equal(sev(R.lint(clean({ allergensEmphasised: true })), "AL-EMPHASIS"), "pass");
  assert.match(msg(R.lint(clean({ allergensEmphasised: false })), "AL-EMPHASIS"), /Neither rule set requires/);

  /* unknown allergen ids are ignored rather than crashing */
  const junk = R.lint(clean({ allergensDeclared: ["peanut", "gluten", "unicorn", 42, null] }));
  assert.equal(sev(junk, "AL-UNDECLARED"), "pass");
});

/* ------------------------------------------------------------ licence number */

test("FSSAI number format rule", () => {
  const table = [
    ["10012345678901", "pass"],
    ["20012345678901", "pass"],          // registration series
    ["1001 2345 6789 01", "pass"],       // spaces tolerated
    ["1001-2345-678901", "pass"],
    ["1001234567890", "must-fix"],       // 13 digits
    ["100123456789012", "must-fix"],     // 15 digits
    ["30012345678901", "must-fix"],      // wrong leading digit
    ["1001234567890A", "must-fix"],
    ["FSSAI 10012345678901", "must-fix"],
    ["", "must-fix"]
  ];
  for (const [value, want] of table) {
    assert.equal(sev(R.lint(clean({ fssaiNumber: value })), "LC-FSSAI"), want, value);
  }
  assert.equal(sev(R.lint(clean({ logoPrinted: false })), "LC-LOGO"), "must-fix");

  /* the Philippine authorization number "may" be printed, so its absence only advises */
  const ph = R.lint(cleanPH({ fdaNumber: "" }));
  assert.equal(sev(ph, "LC-FDA"), "advisory");
  assert.match(msg(ph, "LC-FDA"), /optional, not mandatory/);
  assert.equal(sev(ph, "LC-FSSAI"), "absent");
  assert.equal(sev(R.lint(cleanPH({})), "LC-FDA"), "pass");
});

/* ------------------------------------------------------------ nutrition */

test("nutrition panel completeness and internal consistency", () => {
  const n = (patch) => clean({ nutrition: Object.assign({
    energyKcal: 550, proteinG: 24, carbG: 28, totalSugarG: 3, addedSugarG: 1,
    totalFatG: 38, satFatG: 7, transFatG: 0.2, cholesterolMg: null, fibreG: null,
    sodiumMg: 780, servingSizeG: 30, servingsPerPack: 6
  }, patch) });

  assert.equal(sev(R.lint(n({})), "NU-MISSING"), "pass");
  const miss = R.lint(n({ addedSugarG: null, transFatG: null }));
  assert.equal(sev(miss, "NU-MISSING"), "must-fix");
  assert.match(msg(miss, "NU-MISSING"), /Added sugars/);
  assert.match(msg(miss, "NU-MISSING"), /Trans fat/);

  const table = [
    [{ satFatG: 30, transFatG: 10 }, "NU-FAT", "must-fix"],        // 40 > 38
    [{ satFatG: 37.8, transFatG: 0.2 }, "NU-FAT", "pass"],         // exactly total fat
    [{ addedSugarG: 5, totalSugarG: 3 }, "NU-SUGAR", "must-fix"],
    [{ addedSugarG: 3, totalSugarG: 3 }, "NU-SUGAR", "pass"],
    [{ totalSugarG: 30, carbG: 28 }, "NU-CARB", "must-fix"],
    [{ totalSugarG: 28, carbG: 28 }, "NU-CARB", "pass"],
    [{ proteinG: 40, carbG: 40, totalFatG: 40 }, "NU-MACRO", "must-fix"],
    [{ proteinG: 30, carbG: 30, totalFatG: 40 }, "NU-MACRO", "pass"],
    [{ servingSizeG: null }, "NU-SERVING", "must-fix"],
    [{ servingSizeG: 30, servingsPerPack: 2 }, "NU-SERVING", "advisory"], // 60 g vs 180 g pack
    [{ servingSizeG: 30, servingsPerPack: 6 }, "NU-SERVING", "pass"]
  ];
  for (const [patch, id, want] of table) {
    assert.equal(sev(R.lint(n(patch)), id), want, id + " " + JSON.stringify(patch));
  }
});

test("the fat provisos decide which nutrients this food has to declare", () => {
  const cfg = R.makeConfig();
  const lean = { energyKcal: 100, proteinG: 2, carbG: 22, totalSugarG: 1, addedSugarG: 0,
    totalFatG: 0.4, satFatG: null, transFatG: null, cholesterolMg: null, fibreG: null, sodiumMg: 50,
    servingSizeG: 30, servingsPerPack: 6 };

  /* at or below half a gram of fat, saturated and trans fat need not be declared */
  const leanKeys = R.requiredNutrients(R.lint(clean({ nutrition: lean })).input, cfg, []).map((d) => d.key);
  assert.equal(leanKeys.indexOf("satFatG"), -1);
  assert.equal(leanKeys.indexOf("transFatG"), -1);
  assert.equal(sev(R.lint(clean({ nutrition: lean, ingredients: [{ name: "Rice flour", pct: 100 }], allergensDeclared: [] })), "NU-MISSING"), "pass");

  /* above it they are back, and the panel is incomplete without them */
  const fatty = Object.assign({}, lean, { totalFatG: 0.6 });
  assert.equal(sev(R.lint(clean({ nutrition: fatty, ingredients: [{ name: "Rice flour", pct: 100 }], allergensDeclared: [] })), "NU-MISSING"), "must-fix");

  /* cholesterol only comes in with fat of animal origin */
  assert.equal(R.hasAnimalFat([{ name: "Rice flour" }], []), false);
  assert.equal(R.hasAnimalFat([{ name: "Chicken fat" }], []), true);
  assert.equal(R.hasAnimalFat([{ name: "Butter" }], [{ group: "milk" }]), true);
  const veg = R.lint(clean({ ingredients: [{ name: "Gram flour", pct: 100 }], allergensDeclared: [] }));
  assert.equal(sev(veg, "NU-MISSING"), "pass");
  const meaty = R.lint(clean({
    ingredients: [{ name: "Chicken", pct: 70 }, { name: "Gram flour", pct: 30 }],
    allergensDeclared: []
  }));
  assert.equal(sev(meaty, "NU-MISSING"), "must-fix");
  assert.match(msg(meaty, "NU-MISSING"), /Cholesterol/);
});

test("energy cross-check uses the 4/4/9 factors and the stated tolerance", () => {
  const base = { proteinG: 10, carbG: 10, totalFatG: 10 };  // 40 + 40 + 90 = 170 kcal
  assert.equal(R.computedEnergy(base, R.makeConfig()), 170);
  const mk = (energyKcal) => clean({
    nutrition: Object.assign({}, base, {
      energyKcal, totalSugarG: 2, addedSugarG: 1, satFatG: 3, transFatG: 0.1,
      sodiumMg: 100, servingSizeG: 30, servingsPerPack: 6
    })
  });
  const table = [
    [170, "pass"],
    [204, "pass"],        // exactly +20%
    [136, "pass"],        // exactly -20%
    [205, "must-fix"],
    [100, "must-fix"],
    [0, "must-fix"]
  ];
  for (const [kcal, want] of table) {
    assert.equal(sev(R.lint(mk(kcal)), "NU-ENERGY"), want, kcal + " kcal");
  }
  /* tolerance is user-overridable */
  assert.equal(sev(R.lint(mk(220), { ENERGY_TOLERANCE_PCT: 40 }), "NU-ENERGY"), "pass");
  /* and the check is skipped, not failed, when the macros are absent */
  assert.equal(sev(R.lint(clean({ nutrition: {} })), "NU-ENERGY"), "advisory");
  assert.equal(R.computedEnergy({}, R.makeConfig()), null);
});

test("per-serve values and %RDA come off the named reference values", () => {
  const res = R.lint(clean({}));
  const rows = {};
  for (const r of res.nutrition) rows[r.key] = r;
  assert.equal(rows.energyKcal.per100, 550);
  assert.equal(rows.energyKcal.perServe, 165);                        // 550 x 30/100
  assert.equal(Math.round(rows.energyKcal.rdaPct * 10) / 10, 8.3);    // 165 / 2000
  assert.equal(rows.sodiumMg.rdaBasis, C.IN_RDA_SODIUM_MG);
  assert.equal(Math.round(res.derived.saltEquivalentG * 100) / 100, 1.95);  // 780 x 2.5 / 1000

  /* overriding a reference value moves the percentage and nothing else */
  const over = R.lint(clean({}), { IN_RDA_ENERGY_KCAL: 2500 });
  const e = over.nutrition.filter((r) => r.key === "energyKcal")[0];
  assert.equal(Math.round(e.rdaPct * 10) / 10, 6.6);
  assert.equal(e.per100, 550);

  /* the Philippine panel shows a percentage only where a reference value exists */
  const ph = R.lint(cleanPH({}));
  const phRows = {};
  for (const r of ph.nutrition) phRows[r.key] = r;
  assert.equal(phRows.energyKcal.rdaBasis, C.PH_RNI_ENERGY_KCAL);
  assert.equal(phRows.proteinG.rdaBasis, C.PH_RNI_PROTEIN_G);
  assert.equal(phRows.totalFatG.rdaBasis, null, "no Philippine reference value for total fat");
  assert.equal(phRows.totalFatG.rdaPct, null);
  assert.equal(phRows.carbG.rdaPct, null);
  assert.equal(phRows.totalSugarG.rdaPct, null);

  /* junk overrides are ignored */
  for (const bad of [{ IN_RDA_ENERGY_KCAL: "abc" }, { IN_RDA_ENERGY_KCAL: -1 },
    { IN_RDA_ENERGY_KCAL: null }, { NOT_A_CONSTANT: 5 }, null, "x", 7]) {
    const cfg = R.makeConfig(bad);
    assert.equal(cfg.IN_RDA_ENERGY_KCAL, C.IN_RDA_ENERGY_KCAL, JSON.stringify(bad));
  }
});

test("salt equivalent and rounding never produce NaN", () => {
  const cfg = R.makeConfig();
  const table = [[780, 1.95], [0, 0], [null, null], ["abc", null], [-1, null], [2000, 5]];
  for (const [mg, want] of table) {
    const got = R.saltEquivalentG(mg, cfg);
    if (want === null) assert.equal(got, null, String(mg));
    else assert.equal(Math.round(got * 1000) / 1000, want, String(mg));
  }
});

test("the Philippine trans-fat policy limit", () => {
  const over = R.lint(cleanPH({ nutrition: Object.assign({}, cleanPH({}).nutrition, { transFatG: 2.5 }) }));
  assert.equal(sev(over, "NU-TFA"), "advisory");
  const under = R.lint(cleanPH({ nutrition: Object.assign({}, cleanPH({}).nutrition, { transFatG: 2 }) }));
  assert.equal(sev(under, "NU-TFA"), "pass");
  assert.match(msg(under, "NU-TFA"), /trace amounts/);
  assert.equal(sev(R.lint(clean({})), "NU-TFA"), "absent", "that policy is Philippine only");
  /* the panel has to say which reference values it used */
  assert.equal(sev(R.lint(cleanPH({})), "NU-PDRI"), "pass");
  assert.ok(R.lint(cleanPH({})).labelText.indexOf("Based on PDRI 2015") !== -1);
});

/* ------------------------------------------------------------ dates in context */

test("date findings and the derived durability date", () => {
  const table = [
    ["01/11/2026", 6, "pass", "01/05/2027"],
    ["31/08/2026", 6, "pass", "28/02/2027"],   // clamped
    ["01/13/2026", 6, "must-fix", ""],
    ["", 6, "must-fix", ""],
    ["01/11/2026", 0, "pass", ""],             // date fine, shelf life missing
    ["01/11/2026", 24, "pass", "01/11/2028"]
  ];
  for (const [packedOn, shelfLifeMonths, wantDate, wantBB] of table) {
    const res = R.lint(clean({ packedOn, shelfLifeMonths }));
    assert.equal(sev(res, "DT-PACKED"), wantDate, packedOn);
    assert.equal(res.derived.bestBefore, wantBB, packedOn + " +" + shelfLifeMonths);
  }
  assert.equal(sev(R.lint(clean({ shelfLifeMonths: 0 })), "DT-SHELF"), "must-fix");
  assert.equal(sev(R.lint(clean({ shelfLifeMonths: 19 })), "DT-LONG"), "advisory");
  assert.equal(sev(R.lint(clean({ shelfLifeMonths: 18 })), "DT-LONG"), "absent");
  /* no such relief in the Philippines, so the note does not appear there */
  assert.equal(sev(R.lint(cleanPH({ shelfLifeMonths: 24 })), "DT-LONG"), "absent");
});

test("each market's mandatory date wording", () => {
  /* India: the date of manufacture AND an expiry / use-by date. Best before is extra. */
  assert.equal(sev(R.lint(clean({ dateMode: "best-before" })), "DT-TERM"), "must-fix");
  assert.match(msg(R.lint(clean({ dateMode: "best-before" })), "DT-TERM"), /not be substituted|not substituted for them/);
  assert.equal(sev(R.lint(clean({ dateMode: "use-by" })), "DT-TERM"), "pass");

  /* the Philippines does not recognise "best before" at all */
  assert.equal(sev(R.lint(cleanPH({ dateMode: "best-before" })), "DT-TERM"), "must-fix");
  assert.equal(sev(R.lint(cleanPH({ dateMode: "use-by" })), "DT-TERM"), "pass");

  /* and there a date of manufacture is useful but not itself mandatory */
  assert.equal(sev(R.lint(cleanPH({ packedOn: "" })), "DT-PACKED"), "advisory");
  assert.equal(sev(R.lint(cleanPH({ packedOn: "31/04/2026" })), "DT-PACKED"), "must-fix");
  assert.equal(sev(R.lint(clean({ packedOn: "" })), "DT-PACKED"), "must-fix");
});

/* ------------------------------------------------------------ market split */

test("the two rule sets differ where the regulations differ", () => {
  const inRes = R.lint(clean({}));
  const phRes = R.lint(cleanPH({}));

  /* India prices the pack; the Philippines does not print an MRP */
  assert.equal(sev(inRes, "PR-MRP"), "pass");
  assert.equal(sev(phRes, "PR-MRP"), "absent");
  assert.equal(inRes.groups.some((g) => g.id === "PR"), true);
  assert.equal(phRes.groups.some((g) => g.id === "PR"), false);

  /* India needs the veg/non-veg symbol and the FSSAI logo */
  assert.equal(sev(phRes, "AR-SYMBOL"), "absent");
  assert.equal(sev(phRes, "LC-LOGO"), "absent");

  /* added sugars is on the Indian panel; fibre and cholesterol on the Philippine one */
  assert.equal(R.NUTRIENTS.IN.some((x) => x.key === "addedSugarG"), true);
  assert.equal(R.NUTRIENTS.PH.some((x) => x.key === "addedSugarG"), false);
  assert.equal(R.NUTRIENTS.PH.some((x) => x.key === "fibreG"), true);
  assert.equal(R.NUTRIENTS.PH.some((x) => x.key === "cholesterolMg"), true);

  /* brand name is mandatory in the Philippines */
  assert.equal(sev(R.lint(cleanPH({ brandName: "" })), "MD-BRAND"), "must-fix");
  assert.equal(sev(R.lint(clean({ brandName: "" })), "MD-BRAND"), "absent");

  /* a sweetened beverage has to name its sweetener there */
  const drink = R.lint(cleanPH({
    netValue: 330, netUnit: "ml",
    ingredients: [{ name: "Water", pct: 85 }, { name: "Sugar", pct: 15 }],
    allergensDeclared: []
  }));
  assert.equal(sev(drink, "MD-SWEETENER"), "advisory");
  assert.equal(sev(R.lint(cleanPH({})), "MD-SWEETENER"), "absent", "a solid snack is not a beverage");

  /* an unknown market falls back to the Indian rule set */
  assert.equal(R.lint(clean({ market: "ZZ" })).market, "IN");
  assert.equal(R.lint(clean({ market: "ph" })).market, "PH");
});

test("mandatory-declaration sweep flags each missing field once", () => {
  const table = [
    ["foodName", "MD-NAME", "must-fix"],
    ["maker", "MD-MAKER", "must-fix"],
    ["makerAddress", "MD-ADDRESS", "must-fix"],
    ["consumerCare", "MD-CARE", "must-fix"],
    ["lotCode", "MD-LOT", "must-fix"],
    ["storage", "MD-STORAGE", "advisory"],
    ["usage", "MD-USAGE", "advisory"]
  ];
  for (const [field, id, want] of table) {
    const patch = {}; patch[field] = "";
    assert.equal(sev(R.lint(clean(patch)), id), want, field);
    assert.equal(sev(R.lint(clean({})), id), "pass", field + " present");
  }
  assert.equal(sev(R.lint(clean({ imported: true, origin: "" })), "MD-ORIGIN"), "must-fix");
  assert.equal(sev(R.lint(clean({ imported: true, origin: "Vietnam" })), "MD-ORIGIN"), "pass");
  assert.equal(sev(R.lint(clean({ imported: false })), "MD-ORIGIN"), "absent");

  /* consumer care needs a telephone number and an e-mail address, not one or the other */
  const careTable = [
    ["care@anjalifoods.example | 1800 000 0000", "pass"],
    ["care@anjalifoods.example", "must-fix"],
    ["1800 000 0000", "must-fix"],
    ["Anjali Foods, Nellore", "must-fix"]
  ];
  for (const [value, want] of careTable) {
    assert.equal(sev(R.lint(clean({ consumerCare: value })), "MD-CARE-PARTS"), want, value);
  }
});

/* ------------------------------------------------------------ label output */

test("the generated label carries the statutory block in order", () => {
  const res = R.lint(clean({}));
  const text = res.labelText;
  for (const want of [
    "ANJALI MASALA PEANUTS",
    "INGREDIENTS: Groundnut (62%)",
    "ALLERGEN INFORMATION: Contains",
    "NUTRITIONAL INFORMATION",
    "Net quantity: 180 g",
    "Maximum retail price: Rs 60.00 (incl. of all taxes)",
    "Unit sale price: Rs 0.33 per g",
    "Date of manufacture / packing: NOV 2026",
    "Use by / Expiry: MAY 2027",
    "Lot / Batch No.: MP-11A",
    "Lic. No. 10012345678901",
    "Consumer care:"
  ]) {
    assert.ok(text.indexOf(want) !== -1, "label should contain: " + want + "\n" + text);
  }

  /* allergen ingredients are marked for bolding, without any inline styling */
  const bolded = [];
  for (const line of res.label.lines) {
    for (const seg of line.segs) { if (seg.b) bolded.push(seg.t); }
  }
  assert.ok(bolded.some((t) => t.indexOf("Groundnut") === 0), "groundnut should be emphasised");
  assert.ok(bolded.some((t) => t.indexOf("Wheat flour") === 0), "wheat flour should be emphasised");
  assert.ok(bolded.some((t) => t.indexOf("Contains") === 0), "the contains statement should be emphasised");
  assert.ok(!bolded.some((t) => t.indexOf("Salt") === 0), "salt is not an allergen");

  /* the Philippine label prints its own wording */
  const ph = R.lint(cleanPH({}));
  assert.ok(ph.labelText.indexOf("Net content: 180 g") !== -1);
  assert.ok(ph.labelText.indexOf("NUTRITION FACTS") !== -1);
  assert.ok(ph.labelText.indexOf("Calories from fat") !== -1);
  assert.ok(ph.labelText.indexOf("FDA Reg. No. FR-4000012345678") !== -1);
  assert.equal(ph.labelText.indexOf("Maximum retail price"), -1);
  assert.equal(ph.labelText.indexOf("Unit sale price"), -1);
  assert.ok(ph.labelText.indexOf("01 November 2026") !== -1, "PH prints the month in words");
  assert.ok(ph.labelText.indexOf("Expiry date: 01 May 2027") !== -1 ||
    ph.labelText.indexOf("Use-by date: 01 May 2027") !== -1, ph.labelText);

  /* empty input still produces a usable skeleton */
  const bare = R.lint({});
  assert.ok(bare.labelText.indexOf("[NAME OF THE FOOD]") !== -1);
  assert.ok(bare.labelText.indexOf("INGREDIENTS: [not entered]") !== -1);
});

/* ------------------------------------------------------------ robustness */

test("a compliant label reports no blocking issue, in either market", () => {
  for (const [name, input] of [["India", clean({})], ["Philippines", cleanPH({})]]) {
    const res = R.lint(input);
    const blockers = res.problems.filter((p) => p.severity === "must-fix");
    assert.deepEqual(blockers.map((b) => b.id + ": " + b.message), [], name + " had unexpected blockers");
    assert.equal(res.summary.mustFix, 0);
    assert.ok(res.summary.checks >= 30, name + " expected a substantial rule set, got " + res.summary.checks);
    assert.equal(res.summary.mustFix + res.summary.advisory + res.summary.pass, res.summary.checks);
    assert.match(res.verdict, /No blocking issue|Every check passes/);
  }
});

test("every finding is well formed and groups reconcile", () => {
  const ids = R.GROUPS.map((g) => g.id);
  for (const input of [clean({}), cleanPH({}), {}, null]) {
    const res = R.lint(input);
    let mustFix = 0, advisory = 0, pass = 0;
    for (const f of res.findings) {
      assert.ok(ids.indexOf(f.group) !== -1, "unknown group " + f.group);
      assert.ok(["must-fix", "advisory", "pass"].indexOf(f.severity) !== -1, f.severity);
      assert.equal(typeof f.message, "string");
      assert.ok(f.message.length > 0, f.id + " has no message");
      assert.ok(f.authority && f.authority.length > 0, f.id + " has no authority");
      if (f.severity === "must-fix") mustFix++;
      else if (f.severity === "advisory") advisory++;
      else pass++;
    }
    assert.equal(res.summary.mustFix, mustFix);
    assert.equal(res.summary.advisory, advisory);
    assert.equal(res.summary.pass, pass);
    const sum = res.groups.reduce((a, g) => a + g.checks, 0);
    assert.equal(sum, res.findings.length, "group counts must reconcile with findings");
    /* ids are unique within a run, so the UI never prints the same rule twice */
    const seen = {};
    for (const f of res.findings) {
      assert.ok(!seen[f.id], "duplicate finding id " + f.id);
      seen[f.id] = true;
    }
  }
});

test("malformed and hostile input never throws, and never prints NaN", () => {
  const cases = [
    undefined, null, 0, "", "label", [], 42, true,
    {},
    { market: 5, ingredients: "flour", nutrition: 7, allergensDeclared: "milk" },
    { netValue: "abc", netUnit: "stone", mrp: "free", pdpAreaCm2: -3 },
    { netValue: Infinity, typeSizeMm: Infinity, shelfLifeMonths: Infinity },
    { netValue: NaN, mrp: NaN, nutrition: { energyKcal: NaN, proteinG: NaN } },
    { netValue: 1e9, mrp: 1e12, shelfLifeMonths: 1e6, pdpAreaCm2: 1e9, surfaceAreaCm2: 1e9 },
    { ingredients: [null, undefined, 7, {}, { name: null, pct: "x" }, { name: "Milk", pct: -5 }] },
    { ingredients: [{ name: "<script>alert(1)</script>", pct: 50 }, { name: "Sugar & spice", pct: 50 }] },
    { packedOn: {}, shelfLifeMonths: "six", dateMode: 9 },
    { nutrition: { energyKcal: "lots", proteinG: [], carbG: {}, sodiumMg: "-" } },
    { fssaiNumber: 10012345678901, lotCode: 12345 },
    { allergensDeclared: [1, 2, 3], sulphiteMgKg: "ten" },
    { market: "PH", ingredients: [{ name: "Hipon", pct: 100 }], packHeightMm: "tall" },
    { foodName: "x".repeat(500), maker: "y".repeat(500) },
    { packForm: "crate", blownOrMoulded: "yes", veg: 7 }
  ];
  for (const input of cases) {
    const label = JSON.stringify(input);
    let res;
    assert.doesNotThrow(() => { res = R.lint(input); }, "threw on " + label);
    const blob = JSON.stringify(res.findings) + res.labelText + JSON.stringify(res.derived) +
      JSON.stringify(res.summary) + JSON.stringify(res.nutrition) + res.verdict;
    assert.equal(/NaN/.test(blob), false, "NaN leaked for " + label);
    assert.equal(/Infinity/.test(blob), false, "Infinity leaked for " + label);
    assert.equal(/undefined/.test(blob), false, "undefined leaked for " + label);
    assert.equal(Number.isFinite(res.summary.mustFix), true);
    assert.equal(Number.isFinite(res.summary.checks), true);
    assert.ok(res.summary.checks > 0, "no checks ran for " + label);
    assert.equal(typeof res.labelText, "string");
  }
});

test("overrides cannot smuggle in a non-numeric or negative constant", () => {
  const cfg = R.makeConfig({
    SULPHITE_DECLARE_MG_KG: 25,
    ENERGY_TOLERANCE_PCT: 0,
    IN_RDA_SODIUM_MG: -1,
    LM_TYPE_TABLE: "nonsense",
    KCAL_PER_G_FAT: "nine"
  });
  assert.equal(cfg.SULPHITE_DECLARE_MG_KG, 25);
  assert.equal(cfg.ENERGY_TOLERANCE_PCT, 0);
  assert.equal(cfg.IN_RDA_SODIUM_MG, C.IN_RDA_SODIUM_MG);
  assert.equal(cfg.KCAL_PER_G_FAT, C.KCAL_PER_G_FAT);
  assert.deepEqual(cfg.LM_TYPE_TABLE, C.LM_TYPE_TABLE);
  /* the constant block itself is not mutated by making a config */
  assert.equal(C.SULPHITE_DECLARE_MG_KG, 10);
});

test("every overridable constant named for the UI exists and is numeric", () => {
  for (const o of R.OVERRIDABLE) {
    assert.equal(typeof C[o.key], "number", o.key + " must be a numeric constant");
    assert.ok(o.label && o.label.length > 0, o.key + " needs a label");
    const cfg = R.makeConfig({ [o.key]: C[o.key] + 1 });
    assert.equal(cfg[o.key], C[o.key] + 1, o.key + " must be overridable");
  }
});

test("nothing in the engine enforces a rule that is only proposed", () => {
  /* Front-of-pack nutrition labelling and the bold/enlarged nutrient draft were never
     notified in India, and the Philippine warning-label bills are still bills. No
     finding may mention them as a requirement. */
  const corpus = [clean({}), cleanPH({}), {}].map((i) => JSON.stringify(R.lint(i).findings)).join(" ");
  for (const word of ["front-of-pack", "Indian Nutrition Rating", "health star", "octagon",
    "HIGH IN SUGAR", "star rating"]) {
    assert.equal(corpus.toLowerCase().indexOf(word.toLowerCase()), -1,
      "findings must not enforce the un-notified rule: " + word);
  }
});
