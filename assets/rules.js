/* Food label rule engine for packaged food sold in India and the Philippines.
   Pure logic: no DOM, no network, no globals beyond the single exported object.
   Loaded by the page as a plain script and by the test suite as a module. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) { module.exports = api; }
  else { root.LabelRules = api; }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* =====================================================================
     1. STATUTORY CONSTANTS — every figure, threshold and format rule.
        One place, each with the issuing authority and the provision it
        comes from. All are INDICATIVE: verify against the current
        notification before you print. Values marked overridable can be
        changed by the user at runtime (see makeConfig).
     ===================================================================== */

  var AUTHORITY = {
    FSSAI: "FSSAI · Food Safety and Standards (Labelling and Display) Regulations, 2020",
    LMPC: "Dept. of Consumer Affairs · Legal Metrology (Packaged Commodities) Rules, 2011",
    PHFDA: "Philippine FDA · Administrative Order 2014-0030",
    PHFDA_SB: "Philippine FDA · Administrative Order 2014-0030-A (sweetened beverages)",
    PHFDA_88B: "Philippine FDA · Administrative Order 88-B s. 1984 (net contents type size)",
    PHFDA_NUT: "Philippine FDA · FDA Circular 2023-009 (PDRI 2015 basis)",
    PHFDA_TFA: "Philippine DOH · Administrative Order 2021-0039 (trans-fatty acids)",
    CODEX: "Codex Alimentarius · CXS 1-1985 (General Standard for the Labelling of Prepackaged Foods)",
    TOOL: "Open MSME · arithmetic cross-check, not a statutory rule"
  };

  var C = {
    /* ---- India: type size. Two different tables apply to one pack.
       FSSAI Reg. 6(3) Table I governs the mandatory information generally; its proviso
       sends net weight, retail sale price, the date declarations and consumer care
       details to the Legal Metrology table instead, which is stricter in the middle
       bands. Both key off the area of the principal display panel. ---- */
    IN_TYPE_TABLE: [                   // FSSAI Reg. 6(3) Table I
      { upToCm2: 200, mm: 1, blownMm: 2 },
      { upToCm2: 500, mm: 2, blownMm: 4 },
      { upToCm2: 2500, mm: 3, blownMm: 5 },
      { upToCm2: Infinity, mm: 6, blownMm: 8 }
    ],
    /* r. 7(2) Table I, substituted by G.S.R. 629(E) of 23.06.2017 w.e.f. 01.01.2018.
       The 2 mm in the first blown band is the correction made by G.S.R. 1373(E) of
       07.11.2017; copies that still print 1.5 there are stale. By r. 7(5) this table
       binds net weight, retail sale price, the date declarations and consumer care
       details even where another law also governs the package. */
    LM_TYPE_TABLE: [
      { upToCm2: 50, mm: 1, blownMm: 2 },
      { upToCm2: 100, mm: 1.5, blownMm: 3 },
      { upToCm2: 500, mm: 2.5, blownMm: 4 },
      { upToCm2: 2500, mm: 4, blownMm: 6 },
      { upToCm2: Infinity, mm: 6, blownMm: 6 }
    ],
    LM_UNIT_PRICE_DP: 2,               // r. 6(11): unit sale price to two decimal places
    IN_SCHEDULE_II_MIN_MM: 3,          // FSSAI Reg. 7(1): boxed Schedule-II warnings
    IN_LETTER_WIDTH_RATIO: 3,          // Reg. 6(3): width at least one third of height

    /* ---- India: small-package relief (FSSAI Reg. 8), by PACKAGE SURFACE AREA ---- */
    IN_EXEMPT_SURFACE_CM2: 100,        // r. 8(1): ingredients, lot, nutrition, additives,
                                       //   logo + licence no., importer address, use
    IN_NO_DATE_SURFACE_CM2: 30,        // r. 8(1A): date of manufacture and use-by relief

    /* ---- India: net quantity (Legal Metrology PC Rules 2011, r. 13) ----
       Below one kilogram the unit is the gram and below one litre the millilitre;
       at or above, the kilogram and the litre. At EXACTLY one kilogram or one litre
       the proviso to r. 13(3) lets the packer choose, so "1 kg" and "1000 g" are
       both lawful and neither is flagged. */
    LM_G_TO_KG_AT: 1000,
    LM_ML_TO_L_AT: 1000,
    LM_SMALL_PACK_EXEMPT_G: 10,        // r. 26(a): 10 g / 10 ml or less is outside the
                                       //   whole of these rules (tobacco and pan masala apart)
    /* r. 6(1)(e) has prescribed NO format since 01.10.2022: the price must simply show
       that it is the maximum retail price, inclusive of all taxes, in Indian currency.
       The strings below are the gazette's own pre-2022 illustration, kept as a safe
       example rather than as a requirement. */
    LM_MRP_WORDING: "Maximum retail price",
    LM_MRP_SUFFIX: "(incl. of all taxes)",

    /* ---- India: veg / non-veg symbol (FSSAI Reg. 5(4)(c)), by PDP area ---- */
    IN_SYMBOL_TABLE: [                 // circle diameter / triangle side / square side, mm
      { upToCm2: 100, circleMm: 3, triangleMm: 2.5, squareMm: 6 },
      { upToCm2: 500, circleMm: 4, triangleMm: 3.5, squareMm: 8 },
      { upToCm2: 2500, circleMm: 6, triangleMm: 5, squareMm: 12 },
      { upToCm2: Infinity, circleMm: 8, triangleMm: 7, squareMm: 16 }
    ],
    IN_VEG_COLOUR: "green filled circle inside a square with a green outline",
    IN_NONVEG_COLOUR: "brown filled triangle inside a square with a brown outline",

    /* ---- India: FSSAI licence number ---- */
    FSSAI_DIGITS: 14,
    FSSAI_FIRST_DIGIT_LICENCE: "1",     // licence
    FSSAI_FIRST_DIGIT_REGISTRATION: "2",// registration (petty food business)

    /* ---- India: other thresholds in the 2020 regulations ---- */
    IN_SHORT_SHELF_MONTHS: 3,          // Reg. 5(10)(b)(i): DD/MM/YY at or below this,
                                       //   month and year above it
    IN_COMPOUND_INGREDIENT_PCT: 5,     // Reg. 5(2)(e): below this, sub-ingredients need
                                       //   not be broken out (food additives apart)
    IN_POLYOL_WARNING_PCT: 10,         // Schedule II: laxative-effect warning
    IN_FAT_DECLARE_MIN_PCT: 0.5,       // Reg. 5(3)(b): saturated fat, trans fat and
                                       //   cholesterol only where total fat exceeds this
    IN_TOLERANCE_GAZETTED_PCT: 10,     // Reg. 5(3)(d) as gazetted: maximum minus 10%
    IN_TOLERANCE_DIRECTION_PCT: 20,    // the +/- 20% operationalised by direction instead

    /* ---- Allergens (FSSAI 2020 Reg. 5(14); PH FDA AO 2014-0030 VI.A.9; Codex) ---- */
    SULPHITE_DECLARE_MG_KG: 10,        // declare when sulphite is at or above this (overridable)
    GLUTEN_CARVEOUT_MG_KG: 20,         // Reg. 5(14): glucose syrups and maltodextrins

    /* ---- Nutrition reference values, India (FSSAI 2020, % contribution to RDA) ---- */
    IN_RDA_ENERGY_KCAL: 2000,
    IN_RDA_TOTAL_FAT_G: 67,
    IN_RDA_SAT_FAT_G: 22,
    IN_RDA_TRANS_FAT_G: 2,
    IN_RDA_ADDED_SUGAR_G: 50,
    IN_RDA_SODIUM_MG: 2000,
    IN_RDA_SALT_G: 5,

    /* ---- Philippines: type size.
       AO 2014-0030 prescribes NO numeric minimum letter height for mandatory information:
       V.D sets a legibility standard and VI.A.1.e makes the product name a RELATIVE rule
       ("a size reasonably related to the biggest printed matter on such panel"). The only
       numeric figures live in the un-repealed AO 88-B s. 1984 and bind the NET CONTENTS
       declaration alone, keyed off the height of the package or bottle. Advisory only. ---- */
    PH_NET_CONTENT_TYPE_TABLE: [       // AO 88-B s. 1984, 3.3.4
      { pkgMaxMm: 60, bottleMaxMm: 200, mm: 2 },
      { pkgMaxMm: 160, bottleMaxMm: 400, mm: 2.5 },
      { pkgMaxMm: 260, bottleMaxMm: 650, mm: 3.5 },
      { pkgMaxMm: Infinity, bottleMaxMm: Infinity, mm: 5 }
    ],
    PH_GAP_LOW_MM: 60,                 // AO 88-B 3.3.4 leaves packages of 60-80 mm uncovered:
    PH_GAP_HIGH_MM: 80,                //   a drafting gap in the original, not a typo here
    PH_SMALL_SURFACE_CM2: 30,          // AO 88-B 3.3.5: below this surface area the
    PH_SMALL_SURFACE_TYPE_MM: 1.5,     //   net-content minimum is 1.5 mm
    PH_LABEL_SPACE_EXEMPT_CM2: 10,     // AO 2014-0030 VI.A.6, VI.A.11.h.7, VIII.C
    PH_TFA_LIMIT_G_PER_100G: 2,        // DOH AO 2021-0039: limit for oils and fats

    /* ---- Nutrition reference values, Philippines.
       FDA Circular 2023-009 adopts ONLY the %REI/RNI of PDRI 2015 plus the WHO sodium
       limit, computed for a male aged 19-29 unless the product is for another group.
       There is NO Philippine reference value for total fat, saturated fat, carbohydrate
       or sugars (the AMDR was expressly excluded), so those rows carry no percentage. ---- */
    PH_RNI_ENERGY_KCAL: 2530,
    PH_RNI_PROTEIN_G: 71,
    PH_RNI_FIBRE_G: 25,
    PH_RNI_SODIUM_MG: 2000,            // WHO sodium guideline, 2012; not a PDRI value
    PH_PDRI_NOTE: "Based on PDRI 2015",
    PH_PDRI_BASIS: "Reference values: male, 19-29 years",

    /* ---- Arithmetic cross-checks (not statutory) ---- */
    KCAL_PER_G_PROTEIN: 4,
    KCAL_PER_G_CARB: 4,
    KCAL_PER_G_FAT: 9,
    ENERGY_TOLERANCE_PCT: 20,          // declared vs computed energy (overridable)
    SODIUM_TO_SALT_FACTOR: 2.5,        // salt = sodium x 2.5
    PCT_SUM_TOLERANCE: 1,              // ingredient percentages: +/- this before complaining
    SERVING_MATCH_TOLERANCE_PCT: 10,   // servings x serving size vs net quantity
    SHELF_LIFE_LONG_MONTHS: 18         // Codex: date of minimum durability relief above this
  };

  /* Which constants the user may override at runtime, and their input ids. */
  var OVERRIDABLE = [
    { key: "IN_RDA_ENERGY_KCAL", label: "Energy RDA (kcal)" },
    { key: "IN_RDA_TOTAL_FAT_G", label: "Total fat RDA (g)" },
    { key: "IN_RDA_SAT_FAT_G", label: "Saturated fat RDA (g)" },
    { key: "IN_RDA_TRANS_FAT_G", label: "Trans fat RDA (g)" },
    { key: "IN_RDA_ADDED_SUGAR_G", label: "Added sugar RDA (g)" },
    { key: "IN_RDA_SODIUM_MG", label: "Sodium RDA (mg)" },
    { key: "SULPHITE_DECLARE_MG_KG", label: "Sulphite declaration threshold (mg/kg)" },
    { key: "ENERGY_TOLERANCE_PCT", label: "Energy cross-check tolerance (%)" }
  ];

  /* =====================================================================
     2. ALLERGEN GROUPS
        The statutory groups, with the ingredient words that give them
        away — English plus the names Indian and Philippine labels
        actually use. notWhen kills the obvious false positives.
     ===================================================================== */

  var ALLERGENS = [
    {
      id: "gluten", short: "Gluten cereals",
      label: "Cereals containing gluten",
      say: "cereals containing gluten", sayIn: "the name of the cereal",
      keywords: ["wheat", "atta", "maida", "suji", "sooji", "rava", "semolina", "rawa", "dalia",
        "barley", "jau", "malt", "malted", "rye", "spelt", "oat", "oats", "triticale",
        "vital gluten", "gluten", "seitan", "vermicelli", "maida flour", "wheat flour",
        "bran", "durum", "couscous", "farina"],
      notWhen: ["buckwheat", "gluten free", "gluten-free", "oat milk", "rice bran", "bran oil"],
      /* Reg. 5(14)(i) declares the cereal, so map the ingredient word to the cereal. */
      cereal: {
        wheat: "Wheat", "wheat flour": "Wheat", atta: "Wheat", maida: "Wheat", suji: "Wheat",
        sooji: "Wheat", rava: "Wheat", rawa: "Wheat", semolina: "Wheat", dalia: "Wheat",
        "maida flour": "Wheat", durum: "Wheat", couscous: "Wheat", farina: "Wheat",
        vermicelli: "Wheat", bran: "Wheat", barley: "Barley", jau: "Barley", malt: "Barley",
        malted: "Barley", rye: "Rye", spelt: "Spelt", oat: "Oats", oats: "Oats",
        triticale: "Triticale", gluten: "Wheat", "vital gluten": "Wheat", seitan: "Wheat"
      }
    },
    {
      id: "crustacea", short: "Crustacea",
      label: "Crustacea and crustacean products",
      say: "crustacea", sayIn: "Crustacean",
      keywords: ["prawn", "shrimp", "jhinga", "crab", "kekda", "lobster", "krill", "crayfish",
        "alimango", "hipon", "sugpo", "bagoong alamang"],
      notWhen: []
    },
    {
      id: "egg", short: "Egg",
      label: "Eggs and egg products",
      say: "egg", sayIn: "Egg",
      keywords: ["egg", "eggs", "anda", "albumen", "albumin", "ovalbumin", "egg white",
        "egg yolk", "mayonnaise", "meringue", "lysozyme"],
      notWhen: ["eggplant", "egg plant", "egg-free"]
    },
    {
      id: "fish", short: "Fish",
      label: "Fish and fish products",
      say: "fish", sayIn: "Fish",
      keywords: ["fish", "machli", "anchovy", "anchovies", "tuna", "sardine", "mackerel",
        "cod", "salmon", "bombil", "surimi", "fish sauce", "patis", "bagoong", "tinapa",
        "dilis", "worcestershire"],
      notWhen: ["fish-free", "shellfish"]
    },
    {
      id: "peanut", short: "Peanuts",
      label: "Peanuts and peanut products",
      say: "peanuts", sayIn: "Nut",
      keywords: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali", "mungfali",
        "mani", "arachis", "peanut butter"],
      notWhen: ["peanut-free"]
    },
    {
      id: "treenut", short: "Tree nuts",
      label: "Tree nuts and nut products",
      say: "tree nuts", sayIn: "Nut",
      keywords: ["almond", "badam", "cashew", "kaju", "walnut", "akhrot", "pistachio", "pista",
        "hazelnut", "pecan", "macadamia", "brazil nut", "pine nut", "chilgoza", "nut paste",
        "praline", "marzipan", "nougat"],
      notWhen: ["nutmeg", "nutrition", "nutritional", "coconut", "water chestnut", "nut-free",
        "almond milk", "butternut", "nutri"]
    },
    {
      id: "soy", short: "Soy",
      label: "Soybeans and soybean products",
      say: "soy", sayIn: "Soy",
      keywords: ["soy", "soya", "soybean", "soyabean", "soya bean", "tofu", "tempeh", "miso",
        "edamame", "soy sauce", "toyo", "textured vegetable protein", "soy lecithin",
        "soya lecithin"],
      notWhen: ["soy-free"]
    },
    {
      id: "milk", short: "Milk",
      label: "Milk and milk products, including lactose",
      say: "milk", sayIn: "Milk",
      keywords: ["milk", "doodh", "butter", "makhan", "ghee", "butter oil", "butterfat",
        "cheese", "paneer", "khoya", "mawa", "curd", "dahi", "yoghurt", "yogurt", "cream",
        "malai", "whey", "casein", "caseinate", "lactose", "lactalbumin", "milk solids",
        "skimmed milk powder", "smp", "condensed milk", "kesong puti", "kefir"],
      notWhen: ["coconut milk", "soy milk", "soya milk", "almond milk", "oat milk", "rice milk",
        "milk thistle", "cocoa butter", "shea butter", "peanut butter", "milk-free",
        "coconut cream", "cream of tartar", "non-dairy creamer", "milkfish"]
    },
    {
      id: "sulphite", short: "Sulphites",
      label: "Sulphites at or above the declaration threshold",
      say: "sulphites", sayIn: "Sulphite",
      keywords: ["sulphite", "sulfite", "metabisulphite", "metabisulfite", "bisulphite",
        "bisulfite", "sulphur dioxide", "sulfur dioxide", "ins 220", "ins 221", "ins 222",
        "ins 223", "ins 224", "ins 225", "ins 226", "ins 227", "ins 228", "e220", "e223"],
      notWhen: []
    }
  ];

  /* Functional class names an additive must carry (FSSAI 2020; Codex CXS 1-1985). */
  var ADDITIVE_CLASSES = ["acidity regulator", "acid", "anticaking agent", "anti-caking agent",
    "antifoaming agent", "antioxidant", "bulking agent", "carbonating agent", "colour",
    "color", "colour retention agent", "emulsifier", "emulsifying salt", "firming agent",
    "flavour enhancer", "flavor enhancer", "flour treatment agent", "foaming agent",
    "gelling agent", "glazing agent", "humectant", "preservative", "propellant",
    "raising agent", "sequestrant", "stabiliser", "stabilizer", "sweetener", "thickener",
    "thickening agent"];

  /* Mandatory declarations by market. */
  var MANDATORY = {
    IN: [
      { id: "MD-NAME", field: "foodName", label: "Name of the food", cite: "Reg. 5(1)", auth: "FSSAI" },
      { id: "MD-MAKER", field: "maker", label: "Name of the manufacturer / packer / marketer", cite: "Reg. 5(6)", auth: "FSSAI" },
      { id: "MD-ADDRESS", field: "makerAddress", label: "Complete address of the manufacturer / packer", cite: "Reg. 5(6)", auth: "FSSAI" },
      { id: "MD-CARE", field: "consumerCare", label: "Consumer care details", cite: "r. 6(2)", auth: "LMPC" },
      { id: "MD-LOT", field: "lotCode", label: "Lot / code / batch identification", cite: "Reg. 5(9)", auth: "FSSAI" },
      { id: "MD-STORAGE", field: "storage", label: "Storage conditions", cite: "Reg. 5(10)(c)", auth: "FSSAI", severity: "advisory" },
      { id: "MD-USAGE", field: "usage", label: "Instructions for use", cite: "Reg. 5(13)", auth: "FSSAI", severity: "advisory" }
    ],
    PH: [
      { id: "MD-NAME", field: "foodName", label: "Name of the food", cite: "VI.A.1", auth: "PHFDA" },
      { id: "MD-BRAND", field: "brandName", label: "Brand name", cite: "VI.A.2", auth: "PHFDA" },
      { id: "MD-MAKER", field: "maker", label: "Name of the manufacturer / repacker / importer / distributor", cite: "VI.A.5", auth: "PHFDA" },
      { id: "MD-ADDRESS", field: "makerAddress", label: "Complete address of the manufacturer / distributor", cite: "VI.A.5", auth: "PHFDA" },
      { id: "MD-LOT", field: "lotCode", label: "Lot identification", cite: "VI.A.6", auth: "PHFDA" },
      { id: "MD-STORAGE", field: "storage", label: "Storage conditions (required only where the food needs other than normal room temperature)", cite: "VI.A.7", auth: "PHFDA", severity: "advisory" },
      { id: "MD-USAGE", field: "usage", label: "Directions for use (required where necessary for correct use)", cite: "VI.A.10", auth: "PHFDA", severity: "advisory" },
      { id: "MD-CARE", field: "consumerCare", label: "Consumer care contact", cite: "good practice", auth: "TOOL", severity: "advisory" }
    ]
  };

  /* Nutrients that must appear on the panel, per market. */
  var NUTRIENTS = {
    IN: [
      { key: "energyKcal", label: "Energy", unit: "kcal", rda: "IN_RDA_ENERGY_KCAL" },
      { key: "proteinG", label: "Protein", unit: "g" },
      { key: "carbG", label: "Carbohydrate", unit: "g" },
      { key: "totalSugarG", label: "Total sugars", unit: "g" },
      { key: "addedSugarG", label: "Added sugars", unit: "g", rda: "IN_RDA_ADDED_SUGAR_G" },
      { key: "totalFatG", label: "Total fat", unit: "g", rda: "IN_RDA_TOTAL_FAT_G" },
      { key: "satFatG", label: "Saturated fat", unit: "g", rda: "IN_RDA_SAT_FAT_G", onlyIfFat: true },
      { key: "transFatG", label: "Trans fat", unit: "g", rda: "IN_RDA_TRANS_FAT_G", onlyIfFat: true },
      { key: "cholesterolMg", label: "Cholesterol", unit: "mg", onlyIfFat: true, onlyAnimalFat: true },
      { key: "sodiumMg", label: "Sodium", unit: "mg", rda: "IN_RDA_SODIUM_MG" }
    ],
    /* AO 2014-0030 VI.A.11.a and Figure 1, in the order the panel prints them. */
    PH: [
      { key: "energyKcal", label: "Calories", unit: "kcal", rda: "PH_RNI_ENERGY_KCAL" },
      { key: "totalFatG", label: "Total fat", unit: "g" },
      { key: "satFatG", label: "Saturated fat", unit: "g" },
      { key: "transFatG", label: "Trans fat", unit: "g" },
      { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
      { key: "sodiumMg", label: "Sodium", unit: "mg", rda: "PH_RNI_SODIUM_MG" },
      { key: "carbG", label: "Total carbohydrate", unit: "g" },
      { key: "fibreG", label: "Dietary fibre", unit: "g", rda: "PH_RNI_FIBRE_G" },
      { key: "totalSugarG", label: "Sugar", unit: "g" },
      { key: "proteinG", label: "Protein", unit: "g", rda: "PH_RNI_PROTEIN_G" }
    ]
  };

  var GROUPS = [
    { id: "MD", label: "Mandatory declarations" },
    { id: "IL", label: "Ingredient list" },
    { id: "AL", label: "Allergens" },
    { id: "NQ", label: "Net quantity" },
    { id: "PR", label: "Price declaration" },
    { id: "DT", label: "Date marking" },
    { id: "LC", label: "Licence & traceability" },
    { id: "NU", label: "Nutrition panel" },
    { id: "AR", label: "Artwork, symbol & type size" }
  ];

  /* =====================================================================
     3. COERCION HELPERS — nothing below may throw or emit NaN.
     ===================================================================== */

  function str(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return isFinite(v) ? String(v) : "";
    if (typeof v === "boolean") return v ? "true" : "";
    return "";
  }

  /* A declared number: null when absent or unusable. 0 is a real value. */
  function numOrNull(v) {
    if (v === null || v === undefined || v === "" || v === true || v === false) return null;
    var x = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
    if (typeof x !== "number" || !isFinite(x)) return null;
    return x;
  }

  function num0(v) { var x = numOrNull(v); return x === null ? 0 : x; }

  function nonNeg(v) { var x = numOrNull(v); return x === null || x < 0 ? null : x; }

  function arr(v) { return Object.prototype.toString.call(v) === "[object Array]" ? v : []; }

  function bool(v) { return v === true || v === "true" || v === 1 || v === "1"; }

  function lower(s) { return str(s).toLowerCase(); }

  /* Normalise an ingredient name for matching: lowercase, punctuation to spaces. */
  function normalise(s) {
    var out = "", t = lower(s), i, ch;
    for (i = 0; i < t.length; i++) {
      ch = t.charAt(i);
      out += (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || ch === " " ? ch : " ";
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function isAlpha(ch) { return ch >= "a" && ch <= "z"; }

  /* Whole-word-ish containment, tolerating a plural s/es on the keyword. */
  function wordish(hay, needle) {
    if (!hay || !needle) return false;
    var i = 0, before, rest;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      before = i === 0 ? " " : hay.charAt(i - 1);
      rest = hay.slice(i + needle.length);
      if (!isAlpha(before)) {
        if (rest === "" || !isAlpha(rest.charAt(0))) return true;
        if (rest.charAt(0) === "s" && (rest.length === 1 || !isAlpha(rest.charAt(1)))) return true;
        if (rest.slice(0, 2) === "es" && (rest.length === 2 || !isAlpha(rest.charAt(2)))) return true;
      }
      i += 1;
    }
    return false;
  }

  function hasDigit(s) { return /[0-9]/.test(str(s)); }

  function round(n, dp) {
    var x = numOrNull(n);
    if (x === null) return 0;
    var f = Math.pow(10, dp || 0);
    return Math.round(x * f) / f;
  }

  function pct(part, whole) {
    var a = numOrNull(part), b = numOrNull(whole);
    if (a === null || b === null || b === 0) return null;
    return (a / b) * 100;
  }

  /* =====================================================================
     4. DATES — parse, validate, add months. DD/MM/YYYY throughout; the
        Philippine panel prints the month in words.
     ===================================================================== */

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  function daysInMonth(y, m) {
    if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
    return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] || 0;
  }

  function parseDate(s) {
    var t = str(s);
    if (!t) return { ok: false, reason: "empty" };
    var m = t.match(/^(\d{1,4})\s*[\/\-. ]\s*(\d{1,2})\s*[\/\-. ]\s*(\d{1,4})$/);
    if (!m) return { ok: false, reason: "format" };
    var a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10);
    var d, mo, y;
    if (m[1].length === 4) { y = a; mo = b; d = c; }         // YYYY-MM-DD offered: accept, warn
    else { d = a; mo = b; y = c; }
    if (m[3].length === 2 && m[1].length !== 4) return { ok: false, reason: "two-digit-year" };
    if (!(y >= 1900 && y <= 2200)) return { ok: false, reason: "year" };
    if (!(mo >= 1 && mo <= 12)) return { ok: false, reason: "month" };
    if (!(d >= 1 && d <= daysInMonth(y, mo))) return { ok: false, reason: "day" };
    return { ok: true, y: y, m: mo, d: d, iso: m[1].length === 4 };
  }

  function addMonths(dt, months) {
    var n = Math.trunc(num0(months));
    var total = (dt.m - 1) + n;
    var y = dt.y + Math.floor(total / 12);
    var m = ((total % 12) + 12) % 12 + 1;
    var d = Math.min(dt.d, daysInMonth(y, m));
    return { ok: true, y: y, m: m, d: d };
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function fmtDate(dt, style) {
    if (!dt || !dt.ok) return "";
    /* words  : the Philippine form, day in numerals and month in words
       short  : the Indian DD/MM/YY form for a shelf life of three months or less
       month  : the Indian month-and-year form, month in capitals (never all-numeric) */
    if (style === "words") return pad2(dt.d) + " " + MONTHS[dt.m - 1] + " " + dt.y;
    if (style === "short") return pad2(dt.d) + "/" + pad2(dt.m) + "/" + String(dt.y).slice(-2);
    if (style === "month") return MONTHS[dt.m - 1].slice(0, 3).toUpperCase() + " " + dt.y;
    return pad2(dt.d) + "/" + pad2(dt.m) + "/" + dt.y;
  }

  /* Reg. 5(10)(b)(i): a shelf life of three months or less needs the day; above three
     months the month and year suffice, with the month in capital letters. */
  function inDateStyle(shelfLifeMonths, cfg) {
    var m = numOrNull(shelfLifeMonths);
    if (m === null || m <= cfg.IN_SHORT_SHELF_MONTHS) return "short";
    return "month";
  }

  /* =====================================================================
     5. NET QUANTITY
     ===================================================================== */

  var UNITS = {
    g: { kind: "mass", base: 1, symbol: "g" },
    kg: { kind: "mass", base: 1000, symbol: "kg" },
    ml: { kind: "volume", base: 1, symbol: "ml" },
    l: { kind: "volume", base: 1000, symbol: "l" }
  };

  function baseQty(value, unit) {
    var u = UNITS[lower(unit)];
    var v = nonNeg(value);
    if (!u || v === null) return null;
    return v * u.base;
  }

  /* The declaration string itself: numeral, single space, lower-case symbol. */
  function formatNetQuantity(value, unit, label) {
    var u = UNITS[lower(unit)];
    var v = nonNeg(value);
    if (!u || v === null) return "";
    var shown = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(round(v, 3));
    return (label || "Net quantity") + ": " + shown + " " + u.symbol;
  }

  /* r. 13: gram below a kilogram, kilogram at or above; millilitre below a litre,
     litre at or above. At exactly 1 kg / 1 l the proviso allows either, so "both"
     is returned and neither declaration is flagged. */
  function preferredUnitOrBoth(baseValue, kind, cfg) {
    var at = kind === "mass" ? cfg.LM_G_TO_KG_AT : cfg.LM_ML_TO_L_AT;
    if (baseValue === at) return "both";
    if (kind === "mass") return baseValue > at ? "kg" : "g";
    return baseValue > at ? "l" : "ml";
  }

  /* Height off a PDP-area table; blown, formed or moulded lettering needs more. */
  function heightFromTable(table, pdpAreaCm2, blown) {
    var a = pdpAreaCm2 === null || pdpAreaCm2 <= 0 ? Infinity : pdpAreaCm2, i;
    for (i = 0; i < table.length; i++) {
      if (a <= table[i].upToCm2) { return blown ? table[i].blownMm : table[i].mm; }
    }
    return blown ? table[table.length - 1].blownMm : table[table.length - 1].mm;
  }

  /* India prescribes a letter height; the Philippines prescribes none (null). */
  function minLetterMm(pdpAreaCm2, market, cfg, blown) {
    if (market !== "IN") return null;
    return heightFromTable(cfg.IN_TYPE_TABLE, pdpAreaCm2, blown);
  }

  /* Net weight, price, dates and consumer care follow the Legal Metrology table. */
  function lmLetterMm(pdpAreaCm2, cfg, blown) {
    return heightFromTable(cfg.LM_TYPE_TABLE, pdpAreaCm2, blown);
  }

  /* AO 88-B s. 1984: net-contents type size, by package or bottle height. */
  function phNetContentMinMm(heightMm, isBottle, surfaceCm2, cfg) {
    if (surfaceCm2 !== null && surfaceCm2 > 0 && surfaceCm2 < cfg.PH_SMALL_SURFACE_CM2) {
      return { mm: cfg.PH_SMALL_SURFACE_TYPE_MM, basis: "surface area under " + cfg.PH_SMALL_SURFACE_CM2 + " cm2" };
    }
    if (heightMm === null || heightMm <= 0) return { mm: null, basis: "pack height not entered" };
    var key = isBottle ? "bottleMaxMm" : "pkgMaxMm", i, t = cfg.PH_NET_CONTENT_TYPE_TABLE;
    var gap = !isBottle && heightMm > cfg.PH_GAP_LOW_MM && heightMm <= cfg.PH_GAP_HIGH_MM;
    for (i = 0; i < t.length; i++) {
      if (heightMm <= t[i][key]) {
        return { mm: t[i].mm, basis: (isBottle ? "bottle" : "package") + " height " + heightMm + " mm", gap: gap };
      }
    }
    return { mm: t[t.length - 1].mm, basis: (isBottle ? "bottle" : "package") + " height " + heightMm + " mm" };
  }

  /* Reg. 5(4)(c): the minimum is the circle diameter for the vegetarian mark and the
     triangle side for the non-vegetarian mark; the enclosing square has its own size. */
  function symbolSizes(pdpAreaCm2, cfg) {
    var a = pdpAreaCm2 === null || pdpAreaCm2 <= 0 ? Infinity : pdpAreaCm2, i, t = cfg.IN_SYMBOL_TABLE;
    for (i = 0; i < t.length; i++) { if (a <= t[i].upToCm2) return t[i]; }
    return t[t.length - 1];
  }

  function minSymbolMm(pdpAreaCm2, cfg, veg) {
    var row = symbolSizes(pdpAreaCm2, cfg);
    return veg === "nonveg" ? row.triangleMm : row.circleMm;
  }

  /* =====================================================================
     6. ALLERGEN DETECTION
     ===================================================================== */

  function detectAllergens(ingredients, sulphiteMgKg, cfg) {
    var hits = [], seen = {}, i, j, g, name, probe, k;
    var list = arr(ingredients);
    for (i = 0; i < list.length; i++) {
      name = normalise(list[i] && list[i].name);
      if (!name) continue;
      for (j = 0; j < ALLERGENS.length; j++) {
        g = ALLERGENS[j];
        probe = name;
        for (k = 0; k < g.notWhen.length; k++) { probe = probe.split(g.notWhen[k]).join(" "); }
        probe = probe.replace(/\s+/g, " ").trim();
        if (!probe) continue;
        var hitWord = matchesGroup(probe, g);
        if (hitWord && !seen[g.id]) {
          seen[g.id] = true;
          hits.push({
            group: g.id, label: g.label, say: g.say, sayIn: g.sayIn,
            keyword: hitWord, ingredient: str(list[i].name)
          });
        }
      }
    }
    var sulph = nonNeg(sulphiteMgKg);
    if (sulph !== null && sulph >= cfg.SULPHITE_DECLARE_MG_KG && !seen.sulphite) {
      seen.sulphite = true;
      hits.push({
        group: "sulphite", label: "Sulphites at or above the declaration threshold",
        say: "sulphites", sayIn: "Sulphite", ingredient: sulph + " mg/kg declared content"
      });
    }
    return hits;
  }

  /* Returns the keyword that matched, so the label can name the cereal. */
  function matchesGroup(probe, g) {
    var i, best = "";
    for (i = 0; i < g.keywords.length; i++) {
      if (wordish(probe, g.keywords[i]) && g.keywords[i].length > best.length) { best = g.keywords[i]; }
    }
    return best;
  }

  function allergenLabel(id) {
    var i;
    for (i = 0; i < ALLERGENS.length; i++) { if (ALLERGENS[i].id === id) return ALLERGENS[i]; }
    return null;
  }

  /* =====================================================================
     7. CONFIG
     ===================================================================== */

  function makeConfig(overrides) {
    var cfg = {}, k;
    for (k in C) { if (Object.prototype.hasOwnProperty.call(C, k)) { cfg[k] = C[k]; } }
    if (overrides && typeof overrides === "object") {
      for (k in overrides) {
        if (!Object.prototype.hasOwnProperty.call(overrides, k)) continue;
        if (!Object.prototype.hasOwnProperty.call(cfg, k)) continue;
        var v = numOrNull(overrides[k]);
        if (typeof cfg[k] === "number" && v !== null && v >= 0) { cfg[k] = v; }
      }
    }
    return cfg;
  }

  /* =====================================================================
     8. NUTRITION
     ===================================================================== */

  function computedEnergy(n, cfg) {
    var p = nonNeg(n.proteinG), c = nonNeg(n.carbG), f = nonNeg(n.totalFatG);
    if (p === null && c === null && f === null) return null;
    return num0(p) * cfg.KCAL_PER_G_PROTEIN + num0(c) * cfg.KCAL_PER_G_CARB +
      num0(f) * cfg.KCAL_PER_G_FAT;
  }

  function saltEquivalentG(sodiumMg, cfg) {
    var s = nonNeg(sodiumMg);
    if (s === null) return null;
    return (s * cfg.SODIUM_TO_SALT_FACTOR) / 1000;
  }

  /* Animal-origin fat: the trigger for the cholesterol declaration in India. */
  var ANIMAL_FAT_WORDS = ["chicken", "mutton", "lamb", "pork", "lard", "beef", "tallow",
    "gelatin", "gelatine", "meat", "bacon", "ham", "suet", "dripping", "fish oil", "cod liver"];

  function hasAnimalFat(ingredients, detected) {
    var i, n;
    for (i = 0; i < arr(detected).length; i++) {
      if (["milk", "egg", "fish", "crustacea"].indexOf(detected[i].group) !== -1) return true;
    }
    for (i = 0; i < arr(ingredients).length; i++) {
      n = normalise(ingredients[i] && ingredients[i].name);
      for (var j = 0; j < ANIMAL_FAT_WORDS.length; j++) {
        if (wordish(n, ANIMAL_FAT_WORDS[j])) return true;
      }
    }
    return false;
  }

  /* The nutrients this particular food must declare, after the provisos. */
  function requiredNutrients(inp, cfg, detected) {
    var defs = NUTRIENTS[inp.market] || NUTRIENTS.IN, out = [], i, d;
    var fat = nonNeg(inp.nutrition.totalFatG);
    var fatty = fat === null || fat > cfg.IN_FAT_DECLARE_MIN_PCT;
    var animal = hasAnimalFat(inp.ingredients, detected);
    for (i = 0; i < defs.length; i++) {
      d = defs[i];
      if (inp.market === "IN" && d.onlyIfFat && !fatty) continue;
      if (inp.market === "IN" && d.onlyAnimalFat && !animal) continue;
      out.push(d);
    }
    return out;
  }

  function nutritionRows(nutrition, market, cfg, defsIn) {
    var defs = arr(defsIn).length ? defsIn : (NUTRIENTS[market] || NUTRIENTS.IN);
    var serving = nonNeg(nutrition.servingSizeG);
    var rows = [], i, d, per100, perServe, rdaVal, rdaPct;
    for (i = 0; i < defs.length; i++) {
      d = defs[i];
      per100 = nonNeg(nutrition[d.key]);
      perServe = per100 === null || serving === null ? null : per100 * (serving / 100);
      rdaVal = d.rda ? cfg[d.rda] : null;
      rdaPct = rdaVal && perServe !== null ? pct(perServe, rdaVal) : null;
      rows.push({
        key: d.key, label: d.label, unit: d.unit,
        per100: per100, perServe: perServe,
        rdaBasis: rdaVal || null, rdaPct: rdaPct
      });
    }
    return rows;
  }

  /* =====================================================================
     9. THE LINT RULES
     ===================================================================== */

  function Report() {
    this.findings = [];
  }
  Report.prototype.add = function (id, group, severity, message, auth, cite) {
    this.findings.push({
      id: id, group: group, severity: severity, message: message,
      authority: AUTHORITY[auth] || AUTHORITY.TOOL, cite: cite || ""
    });
  };

  function readInput(raw) {
    var src = raw && typeof raw === "object" ? raw : {};
    var market = str(src.market).toUpperCase() === "PH" ? "PH" : "IN";
    var ing = arr(src.ingredients).map(function (row) {
      var r = row && typeof row === "object" ? row : {};
      return { name: str(r.name), pct: nonNeg(r.pct) };
    }).filter(function (r) { return r.name !== "" || r.pct !== null; });
    return {
      market: market,
      foodName: str(src.foodName),
      brandName: str(src.brandName),
      descriptor: str(src.descriptor),
      veg: str(src.veg).toLowerCase() === "nonveg" ? "nonveg" : "veg",
      maker: str(src.maker),
      makerAddress: str(src.makerAddress),
      consumerCare: str(src.consumerCare),
      lotCode: str(src.lotCode),
      storage: str(src.storage),
      usage: str(src.usage),
      imported: bool(src.imported),
      origin: str(src.origin),
      netValue: nonNeg(src.netValue),
      netUnit: UNITS[lower(src.netUnit)] ? lower(src.netUnit) : "g",
      drainedValue: nonNeg(src.drainedValue),
      mrp: nonNeg(src.mrp),
      pdpAreaCm2: nonNeg(src.pdpAreaCm2),
      surfaceAreaCm2: nonNeg(src.surfaceAreaCm2),
      blownOrMoulded: bool(src.blownOrMoulded),
      packHeightMm: nonNeg(src.packHeightMm),
      packForm: str(src.packForm).toLowerCase() === "bottle" ? "bottle" : "package",
      typeSizeMm: nonNeg(src.typeSizeMm),
      qtyNumeralMm: nonNeg(src.qtyNumeralMm),
      symbolSizeMm: nonNeg(src.symbolSizeMm),
      symbolPrinted: bool(src.symbolPrinted),
      logoPrinted: bool(src.logoPrinted),
      allergensEmphasised: bool(src.allergensEmphasised),
      fssaiNumber: str(src.fssaiNumber),
      fdaNumber: str(src.fdaNumber),
      packedOn: str(src.packedOn),
      shelfLifeMonths: nonNeg(src.shelfLifeMonths),
      dateMode: str(src.dateMode).toLowerCase() === "use-by" ? "use-by" : "best-before",
      ingredients: ing,
      sulphiteMgKg: nonNeg(src.sulphiteMgKg),
      allergensDeclared: arr(src.allergensDeclared).map(lower).filter(function (a) { return !!allergenLabel(a); }),
      nutrition: (function (n) {
        var o = n && typeof n === "object" ? n : {};
        return {
          energyKcal: nonNeg(o.energyKcal), proteinG: nonNeg(o.proteinG), carbG: nonNeg(o.carbG),
          totalSugarG: nonNeg(o.totalSugarG), addedSugarG: nonNeg(o.addedSugarG),
          totalFatG: nonNeg(o.totalFatG), satFatG: nonNeg(o.satFatG), transFatG: nonNeg(o.transFatG),
          cholesterolMg: nonNeg(o.cholesterolMg), fibreG: nonNeg(o.fibreG),
          sodiumMg: nonNeg(o.sodiumMg), servingSizeG: nonNeg(o.servingSizeG),
          servingsPerPack: nonNeg(o.servingsPerPack)
        };
      })(src.nutrition)
    };
  }

  function checkMandatory(inp, rep) {
    var list = MANDATORY[inp.market] || MANDATORY.IN, i, d, val;
    for (i = 0; i < list.length; i++) {
      d = list[i];
      val = inp[d.field];
      if (str(val)) { rep.add(d.id, "MD", "pass", d.label + " declared.", d.auth, d.cite); }
      else {
        rep.add(d.id, "MD", d.severity || "must-fix",
          d.label + " is missing from the label.", d.auth, d.cite);
      }
    }
    if (inp.imported) {
      if (inp.origin) { rep.add("MD-ORIGIN", "MD", "pass", "Country of origin declared for the imported food.", inp.market === "IN" ? "FSSAI" : "PHFDA", inp.market === "IN" ? "Reg. 5(12)" : "VI.A.5.c"); }
      else { rep.add("MD-ORIGIN", "MD", "must-fix", "Imported food must declare the country of origin alongside the importer's name and address.", inp.market === "IN" ? "FSSAI" : "PHFDA", inp.market === "IN" ? "Reg. 5(12)" : "VI.A.5.c"); }
    }

    /* r. 6(2): name, address, telephone number and e-mail address, all four. */
    if (inp.market === "IN" && inp.consumerCare) {
      var hasMail = inp.consumerCare.indexOf("@") !== -1;
      var hasPhone = (inp.consumerCare.replace(/[^0-9]/g, "")).length >= 6;
      if (!hasMail || !hasPhone) {
        rep.add("MD-CARE-PARTS", "MD", "must-fix", "Consumer care details must give a telephone number and an e-mail address" +
          (hasMail ? ", and this one has no telephone number." : hasPhone ? ", and this one has no e-mail address." : "; this one has neither."),
          "LMPC", "r. 6(2)");
      } else {
        rep.add("MD-CARE-PARTS", "MD", "pass", "Consumer care details carry both a telephone number and an e-mail address.", "LMPC", "r. 6(2)");
      }
    }

    /* Philippine sweetened beverages must name the sweetener used. Liquid pack = beverage. */
    if (inp.market === "PH" && UNITS[inp.netUnit] && UNITS[inp.netUnit].kind === "volume") {
      var sweeteners = ["sugar", "sucrose", "glucose", "fructose", "high fructose corn syrup",
        "corn syrup", "sucralose", "aspartame", "acesulfame", "saccharin", "stevia", "steviol",
        "sorbitol", "maltitol", "xylitol", "honey", "molasses", "jaggery"];
      var found = "", i, j, nm;
      for (i = 0; i < inp.ingredients.length && !found; i++) {
        nm = normalise(inp.ingredients[i].name);
        for (j = 0; j < sweeteners.length; j++) {
          if (wordish(nm, sweeteners[j])) { found = inp.ingredients[i].name; break; }
        }
      }
      if (found) {
        rep.add("MD-SWEETENER", "MD", "advisory", "This reads as a sweetened beverage (" + found +
          " in a liquid pack). The label must state the type of sweetener used, and a powder must state how many litres the pack makes under the directions for use.", "PHFDA_SB", "VI.B.5");
      }
    }
  }

  function checkIngredients(inp, rep) {
    var ing = inp.ingredients, i, sum = 0, withPct = 0, names = {}, dup = [];
    var auth = inp.market === "IN" ? "FSSAI" : "PHFDA";
    var cite = inp.market === "IN" ? "Reg. 5(5)" : "VI.A.3";

    if (ing.length === 0) {
      rep.add("IL-COUNT", "IL", "must-fix", "No ingredients entered — a multi-ingredient food must carry a list of ingredients.", auth, cite);
      return;
    }
    if (ing.length === 1) {
      rep.add("IL-COUNT", "IL", "advisory", "Single-ingredient food: the ingredient list may be omitted if the name of the food already says what it is.", auth, cite);
    } else {
      rep.add("IL-COUNT", "IL", "pass", ing.length + " ingredients listed.", auth, cite);
    }

    /* Descending order by weight at the time of manufacture. */
    var breach = null;
    for (i = 1; i < ing.length; i++) {
      if (ing[i].pct === null || ing[i - 1].pct === null) continue;
      if (ing[i].pct > ing[i - 1].pct + 1e-9) {
        breach = { a: ing[i - 1], b: ing[i], at: i };
        break;
      }
    }
    if (breach) {
      rep.add("IL-ORDER", "IL", "must-fix",
        "Ingredients are not in descending order: " + breach.b.name + " (" + round(breach.b.pct, 2) +
        "%) is listed after " + breach.a.name + " (" + round(breach.a.pct, 2) + "%).", auth, cite);
    } else {
      rep.add("IL-ORDER", "IL", "pass", "Ingredients are in descending order of composition by weight.", auth, cite);
    }

    for (i = 0; i < ing.length; i++) {
      if (ing[i].pct !== null) { sum += ing[i].pct; withPct++; }
      var key = normalise(ing[i].name);
      if (key && names[key]) { dup.push(ing[i].name); } else if (key) { names[key] = true; }
    }

    if (withPct === 0) {
      rep.add("IL-PCT", "IL", "advisory", "No ingredient percentages entered, so the descending order cannot be verified.", "TOOL", "");
    } else if (withPct < ing.length) {
      rep.add("IL-PCT", "IL", "advisory", (ing.length - withPct) + " of " + ing.length +
        " ingredients have no percentage, so their position in the order cannot be verified.", "TOOL", "");
    } else {
      rep.add("IL-PCT", "IL", "pass", "Every ingredient carries a percentage.", "TOOL", "");
    }

    if (withPct === ing.length && sum > 100 + C.PCT_SUM_TOLERANCE) {
      rep.add("IL-SUM", "IL", "must-fix", "Ingredient percentages add up to " + round(sum, 2) +
        "% — more than 100% of the product.", "TOOL", "");
    } else if (withPct === ing.length && sum < 100 - C.PCT_SUM_TOLERANCE) {
      rep.add("IL-SUM", "IL", "advisory", "Ingredient percentages add up to " + round(sum, 2) +
        "%; the list may be incomplete.", "TOOL", "");
    } else if (withPct > 0) {
      rep.add("IL-SUM", "IL", "pass", "Ingredient percentages add up to " + round(sum, 2) + "%.", "TOOL", "");
    }

    if (dup.length) {
      rep.add("IL-DUP", "IL", "advisory", "Repeated ingredient: " + dup.join(", ") +
        ". Combine repeated ingredients and declare the total.", auth, cite);
    } else {
      rep.add("IL-DUP", "IL", "pass", "No repeated ingredient names.", auth, cite);
    }

    /* Additives: functional class name plus INS number. */
    var classOnly = [], numberOnly = [];
    for (i = 0; i < ing.length; i++) {
      var n = normalise(ing[i].name);
      var hasClass = false, j;
      for (j = 0; j < ADDITIVE_CLASSES.length; j++) {
        if (n.indexOf(ADDITIVE_CLASSES[j]) !== -1) { hasClass = true; break; }
      }
      var hasINS = hasDigit(ing[i].name) && /(^|[^a-z])(ins|e)\s*\d{3}/i.test(" " + normalise(ing[i].name));
      if (hasClass && !hasINS) { classOnly.push(ing[i].name); }
      if (!hasClass && hasINS) { numberOnly.push(ing[i].name); }
    }
    if (classOnly.length) {
      rep.add("IL-INS", "IL", "must-fix", "Additive declared by class name without its INS number: " +
        classOnly.join(", ") + ".", auth, inp.market === "IN" ? "Reg. 5(5)" : "VI.A.3");
    } else if (numberOnly.length) {
      rep.add("IL-INS", "IL", "advisory", "Additive declared by number without its functional class name: " +
        numberOnly.join(", ") + ".", auth, inp.market === "IN" ? "Reg. 5(5)" : "VI.A.3");
    } else {
      rep.add("IL-INS", "IL", "pass", "No additive is declared without both its class name and INS number.", auth, "");
    }

    /* Added water. */
    var waterPct = null;
    for (i = 0; i < ing.length; i++) {
      if (wordish(normalise(ing[i].name), "water")) { waterPct = ing[i].pct; }
    }
    if (waterPct !== null && waterPct > 5) {
      rep.add("IL-WATER", "IL", "advisory", "Added water is " + round(waterPct, 2) +
        "% — it must be declared in the ingredient list in its correct position by weight.", "CODEX", "4.2.1.4");
    } else {
      rep.add("IL-WATER", "IL", "pass", "Added water needs no separate treatment here.", "CODEX", "4.2.1.4");
    }

    /* Schedule II box declarations that particular ingredients drag in. */
    var warn = scheduleWarnings(inp, C), wi;
    if (warn.length) {
      for (wi = 0; wi < warn.length; wi++) {
        rep.add("IL-WARN-" + warn[wi].id.toUpperCase(), "IL", "advisory", warn[wi].why +
          " brings a statutory warning with it. The label copy below carries the wording; print it inside a rectangular box in letters of at least " +
          C.IN_SCHEDULE_II_MIN_MM + " mm.", "FSSAI", "Reg. 7(1), Schedule II");
      }
    }

    /* Liquid medium: drained weight. */
    var liquidMedium = false;
    for (i = 0; i < ing.length; i++) {
      var nn = normalise(ing[i].name);
      if (wordish(nn, "brine") || wordish(nn, "syrup") || nn.indexOf("liquid medium") !== -1) { liquidMedium = true; }
    }
    if (liquidMedium && inp.drainedValue === null) {
      rep.add("NQ-DRAINED", "NQ", "advisory", "This looks like a food packed in a liquid medium (brine or syrup). Declare the drained weight as well as the net quantity.",
        inp.market === "IN" ? "LMPC" : "PHFDA", inp.market === "IN" ? "r. 8" : "Sec. 5");
    }
  }

  function checkAllergens(inp, rep, cfg) {
    var detected = detectAllergens(inp.ingredients, inp.sulphiteMgKg, cfg);
    var declared = inp.allergensDeclared;
    var auth = inp.market === "IN" ? "FSSAI" : "PHFDA";
    var cite = inp.market === "IN" ? "Reg. 5(14)" : "VI.A.9";
    var i, undeclared = [], orphan = [], has = {};
    for (i = 0; i < declared.length; i++) { has[declared[i]] = true; }
    var found = {};
    for (i = 0; i < detected.length; i++) {
      found[detected[i].group] = true;
      if (!has[detected[i].group]) {
        undeclared.push(detected[i].label + " (from " + detected[i].ingredient + ")");
      }
    }
    for (i = 0; i < declared.length; i++) {
      if (!found[declared[i]]) { orphan.push(allergenLabel(declared[i]).label); }
    }

    if (undeclared.length) {
      rep.add("AL-UNDECLARED", "AL", "must-fix", "Allergen present but not declared: " +
        undeclared.join("; ") + ".", auth, cite);
    } else if (detected.length) {
      rep.add("AL-UNDECLARED", "AL", "pass", "All " + detected.length +
        " allergen group(s) found in the ingredients are declared.", auth, cite);
    } else {
      rep.add("AL-UNDECLARED", "AL", "pass", "No statutory allergen group detected in the ingredient list.", auth, cite);
    }

    if (orphan.length) {
      rep.add("AL-ORPHAN", "AL", "advisory", "Declared but not visible in the ingredient list: " +
        orphan.join(", ") + ". Correct if this is a cross-contact (\"may contain\") statement.", auth, cite);
    } else {
      rep.add("AL-ORPHAN", "AL", "pass", "Every declared allergen traces back to an ingredient.", auth, cite);
    }

    if (detected.length && !inp.allergensEmphasised) {
      rep.add("AL-EMPHASIS", "AL", "advisory",
        "Neither rule set requires bold or capitals for allergens — only that the declaration is clear, conspicuous and legible, set out below the ingredient list. Emphasis is still worth having, and several export markets do require it.",
        "CODEX", "4.2.1.4");
    } else if (detected.length) {
      rep.add("AL-EMPHASIS", "AL", "pass", "Allergen words are emphasised on the artwork. Neither rule set demands it, but it helps and export markets often require it.", "CODEX", "4.2.1.4");
    }

    var sulph = nonNeg(inp.sulphiteMgKg);
    if (sulph !== null && sulph >= cfg.SULPHITE_DECLARE_MG_KG) {
      rep.add("AL-SULPHITE", "AL", has.sulphite ? "pass" : "must-fix",
        "Sulphite content is " + round(sulph, 2) + " mg/kg, at or above the " +
        cfg.SULPHITE_DECLARE_MG_KG + " mg/kg declaration threshold" +
        (has.sulphite ? " and is declared." : " — it must be declared."), auth, cite);
    } else if (sulph !== null) {
      rep.add("AL-SULPHITE", "AL", "pass", "Sulphite content " + round(sulph, 2) +
        " mg/kg is below the " + cfg.SULPHITE_DECLARE_MG_KG + " mg/kg declaration threshold.", auth, cite);
    }
  }

  function checkNetQuantity(inp, rep, cfg) {
    var auth = inp.market === "IN" ? "LMPC" : "PHFDA";
    var cite = inp.market === "IN" ? "r. 6(1)(c), r. 8" : "Sec. 5";
    if (inp.netValue === null || inp.netValue === 0) {
      rep.add("NQ-VALUE", "NQ", "must-fix", "Net quantity is not declared.", auth, cite);
      return;
    }
    var u = UNITS[inp.netUnit];
    var base = baseQty(inp.netValue, inp.netUnit);
    rep.add("NQ-VALUE", "NQ", "pass", "Net quantity declared as " +
      formatNetQuantity(inp.netValue, inp.netUnit).replace(/^Net quantity: /, "") + ".", auth, cite);

    if (inp.market === "IN") {
      var want = preferredUnitOrBoth(base, u.kind, cfg);
      if (want === "both") {
        rep.add("NQ-UNIT", "NQ", "pass", "At exactly " + round(base, 0) + " " +
          (u.kind === "mass" ? "g" : "ml") + " the packer may declare either unit, so " +
          u.symbol + " is correct.", "LMPC", "r. 13(3) proviso");
      } else if (want !== inp.netUnit) {
        var conv = want === "kg" || want === "l" ? base / 1000 : base;
        rep.add("NQ-UNIT", "NQ", "must-fix", "Declare this quantity in " + UNITS[want].symbol +
          ", not " + u.symbol + ": " + round(conv, 3) + " " + UNITS[want].symbol + ".", "LMPC",
          u.kind === "mass" ? "r. 13(2)(a), 13(3)(a)" : "r. 13(2)(f), 13(3)(e)");
      } else {
        rep.add("NQ-UNIT", "NQ", "pass", "Unit of declaration (" + u.symbol +
          ") is the right one for this quantity.", "LMPC", "r. 13");
      }

      /* r. 7(5): this table binds the net quantity even though FSSAI also governs the pack. */
      var minMm = lmLetterMm(inp.pdpAreaCm2, cfg, inp.blownOrMoulded);
      var basis = "a " + (inp.pdpAreaCm2 ? round(inp.pdpAreaCm2, 1) + " cm2" : "an unstated") +
        " display panel" + (inp.blownOrMoulded ? ", blown or moulded on the container" : "");
      if (inp.qtyNumeralMm === null) {
        rep.add("NQ-HEIGHT", "NQ", "advisory", "Enter the printed height of the net-quantity, price and date text. For " +
          basis + " the minimum is " + minMm + " mm.", "LMPC", "r. 7(2) Table I");
      } else if (inp.qtyNumeralMm + 1e-9 < minMm) {
        rep.add("NQ-HEIGHT", "NQ", "must-fix", "Net quantity, price, date and consumer-care text is " +
          round(inp.qtyNumeralMm, 2) + " mm; on " + basis + " the minimum is " + minMm +
          " mm, and this table binds those fields even on a food label.", "LMPC", "r. 7(2) Table I, r. 7(5)");
      } else {
        rep.add("NQ-HEIGHT", "NQ", "pass", "Net quantity, price, date and consumer-care text at " +
          round(inp.qtyNumeralMm, 2) + " mm meets the " + minMm + " mm minimum for " + basis + ".",
          "LMPC", "r. 7(2) Table I");
      }

      if (base <= cfg.LM_SMALL_PACK_EXEMPT_G) {
        rep.add("NQ-SMALL", "NQ", "advisory", "At " + round(base, 2) + " " +
          (u.kind === "mass" ? "g" : "ml") + " this pack is at or under " + cfg.LM_SMALL_PACK_EXEMPT_G +
          " g / ml, which puts it outside the Legal Metrology packaged-commodity rules altogether (tobacco and pan masala apart). The food-safety rules still apply in full.",
          "LMPC", "r. 26(a)");
      }
    } else {
      rep.add("NQ-UNIT", "NQ", "pass", "Net content declared in metric (SI) units (" + u.symbol +
        "), as the rule requires; non-metric units are not permitted for food.", "PHFDA", "VI.A.4.a");

      var need = phNetContentMinMm(inp.packHeightMm, inp.packForm === "bottle", inp.pdpAreaCm2, cfg);
      if (need.mm === null) {
        rep.add("NQ-HEIGHT", "NQ", "advisory", "Enter the pack height to check the net-contents type size. No numeric minimum applies to the other declarations.", "PHFDA_88B", "3.3.4");
      } else if (inp.qtyNumeralMm === null) {
        rep.add("NQ-HEIGHT", "NQ", "advisory", "Net contents should be set at " + need.mm +
          " mm or more (" + need.basis + ")" + (need.gap ? ", taking the 60-80 mm band the order leaves undefined at the higher figure" : "") +
          ", in bold face and in distinct contrast.", "PHFDA_88B", "3.3.3-3.3.5");
      } else if (inp.qtyNumeralMm + 1e-9 < need.mm) {
        rep.add("NQ-HEIGHT", "NQ", "advisory", "Net contents are set at " + round(inp.qtyNumeralMm, 2) +
          " mm against " + need.mm + " mm for this pack (" + need.basis +
          "). This figure comes from the 1984 order, which the 2014 order neither restates nor repeals — treat it as the safe floor.", "PHFDA_88B", "3.3.4");
      } else {
        rep.add("NQ-HEIGHT", "NQ", "pass", "Net contents at " + round(inp.qtyNumeralMm, 2) +
          " mm meet the " + need.mm + " mm figure for this pack (" + need.basis + ").", "PHFDA_88B", "3.3.4");
      }

      if (inp.pdpAreaCm2 !== null && inp.pdpAreaCm2 > 0 && inp.pdpAreaCm2 < cfg.PH_LABEL_SPACE_EXEMPT_CM2) {
        rep.add("NQ-SMALL", "NQ", "advisory", "Label space is under " + cfg.PH_LABEL_SPACE_EXEMPT_CM2 +
          " cm2. Lot code and nutrition relief may apply if the secondary pack carries the full information and no claim is made.", "PHFDA", "VI.A.6, VI.A.11.h.7, VIII.C");
      }
    }

    if (inp.drainedValue !== null && base !== null) {
      var dbase = inp.drainedValue;
      if (dbase > base) {
        rep.add("NQ-DRAINED", "NQ", "must-fix", "Drained weight (" + round(dbase, 2) +
          ") cannot exceed the net quantity (" + round(base, 2) + ").", auth, cite);
      } else {
        rep.add("NQ-DRAINED", "NQ", "pass", "Drained weight is declared and is within the net quantity.", auth, cite);
      }
    }
  }

  function checkPrice(inp, rep, cfg) {
    if (inp.market !== "IN") return;   // the Philippines has no printed-MRP regime
    if (inp.mrp === null || inp.mrp === 0) {
      rep.add("PR-MRP", "PR", "must-fix", "Retail sale price is not declared.", "LMPC", "r. 6(1)(e)");
      return;
    }
    /* No form has been prescribed since October 2022: the price must simply show that
       it is the maximum retail price, inclusive of all taxes, in Indian currency. */
    rep.add("PR-MRP", "PR", "pass", "Retail sale price declared as \"" + cfg.LM_MRP_WORDING + " Rs " +
      formatMoney(inp.mrp) + " " + cfg.LM_MRP_SUFFIX + "\". No wording is prescribed any more — it only has to show that this is the maximum retail price, inclusive of all taxes, in Indian currency.",
      "LMPC", "r. 6(1)(e)");

    var base = baseQty(inp.netValue, inp.netUnit);
    var up = unitSalePrice(inp.mrp, base, inp.netUnit, cfg);
    if (up === null) {
      rep.add("PR-UNIT", "PR", "advisory", "Enter the net quantity to work out the unit sale price.", "LMPC", "r. 6(11)");
    } else if (up.sameAsRetail) {
      rep.add("PR-UNIT", "PR", "pass", "Unit sale price equals the retail sale price at this pack size, so no separate declaration is required.", "LMPC", "r. 6(11) second proviso");
    } else {
      rep.add("PR-UNIT", "PR", "pass", "Unit sale price is Rs " + formatMoney(up.value, cfg.LM_UNIT_PRICE_DP) +
        " " + up.per + ", and it has been a mandatory declaration on every pre-packaged commodity since 1 January 2024.",
        "LMPC", "r. 6(11)");
    }
  }

  /* r. 6(11): per gram below a kilogram, per kilogram above; per millilitre below a
     litre, per litre above; to two decimal places. Not required where it equals the
     retail sale price, which is what happens at exactly 1 kg or 1 l. */
  function unitSalePrice(mrp, base, netUnit, cfg) {
    var u = UNITS[lower(netUnit)];
    if (!u || base === null || base <= 0 || mrp === null) return null;
    var isMass = u.kind === "mass";
    var at = isMass ? cfg.LM_G_TO_KG_AT : cfg.LM_ML_TO_L_AT;
    if (base === at) return { sameAsRetail: true, value: mrp, per: isMass ? "per kg" : "per l" };
    if (base < at) return { sameAsRetail: false, value: mrp / base, per: isMass ? "per g" : "per ml" };
    return { sameAsRetail: false, value: (mrp / base) * at, per: isMass ? "per kg" : "per l" };
  }

  function checkDates(inp, rep, cfg) {
    var auth = inp.market === "IN" ? "FSSAI" : "PHFDA";
    var cite = inp.market === "IN" ? "Reg. 5(1), Reg. 8" : "Sec. 5";
    var packed = parseDate(inp.packedOn);
    if (!packed.ok) {
      /* A date of manufacture is mandatory in India; in the Philippines only the expiry
         date is, so an empty box there is a note, while a wrong date is still a blocker. */
      var packedSeverity = inp.market === "PH" && packed.reason === "empty" ? "advisory" : "must-fix";
      var why = {
        empty: inp.market === "PH"
          ? "No date of manufacture. It is not itself mandatory here, but without it this tool cannot compute the expiry date."
          : "Date of manufacture / packing is not declared.",
        format: "Date of manufacture is not in DD/MM/YYYY form: \"" + inp.packedOn + "\".",
        "two-digit-year": "Write the year in full (DD/MM/YYYY), not two digits: \"" + inp.packedOn + "\".",
        year: "Year in the date of manufacture is out of range: \"" + inp.packedOn + "\".",
        month: "Month in the date of manufacture is not 1-12: \"" + inp.packedOn + "\".",
        day: "That day does not exist in that month: \"" + inp.packedOn + "\"."
      }[packed.reason] || "Date of manufacture is unusable.";
      rep.add("DT-PACKED", "DT", packedSeverity, why, auth, cite);
    } else {
      rep.add("DT-PACKED", "DT", "pass", "Date of manufacture / packing reads " +
        fmtDate(packed, inp.market === "PH" ? "words" : "dmy") + ".", auth, cite);
      if (packed.iso) {
        rep.add("DT-FORMAT", "DT", "advisory", "Entered as YYYY-MM-DD; the label will print DD/MM/YYYY.", "TOOL", "");
      }
    }

    if (inp.shelfLifeMonths === null || inp.shelfLifeMonths === 0) {
      rep.add("DT-SHELF", "DT", "must-fix", "Shelf life is not set, so no " +
        (inp.dateMode === "use-by" ? "use-by" : "best-before") + " declaration can be printed.", auth, cite);
    } else {
      var bb = packed.ok ? addMonths(packed, inp.shelfLifeMonths) : null;
      rep.add("DT-SHELF", "DT", "pass", "Shelf life " + round(inp.shelfLifeMonths, 1) + " months" +
        (bb ? ", so " + (inp.dateMode === "use-by" ? "use by " : "best before ") + fmtDate(bb, inp.market === "PH" ? "words" : "dmy") : "") + ".", auth, cite);
      if (inp.market === "IN" && inp.shelfLifeMonths > cfg.SHELF_LIFE_LONG_MONTHS) {
        rep.add("DT-LONG", "DT", "advisory", "Shelf life is over " + cfg.SHELF_LIFE_LONG_MONTHS +
          " months. Some jurisdictions relieve such foods of a durability date; this rule set still expects one.", "CODEX", "4.7.1");
      }
    }

    if (inp.market === "PH") {
      /* "Best before" is not a Philippine term, and only alcoholic beverages are exempt. */
      if (inp.dateMode === "best-before") {
        rep.add("DT-TERM", "DT", "must-fix", "\"Best before\" is not a Philippine date term. Print an expiry / expiration date, a use-by date or a consume-before date, as day in numerals, month in words and year in numerals.", "PHFDA", "VI.A.8");
      } else {
        rep.add("DT-TERM", "DT", "pass", "Expiry-style declaration, printed with the month in words.", "PHFDA", "VI.A.8");
      }
      return;
    }

    /* Reg. 5(10)(a): the date of manufacture AND an expiry / use-by date are both
       mandatory. "Best before" is permitted only as optional, additional information. */
    if (inp.dateMode === "best-before") {
      rep.add("DT-TERM", "DT", "must-fix", "A \"Best before\" date on its own is not enough. The label must carry both the date of manufacture or packaging and an \"Expiry\" or \"Use by\" date; \"Best before\" may be added to those, not substituted for them.", "FSSAI", "Reg. 5(10)(a)");
    } else {
      rep.add("DT-TERM", "DT", "pass", "Date of manufacture and a use-by / expiry date, grouped together at one place as the rule requires.", "FSSAI", "Reg. 5(10)(a), 5(10)(e)");
    }

    /* Reg. 5(10)(b)(i): which printed form the shelf life calls for. */
    var style = inDateStyle(inp.shelfLifeMonths, cfg);
    rep.add("DT-FORM", "DT", "pass", style === "short"
      ? "Shelf life of " + cfg.IN_SHORT_SHELF_MONTHS + " months or less, so the label prints the day, month and year (DD/MM/YY)."
      : "Shelf life above " + cfg.IN_SHORT_SHELF_MONTHS + " months, so the month and year are enough; the month is printed in capital letters, never as a bare number.",
      "FSSAI", "Reg. 5(10)(b)(i)");

    /* Reg. 8: relief that depends on the surface area of the package, not the panel. */
    if (inp.surfaceAreaCm2 !== null && inp.surfaceAreaCm2 > 0 &&
      inp.surfaceAreaCm2 < cfg.IN_NO_DATE_SURFACE_CM2) {
      rep.add("DT-SMALL", "DT", "advisory", "Surface area is under " + cfg.IN_NO_DATE_SURFACE_CM2 +
        " cm2, so the date of manufacture and the use-by date need not appear on this pack — but they must appear on the multi-unit pack.", "FSSAI", "Reg. 8(1A)");
    }
    if (inp.shelfLifeMonths !== null && inp.shelfLifeMonths > 0 && inp.shelfLifeMonths * 30 <= 7) {
      rep.add("DT-SHORT", "DT", "advisory", "Shelf life of a week or less: the date of manufacture is optional, the expiry or use-by date is not.", "FSSAI", "Reg. 8(3)");
    }
  }

  function checkLicence(inp, rep, cfg) {
    if (inp.market === "IN") {
      var raw = inp.fssaiNumber.replace(/[\s-]/g, "");
      if (!raw) {
        rep.add("LC-FSSAI", "LC", "must-fix", "FSSAI licence / registration number is not declared.", "FSSAI", "Reg. 5(1); r. 2.1.9");
      } else if (!/^\d+$/.test(raw)) {
        rep.add("LC-FSSAI", "LC", "must-fix", "FSSAI number must be digits only: \"" + inp.fssaiNumber + "\".", "FSSAI", "Reg. 5(7)");
      } else if (raw.length !== cfg.FSSAI_DIGITS) {
        rep.add("LC-FSSAI", "LC", "must-fix", "FSSAI number has " + raw.length + " digits; it must have exactly " +
          cfg.FSSAI_DIGITS + ".", "FSSAI", "Reg. 5(7)");
      } else if (raw.charAt(0) !== cfg.FSSAI_FIRST_DIGIT_LICENCE && raw.charAt(0) !== cfg.FSSAI_FIRST_DIGIT_REGISTRATION) {
        rep.add("LC-FSSAI", "LC", "must-fix", "A 14-digit FSSAI number starts with " +
          cfg.FSSAI_FIRST_DIGIT_LICENCE + " (licence) or " + cfg.FSSAI_FIRST_DIGIT_REGISTRATION +
          " (registration); this one starts with " + raw.charAt(0) + ".", "FSSAI", "Reg. 5(7)");
      } else {
        rep.add("LC-FSSAI", "LC", "pass", "FSSAI " +
          (raw.charAt(0) === cfg.FSSAI_FIRST_DIGIT_LICENCE ? "licence" : "registration") +
          " number is 14 digits and well formed.", "FSSAI", "Reg. 5(7)");
      }
      if (inp.logoPrinted) {
        rep.add("LC-LOGO", "LC", "pass", "FSSAI logo is on the artwork next to the licence number.", "FSSAI", "Reg. 5(7)");
      } else {
        rep.add("LC-LOGO", "LC", "must-fix", "The FSSAI logo must appear with the licence number.", "FSSAI", "Reg. 5(7)");
      }
    } else {
      /* VI.B.4 says the food authorization number "may" be printed: not mandatory. */
      if (!inp.fdaNumber) {
        rep.add("LC-FDA", "LC", "advisory", "No FDA food authorization number on the label. Printing it is optional, not mandatory — the rule says it \"may\" be printed.", "PHFDA", "VI.B.4");
      } else {
        rep.add("LC-FDA", "LC", "pass", "FDA food authorization number declared: " + inp.fdaNumber + ".", "PHFDA", "VI.B.4");
      }
    }
    if (inp.lotCode && inp.lotCode.length > 20) {
      rep.add("LC-LOT", "LC", "advisory", "Lot code is long (" + inp.lotCode.length +
        " characters); keep it short enough to print legibly.", "TOOL", "");
    }
  }

  function checkNutrition(inp, rep, cfg, detected) {
    var n = inp.nutrition;
    var defs = requiredNutrients(inp, cfg, detected);
    var auth = inp.market === "IN" ? "FSSAI" : "PHFDA_NUT";
    var cite = inp.market === "IN" ? "Reg. 5(3)" : "nutrition labelling issuance";
    var missing = [], i;
    for (i = 0; i < defs.length; i++) {
      if (n[defs[i].key] === null) { missing.push(defs[i].label); }
    }
    if (missing.length) {
      rep.add("NU-MISSING", "NU", "must-fix", "Nutrition panel is missing: " + missing.join(", ") + ".", auth, cite);
    } else {
      rep.add("NU-MISSING", "NU", "pass", "All " + defs.length + " mandatory nutrients are declared.", auth, cite);
    }

    if (n.satFatG !== null && n.transFatG !== null && n.totalFatG !== null &&
      n.satFatG + n.transFatG > n.totalFatG + 1e-9) {
      rep.add("NU-FAT", "NU", "must-fix", "Saturated fat + trans fat (" +
        round(n.satFatG + n.transFatG, 2) + " g) exceeds total fat (" + round(n.totalFatG, 2) + " g).", "TOOL", "");
    } else if (n.totalFatG !== null) {
      rep.add("NU-FAT", "NU", "pass", "Fat split is internally consistent.", "TOOL", "");
    }

    if (n.addedSugarG !== null && n.totalSugarG !== null && n.addedSugarG > n.totalSugarG + 1e-9) {
      rep.add("NU-SUGAR", "NU", "must-fix", "Added sugars (" + round(n.addedSugarG, 2) +
        " g) exceed total sugars (" + round(n.totalSugarG, 2) + " g).", "TOOL", "");
    } else if (n.totalSugarG !== null) {
      rep.add("NU-SUGAR", "NU", "pass", "Sugar split is internally consistent.", "TOOL", "");
    }

    if (n.totalSugarG !== null && n.carbG !== null && n.totalSugarG > n.carbG + 1e-9) {
      rep.add("NU-CARB", "NU", "must-fix", "Total sugars (" + round(n.totalSugarG, 2) +
        " g) exceed total carbohydrate (" + round(n.carbG, 2) + " g).", "TOOL", "");
    } else if (n.carbG !== null) {
      rep.add("NU-CARB", "NU", "pass", "Sugars sit within the declared carbohydrate.", "TOOL", "");
    }

    var macroSum = num0(n.proteinG) + num0(n.carbG) + num0(n.totalFatG);
    if (macroSum > 100 + 1e-9) {
      rep.add("NU-MACRO", "NU", "must-fix", "Protein + carbohydrate + fat is " + round(macroSum, 2) +
        " g per 100 g — more than the food itself.", "TOOL", "");
    } else {
      rep.add("NU-MACRO", "NU", "pass", "Macronutrients total " + round(macroSum, 2) + " g per 100 g.", "TOOL", "");
    }

    var calc = computedEnergy(n, cfg);
    if (calc !== null && n.energyKcal !== null) {
      var delta = calc === 0 && n.energyKcal === 0 ? 0 : Math.abs(n.energyKcal - calc);
      var relative = calc > 0 ? (delta / calc) * 100 : (n.energyKcal > 0 ? 100 : 0);
      var factors = cfg.KCAL_PER_G_PROTEIN + "/" + cfg.KCAL_PER_G_CARB + "/" + cfg.KCAL_PER_G_FAT +
        " kcal per g for protein, carbohydrate and fat";
      if (relative > cfg.ENERGY_TOLERANCE_PCT) {
        rep.add("NU-ENERGY", "NU", "must-fix", "Declared energy " + round(n.energyKcal, 1) +
          " kcal is " + round(relative, 1) + "% away from the " + round(calc, 1) +
          " kcal the macronutrients give at " + factors + ". Fibre, polyols, organic acids and alcohol carry their own factors and are not modelled here.",
          inp.market === "IN" ? "FSSAI" : "TOOL", inp.market === "IN" ? "Reg. 5(3)(e)" : "");
      } else {
        rep.add("NU-ENERGY", "NU", "pass", "Declared energy is within " + cfg.ENERGY_TOLERANCE_PCT +
          "% of the " + round(calc, 1) + " kcal computed at " + factors + ".",
          inp.market === "IN" ? "FSSAI" : "TOOL", inp.market === "IN" ? "Reg. 5(3)(e)" : "");
      }
    } else {
      rep.add("NU-ENERGY", "NU", "advisory", "Energy cross-check needs energy, protein, carbohydrate and fat.", "TOOL", "");
    }

    var base = baseQty(inp.netValue, inp.netUnit);
    if (n.servingSizeG === null || n.servingSizeG === 0) {
      rep.add("NU-SERVING", "NU", "must-fix", "Serving size is not declared, so the per-serve column cannot be printed.", auth, cite);
    } else if (base !== null && n.servingsPerPack !== null && n.servingsPerPack > 0) {
      var implied = n.servingSizeG * n.servingsPerPack;
      var off = pct(Math.abs(implied - base), base);
      if (off !== null && off > cfg.SERVING_MATCH_TOLERANCE_PCT) {
        rep.add("NU-SERVING", "NU", "advisory", "Serving size x servings per pack is " + round(implied, 1) +
          " against a net quantity of " + round(base, 1) + " — " + round(off, 1) + "% apart.", "TOOL", "");
      } else {
        rep.add("NU-SERVING", "NU", "pass", "Serving size x servings per pack matches the net quantity.", "TOOL", "");
      }
    } else {
      rep.add("NU-SERVING", "NU", "pass", "Serving size declared as " + round(n.servingSizeG, 1) + ".", auth, cite);
    }

    if (inp.market === "PH") {
      if (n.transFatG !== null && n.transFatG > cfg.PH_TFA_LIMIT_G_PER_100G + 1e-9) {
        rep.add("NU-TFA", "NU", "advisory", "Trans fat is " + round(n.transFatG, 2) +
          " g per 100 g. Oils and fats above " + cfg.PH_TFA_LIMIT_G_PER_100G +
          " g per 100 g may not be manufactured, imported or sold; check whether your product falls inside that policy.", "PHFDA_TFA", "AO 2021-0039");
      } else if (n.transFatG !== null) {
        rep.add("NU-TFA", "NU", "pass", "Trans fat " + round(n.transFatG, 2) + " g per 100 g is within the " +
          cfg.PH_TFA_LIMIT_G_PER_100G + " g per 100 g policy limit. Declare it even in trace amounts, and do not claim \"trans fat free\".", "PHFDA_TFA", "AO 2021-0039");
      }
      rep.add("NU-PDRI", "NU", "pass", "The panel prints \"" + cfg.PH_PDRI_NOTE + "\" and the reference age group, as the circular requires. Total fat, saturated fat, carbohydrate and sugars carry no percentage because no Philippine reference value exists for them.", "PHFDA_NUT", "III, VI.B, VI.C");
    }

    if (inp.market === "IN" && n.sodiumMg !== null) {
      var salt = saltEquivalentG(n.sodiumMg, cfg);
      rep.add("NU-SALT", "NU", "advisory", "Sodium " + round(n.sodiumMg, 1) + " mg per 100 g is about " +
        round(salt, 2) + " g of salt (x" + cfg.SODIUM_TO_SALT_FACTOR + "), i.e. " +
        round(pct(salt, cfg.IN_RDA_SALT_G) || 0, 1) + "% of the " + cfg.IN_RDA_SALT_G +
        " g daily salt reference.", "FSSAI", "Reg. 5(3)");
    }
  }

  function checkArtwork(inp, rep, cfg) {
    var minMm = minLetterMm(inp.pdpAreaCm2, inp.market, cfg, inp.blownOrMoulded);
    var auth = inp.market === "IN" ? "FSSAI" : "PHFDA";
    var cite = inp.market === "IN" ? "Reg. 6(3) Table I" : "V.D";

    if (inp.pdpAreaCm2 === null || inp.pdpAreaCm2 === 0) {
      rep.add("AR-PDP", "AR", "advisory", "Enter the area of the principal display panel; the minimum type and symbol sizes both depend on it. On a rectangular pack it is the height times the width of the face you print on.", "LMPC", "r. 7(4)");
    } else {
      rep.add("AR-PDP", "AR", "pass", "Principal display panel " + round(inp.pdpAreaCm2, 1) +
        " cm2" + (inp.blownOrMoulded ? ", blown or moulded on the container." : "."), "LMPC", "r. 7(4)");
    }

    if (minMm === null) {
      /* The Philippine order sets a legibility standard, not a millimetre figure. */
      rep.add("AR-TYPE", "AR", "advisory", "No numeric minimum type size is prescribed. Every word must be printed legibly and conspicuously enough to be understood in normal use, and the name of the food must be prominent and sized in relation to the biggest printed matter on the panel.", "PHFDA", "V.D, VI.A.1.e");
    } else if (inp.typeSizeMm === null) {
      rep.add("AR-TYPE", "AR", "advisory", "Enter the printed type size of the mandatory information; the minimum here is " +
        minMm + " mm.", auth, cite);
    } else if (inp.typeSizeMm + 1e-9 < minMm) {
      rep.add("AR-TYPE", "AR", "must-fix", "Mandatory information is set at " + round(inp.typeSizeMm, 2) +
        " mm; on this panel the minimum letter height is " + minMm + " mm" +
        (inp.blownOrMoulded ? " for lettering blown or moulded on the container" : "") +
        ". Net quantity, price, dates and consumer care follow the stricter Legal Metrology table and are checked separately.", auth, cite);
    } else {
      rep.add("AR-TYPE", "AR", "pass", "Type size " + round(inp.typeSizeMm, 2) +
        " mm meets the " + minMm + " mm minimum letter height for this panel.", auth, cite);
    }

    if (inp.market !== "IN") return;

    var row = symbolSizes(inp.pdpAreaCm2, cfg);
    var sym = minSymbolMm(inp.pdpAreaCm2, cfg, inp.veg);
    var shape = inp.veg === "nonveg" ? "triangle side" : "circle diameter";
    var want = inp.veg === "nonveg" ? cfg.IN_NONVEG_COLOUR : cfg.IN_VEG_COLOUR;
    if (!inp.symbolPrinted) {
      rep.add("AR-SYMBOL", "AR", "must-fix", "The " + (inp.veg === "nonveg" ? "non-vegetarian" : "vegetarian") +
        " symbol is missing: a " + want + ", on the principal display panel in a contrasting background close to the name or brand name.", "FSSAI", "Reg. 5(4)(a)-(d)");
    } else if (inp.symbolSizeMm === null) {
      rep.add("AR-SYMBOL", "AR", "advisory", "Enter the symbol size. On this panel the " + shape +
        " must be at least " + sym + " mm, inside a square of " + row.squareMm + " mm.", "FSSAI", "Reg. 5(4)(c)");
    } else if (inp.symbolSizeMm + 1e-9 < sym) {
      rep.add("AR-SYMBOL", "AR", "must-fix", "Symbol is " + round(inp.symbolSizeMm, 2) +
        " mm; on this panel the " + shape + " must be at least " + sym + " mm, inside a square of " +
        row.squareMm + " mm.", "FSSAI", "Reg. 5(4)(c)");
    } else {
      rep.add("AR-SYMBOL", "AR", "pass", "Symbol at " + round(inp.symbolSizeMm, 2) + " mm meets the " +
        sym + " mm " + shape + " for this panel (square " + row.squareMm + " mm): a " + want + ".", "FSSAI", "Reg. 5(4)(c)");
    }

    /* Reg. 8(1): relief keyed to the surface area of the PACKAGE, not the panel. */
    if (inp.surfaceAreaCm2 !== null && inp.surfaceAreaCm2 > 0 &&
      inp.surfaceAreaCm2 <= cfg.IN_EXEMPT_SURFACE_CM2) {
      rep.add("AR-SMALL", "AR", "advisory", "Surface area is " + round(inp.surfaceAreaCm2, 1) +
        " cm2, at or under " + cfg.IN_EXEMPT_SURFACE_CM2 +
        " cm2. Such a pack need not carry the ingredient list, lot or batch number, nutrition information, additive declaration, licence number and logo, importer details or instructions for use — but all of it must appear on the multi-unit pack.", "FSSAI", "Reg. 8(1)");
    }
  }

  /* =====================================================================
     10. LABEL BUILDER — the print-ready block, as segments so the page
         can bold the allergen words without any inline styling.
     ===================================================================== */

  function formatMoney(v, dp) {
    var x = numOrNull(v);
    if (x === null) return "0.00";
    var d = dp === undefined ? 2 : dp;
    return x.toFixed(d);
  }

  function padRight(s, w) {
    var t = str(s);
    while (t.length < w) { t += " "; }
    return t;
  }
  function padLeft(s, w) {
    var t = str(s);
    while (t.length < w) { t = " " + t; }
    return t;
  }

  /* The statutory warnings that ride along with particular ingredients. */
  function scheduleWarnings(inp, cfg) {
    var out = [], i, n, pct;
    var msg = false, polyol = null;
    for (i = 0; i < inp.ingredients.length; i++) {
      n = normalise(inp.ingredients[i].name);
      pct = inp.ingredients[i].pct;
      if (wordish(n, "monosodium glutamate") || wordish(n, "msg") || wordish(n, "ins 621") ||
        wordish(n, "ajinomoto") || wordish(n, "flavour enhancer 621")) { msg = true; }
      if ((wordish(n, "sorbitol") || wordish(n, "maltitol") || wordish(n, "xylitol") ||
        wordish(n, "isomalt") || wordish(n, "lactitol") || wordish(n, "polydextrose")) &&
        pct !== null && pct >= cfg.IN_POLYOL_WARNING_PCT) { polyol = inp.ingredients[i].name; }
    }
    if (inp.market === "IN" && msg) {
      out.push({
        id: "msg",
        lines: ["This package of " + (inp.foodName || "[name of the food]") + " contains added MONOSODIUM GLUTAMATE",
          "NOT RECOMMENDED FOR INFANTS BELOW 12 MONTHS AND PREGNANT OR LACTATING WOMEN"],
        why: "Added monosodium glutamate"
      });
    }
    if (inp.market === "IN" && polyol) {
      out.push({
        id: "polyol",
        lines: ["EXCESS CONSUMPTION MAY HAVE LAXATIVE EFFECT"],
        why: polyol + " at or above " + cfg.IN_POLYOL_WARNING_PCT + "%"
      });
    }
    return out;
  }

  /* The allergen statement, in the form each regulator uses. */
  function allergenStatement(inp, detected) {
    var words = [], i, h, w;
    for (i = 0; i < detected.length; i++) {
      h = detected[i];
      if (inp.market === "IN") {
        w = h.group === "gluten" ? cerealName(h.keyword) : (h.sayIn || h.say);
      } else {
        w = h.say;
      }
      if (words.indexOf(w) === -1) { words.push(w); }
    }
    if (!words.length) return null;
    return inp.market === "IN"
      ? { lead: "ALLERGEN INFORMATION: ", bold: "Contains " + words.join(", ") + "." }
      : { lead: "ALLERGEN INFORMATION: ", bold: "Contains food allergen: " + words.join(", ") + "." };
  }

  /* The cereal behind a gluten-bearing ingredient word. */
  function cerealName(keyword) {
    var g = allergenLabel("gluten"), k = lower(keyword);
    if (g && g.cereal && Object.prototype.hasOwnProperty.call(g.cereal, k)) { return g.cereal[k]; }
    return k ? capitalise(k.split(" ")[0]) : "the cereal";
  }

  function capitalise(s) {
    var t = str(s);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  function buildLabel(inp, cfg, detected) {
    var lines = [];
    function line(segs) { lines.push({ segs: segs }); }
    function plain(t) { line([{ t: str(t) }]); }
    function blank() { lines.push({ segs: [] }); }

    var isIN = inp.market === "IN";
    var packed = parseDate(inp.packedOn);
    var style = isIN ? inDateStyle(inp.shelfLifeMonths, cfg) : "words";

    var title = inp.brandName ? inp.brandName.toUpperCase() + " " + inp.foodName.toUpperCase() : inp.foodName.toUpperCase();
    plain(title || "[NAME OF THE FOOD]");
    if (inp.descriptor) { plain(inp.descriptor); }
    if (isIN) {
      plain((inp.veg === "nonveg" ? "[NON-VEGETARIAN SYMBOL] " : "[VEGETARIAN SYMBOL] ") +
        (inp.veg === "nonveg" ? cfg.IN_NONVEG_COLOUR : cfg.IN_VEG_COLOUR));
    }
    blank();

    /* Ingredients, with the allergen-bearing ones marked for emphasis. */
    var i, parts = [];
    for (i = 0; i < inp.ingredients.length; i++) {
      var ing = inp.ingredients[i];
      var isAllergen = false, j;
      for (j = 0; j < detected.length; j++) {
        if (normalise(detected[j].ingredient) === normalise(ing.name)) { isAllergen = true; }
      }
      parts.push({
        t: ing.name + (ing.pct !== null ? " (" + round(ing.pct, 2) + "%)" : ""),
        b: isAllergen
      });
    }
    if (parts.length) {
      var segs = [{ t: "INGREDIENTS: " }];
      for (i = 0; i < parts.length; i++) {
        segs.push({ t: parts[i].t, b: parts[i].b });
        if (i < parts.length - 1) { segs.push({ t: ", " }); }
      }
      segs.push({ t: "." });
      line(segs);
    } else {
      plain("INGREDIENTS: [not entered]");
    }

    /* Directly below the ingredient list, which is where both regulators want it. */
    var statement = allergenStatement(inp, detected);
    if (statement) { line([{ t: statement.lead }, { t: statement.bold, b: true }]); }

    var warnings = scheduleWarnings(inp, cfg), w;
    if (warnings.length) {
      blank();
      for (i = 0; i < warnings.length; i++) {
        for (w = 0; w < warnings[i].lines.length; w++) {
          line([{ t: warnings[i].lines[w], b: true }]);
        }
      }
    }
    blank();

    /* Nutrition panel. */
    var rows = nutritionRows(inp.nutrition, inp.market, cfg, requiredNutrients(inp, cfg, detected));
    var serving = inp.nutrition.servingSizeG;
    var unitWord = UNITS[inp.netUnit] && UNITS[inp.netUnit].kind === "volume" ? "100 ml" : "100 g";
    plain(isIN ? "NUTRITIONAL INFORMATION" : "NUTRITION FACTS");
    if (!isIN && serving) {
      plain("Serving size: " + round(serving, 1) + " " + (unitWord === "100 ml" ? "ml" : "g") +
        (inp.nutrition.servingsPerPack ? "   Servings per pack: " + round(inp.nutrition.servingsPerPack, 1) : ""));
    }
    plain(padRight("", 24) + padLeft("Per " + unitWord, 12) +
      padLeft(serving ? "Per serve" : "", 12) + padLeft(serving ? (isIN ? "% RDA*" : "% REI/RNI*") : "", 11));
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      plain(padRight(r.label + " (" + r.unit + ")", 24) +
        padLeft(r.per100 === null ? "--" : String(round(r.per100, 2)), 12) +
        padLeft(r.perServe === null ? "" : String(round(r.perServe, 2)), 12) +
        padLeft(r.rdaPct === null ? "" : round(r.rdaPct, 1) + "%", 11));
      if (!isIN && r.key === "energyKcal" && inp.nutrition.totalFatG !== null) {
        plain(padRight("  Calories from fat (kcal)", 24) +
          padLeft(String(round(inp.nutrition.totalFatG * cfg.KCAL_PER_G_FAT, 1)), 12));
      }
    }
    if (isIN && serving) {
      plain("Serving size: " + round(serving, 1) + " " + (unitWord === "100 ml" ? "ml" : "g") +
        (inp.nutrition.servingsPerPack ? "   Servings per pack: " + round(inp.nutrition.servingsPerPack, 1) : ""));
    }
    if (isIN) {
      plain("* % contribution to the daily reference values set out in the assumptions.");
    } else {
      plain("* " + cfg.PH_PDRI_NOTE + ". " + cfg.PH_PDRI_BASIS + ".");
      plain("  Rows with no percentage have no Philippine reference value.");
    }
    blank();

    /* The statutory block. */
    if (inp.netValue !== null) {
      plain(formatNetQuantity(inp.netValue, inp.netUnit, isIN ? "Net quantity" : "Net content"));
    } else {
      plain((isIN ? "Net quantity" : "Net content") + ": [not entered]");
    }
    if (inp.drainedValue !== null) {
      plain("Drained weight: " + round(inp.drainedValue, 2) + " " +
        (UNITS[inp.netUnit].kind === "volume" ? "ml" : "g"));
    }
    if (isIN && inp.mrp !== null) {
      plain(cfg.LM_MRP_WORDING + ": Rs " + formatMoney(inp.mrp) + " " + cfg.LM_MRP_SUFFIX);
      var up = unitSalePrice(inp.mrp, baseQty(inp.netValue, inp.netUnit), inp.netUnit, cfg);
      if (up && !up.sameAsRetail) {
        plain("Unit sale price: Rs " + formatMoney(up.value, cfg.LM_UNIT_PRICE_DP) + " " + up.per);
      }
    }

    if (packed.ok) {
      plain((isIN ? "Date of manufacture / packing: " : "Date of manufacture: ") + fmtDate(packed, style));
      if (inp.shelfLifeMonths) {
        var bb = addMonths(packed, inp.shelfLifeMonths);
        var word = isIN
          ? (inp.dateMode === "best-before" ? "Best before: " : "Use by / Expiry: ")
          : (inp.dateMode === "use-by" ? "Use-by date: " : "Expiry date: ");
        plain(word + fmtDate(bb, style));
      }
    } else {
      plain("Date of manufacture / packing: [not entered]");
    }
    if (inp.lotCode) { plain("Lot / Batch No.: " + inp.lotCode); }
    if (inp.storage) { plain("Storage: " + inp.storage); }
    if (inp.usage) { plain("Directions for use: " + inp.usage); }
    blank();

    if (isIN) {
      plain((inp.logoPrinted ? "[FSSAI logo]  " : "[FSSAI logo missing]  ") +
        "Lic. No. " + (inp.fssaiNumber || "[not entered]"));
    } else if (inp.fdaNumber) {
      plain("FDA Reg. No. " + inp.fdaNumber);
    }
    if (inp.maker) { plain((isIN ? "Manufactured & packed by: " : "Manufactured / distributed by: ") + inp.maker); }
    if (inp.makerAddress) { plain(inp.makerAddress); }
    if (inp.consumerCare) { plain("Consumer care: " + inp.consumerCare); }
    if (inp.imported && inp.origin) { plain("Country of origin: " + inp.origin); }

    return { lines: lines };
  }

  function labelToText(label) {
    var out = [], i, j, line, s;
    for (i = 0; i < label.lines.length; i++) {
      line = label.lines[i]; s = "";
      for (j = 0; j < line.segs.length; j++) { s += line.segs[j].t; }
      out.push(s);
    }
    return out.join("\n");
  }

  /* =====================================================================
     11. ENTRY POINT
     ===================================================================== */

  function lint(raw, overrides) {
    var cfg = makeConfig(overrides);
    var inp = readInput(raw);
    var rep = new Report();

    var detected = detectAllergens(inp.ingredients, inp.sulphiteMgKg, cfg);

    checkMandatory(inp, rep);
    checkIngredients(inp, rep);
    checkAllergens(inp, rep, cfg);
    checkNetQuantity(inp, rep, cfg);
    checkPrice(inp, rep, cfg);
    checkDates(inp, rep, cfg);
    checkLicence(inp, rep, cfg);
    checkNutrition(inp, rep, cfg, detected);
    checkArtwork(inp, rep, cfg);

    var label = buildLabel(inp, cfg, detected);

    var summary = { mustFix: 0, advisory: 0, pass: 0, checks: rep.findings.length };
    var byGroup = {}, i, f, g;
    for (i = 0; i < GROUPS.length; i++) {
      byGroup[GROUPS[i].id] = { id: GROUPS[i].id, label: GROUPS[i].label, mustFix: 0, advisory: 0, pass: 0, checks: 0 };
    }
    for (i = 0; i < rep.findings.length; i++) {
      f = rep.findings[i];
      g = byGroup[f.group] || byGroup.MD;
      g.checks++;
      if (f.severity === "must-fix") { g.mustFix++; summary.mustFix++; }
      else if (f.severity === "advisory") { g.advisory++; summary.advisory++; }
      else { g.pass++; summary.pass++; }
    }
    var groups = [];
    for (i = 0; i < GROUPS.length; i++) {
      if (byGroup[GROUPS[i].id].checks > 0) { groups.push(byGroup[GROUPS[i].id]); }
    }

    return {
      market: inp.market,
      input: inp,
      config: cfg,
      findings: rep.findings,
      problems: rep.findings.filter(function (x) { return x.severity !== "pass"; }),
      groups: groups,
      summary: summary,
      verdict: summary.mustFix === 0
        ? (summary.advisory === 0 ? "Every check passes" : "No blocking issue; " + summary.advisory + " to review")
        : summary.mustFix + " blocking issue" + (summary.mustFix === 1 ? "" : "s"),
      detectedAllergens: detected,
      nutrition: nutritionRows(inp.nutrition, inp.market, cfg, requiredNutrients(inp, cfg, detected)),
      derived: {
        netQuantityBase: baseQty(inp.netValue, inp.netUnit),
        netQuantityText: formatNetQuantity(inp.netValue, inp.netUnit, inp.market === "PH" ? "Net content" : "Net quantity"),
        computedEnergyKcal: computedEnergy(inp.nutrition, cfg),
        saltEquivalentG: saltEquivalentG(inp.nutrition.sodiumMg, cfg),
        bestBefore: (function () {
          var p = parseDate(inp.packedOn);
          if (!p.ok || !inp.shelfLifeMonths) return "";
          return fmtDate(addMonths(p, inp.shelfLifeMonths), inp.market === "PH" ? "words" : "dmy");
        })(),
        minTypeMm: minLetterMm(inp.pdpAreaCm2, inp.market, cfg, inp.blownOrMoulded),
        minSymbolMm: inp.market === "IN" ? minSymbolMm(inp.pdpAreaCm2, cfg, inp.veg) : null,
        minSquareMm: inp.market === "IN" ? symbolSizes(inp.pdpAreaCm2, cfg).squareMm : null,
        minQtyNumeralMm: inp.market === "IN"
          ? lmLetterMm(inp.pdpAreaCm2, cfg, inp.blownOrMoulded)
          : phNetContentMinMm(inp.packHeightMm, inp.packForm === "bottle", inp.pdpAreaCm2, cfg).mm,
        unitSalePrice: inp.market === "IN"
          ? unitSalePrice(inp.mrp, baseQty(inp.netValue, inp.netUnit), inp.netUnit, cfg) : null
      },
      label: label,
      labelText: labelToText(label)
    };
  }

  return {
    CONSTANTS: C,
    AUTHORITY: AUTHORITY,
    ALLERGENS: ALLERGENS,
    ADDITIVE_CLASSES: ADDITIVE_CLASSES,
    MANDATORY: MANDATORY,
    NUTRIENTS: NUTRIENTS,
    GROUPS: GROUPS,
    OVERRIDABLE: OVERRIDABLE,
    UNITS: UNITS,
    lint: lint,
    makeConfig: makeConfig,
    parseDate: parseDate,
    addMonths: addMonths,
    fmtDate: fmtDate,
    daysInMonth: daysInMonth,
    formatNetQuantity: formatNetQuantity,
    preferredUnitOrBoth: preferredUnitOrBoth,
    unitSalePrice: unitSalePrice,
    lmLetterMm: lmLetterMm,
    symbolSizes: symbolSizes,
    phNetContentMinMm: phNetContentMinMm,
    inDateStyle: inDateStyle,
    baseQty: baseQty,
    minLetterMm: minLetterMm,
    minSymbolMm: minSymbolMm,
    detectAllergens: detectAllergens,
    computedEnergy: computedEnergy,
    saltEquivalentG: saltEquivalentG,
    nutritionRows: nutritionRows,
    requiredNutrients: requiredNutrients,
    hasAnimalFat: hasAnimalFat,
    scheduleWarnings: scheduleWarnings,
    allergenStatement: allergenStatement,
    buildLabel: buildLabel,
    labelToText: labelToText,
    normalise: normalise,
    wordish: wordish
  };
}));
