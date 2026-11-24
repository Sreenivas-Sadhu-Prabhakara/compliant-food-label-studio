/* Compliant food label studio — the page wiring. All rules live in rules.js.
   Plain browser JS, no dependencies, no network, no dynamic code. */
(function () {
  "use strict";

  var R = window.LabelRules;
  if (!R) { return; }
  var C = R.CONSTANTS;

  /* The example label the page opens with: a real-looking snack SKU. */
  var EXAMPLE = {
    foodName: "Masala peanuts",
    brandName: "Anjali",
    descriptor: "Roasted coated peanut snack",
    netValue: 180, netUnit: "g", drained: "", mrp: 60,
    qtyType: 3, pdpArea: 160, surfaceArea: 420, typeSize: 1.5, symbolSize: 4,
    packHeight: 150, packedOn: "01/11/2026", shelfLife: 6,
    lotCode: "MP-11A", fssaiNo: "10012345678901", fdaNo: "",
    maker: "Anjali Foods LLP",
    makerAddr: "Plot 14, Food Park Road, Nellore 524004, Andhra Pradesh",
    care: "care@anjalifoods.example · 1800 000 0000",
    nCholesterol: "", nFibre: "",
    storage: "Store in a cool, dry place away from direct sunlight",
    usage: "Ready to eat. Reseal the pack after opening.",
    origin: "", sulphite: "",
    nEnergy: 550, nProtein: 24, nCarb: 28, nSugar: 3, nAddedSugar: "",
    nFat: 38, nSatFat: 7, nTransFat: 0.2, nSodium: 780,
    servingSize: 30, servings: 6,
    rows: [
      { name: "Groundnut", pct: 62 },
      { name: "Gram flour", pct: 20 },
      { name: "Wheat flour", pct: 8 },
      { name: "Edible palmolein oil", pct: 5 },
      { name: "Salt", pct: 3 },
      { name: "Red chilli powder", pct: 1 },
      { name: "Acidity regulator (INS 330)", pct: 1 }
    ],
    allergens: { peanut: true, gluten: true },
    flags: { symbol: true, logo: true, emphasis: true, imported: false, blown: false },
    market: "IN", veg: "veg", dateMode: "use-by", packForm: "package"
  };

  /* Reference values the user may override, paired with their input ids. */
  var REF_FIELDS = [
    { id: "rdaEnergy", key: "IN_RDA_ENERGY_KCAL" },
    { id: "rdaFat", key: "IN_RDA_TOTAL_FAT_G" },
    { id: "rdaSatFat", key: "IN_RDA_SAT_FAT_G" },
    { id: "rdaTransFat", key: "IN_RDA_TRANS_FAT_G" },
    { id: "rdaAddedSugar", key: "IN_RDA_ADDED_SUGAR_G" },
    { id: "rdaSodium", key: "IN_RDA_SODIUM_MG" },
    { id: "sulphiteLimit", key: "SULPHITE_DECLARE_MG_KG" },
    { id: "energyTol", key: "ENERGY_TOLERANCE_PCT" }
  ];

  /* Fields that belong to one rule set only. */
  var IN_ONLY = ["fVeg", "fMrp", "fSymbolSize", "fArtFlags", "fFssai", "fAddedSugar", "fSurface"];
  var PH_ONLY = ["fFda", "fPackHeight", "fPackForm", "fFibre"];

  var state = {
    market: "IN",
    veg: "veg",
    dateMode: "use-by",
    packForm: "package",
    flags: { symbol: false, logo: false, emphasis: false, imported: false, blown: false },
    allergens: {},
    rows: []
  };
  var labelText = "";

  /* ---------------------------------------------------------------- DOM */

  function el(id) { return document.getElementById(id); }
  function text(id, s) { var n = el(id); if (n) { n.textContent = s; } }
  function val(id) { var n = el(id); return n ? n.value : ""; }

  function numOrNull(v) {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    var x = parseFloat(String(v).replace(/,/g, ""));
    return isFinite(x) ? x : null;
  }

  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }

  function add(parent, tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (content !== undefined && content !== null) { n.textContent = String(content); }
    parent.appendChild(n);
    return n;
  }

  function show(id, visible) { var n = el(id); if (n) { n.hidden = !visible; } }

  function selectLabel() {
    var pre = el("labelOut");
    if (!pre || !window.getSelection || !document.createRange) { return; }
    try {
      var range = document.createRange();
      range.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* selection is a convenience, never a failure */ }
  }

  /* ------------------------------------------------------------- money */

  function money(v, maxDp) {
    var x = numOrNull(v);
    if (x === null) return "—";
    var code = state.market === "PH" ? "PHP" : "INR";
    var loc = state.market === "PH" ? "en-PH" : "en-IN";
    try {
      return new Intl.NumberFormat(loc, {
        style: "currency", currency: code,
        minimumFractionDigits: 2, maximumFractionDigits: maxDp === undefined ? 2 : maxDp
      }).format(x);
    } catch (e) {
      return (state.market === "PH" ? "₱" : "₹") + x.toFixed(maxDp === undefined ? 2 : maxDp);
    }
  }

  function mm(v) {
    var x = numOrNull(v);
    return x === null ? "—" : String(x) + " mm";
  }

  /* ------------------------------------------------- ingredient rows */

  function renderIngRows() {
    var host = el("ingRows");
    if (!host) return;
    clear(host);
    var i;
    for (i = 0; i < state.rows.length; i++) {
      host.appendChild(ingRow(i));
    }
    if (state.rows.length === 0) {
      add(host, "p", "hint", "No ingredients yet — add the first one below.");
    }
  }

  function ingRow(index) {
    var row = state.rows[index];
    var nameId = "ing" + index + "name";
    var pctId = "ing" + index + "pct";

    var field = document.createElement("div");
    field.className = "field";

    var label = add(field, "label", null, "Ingredient " + (index + 1) + " ");
    label.setAttribute("for", nameId);
    add(label, "span", "hint", "name, then share by weight");

    var pair = add(field, "div", "row2");

    var nameWrap = add(pair, "div", "inp");
    var name = document.createElement("input");
    name.type = "text";
    name.id = nameId;
    name.autocomplete = "off";
    name.value = row.name === null || row.name === undefined ? "" : String(row.name);
    name.addEventListener("input", function () { state.rows[index].name = this.value; compute(); });
    nameWrap.appendChild(name);

    var pctWrap = add(pair, "div", "inp has-suf");
    var pctInput = document.createElement("input");
    pctInput.type = "number";
    pctInput.id = pctId;
    pctInput.min = "0";
    pctInput.step = "any";
    pctInput.setAttribute("inputmode", "decimal");
    pctInput.value = row.pct === null || row.pct === undefined || row.pct === "" ? "" : String(row.pct);
    pctInput.addEventListener("input", function () { state.rows[index].pct = this.value; compute(); });
    pctWrap.appendChild(pctInput);
    add(pctWrap, "span", "suf", "%");

    var seg = add(field, "div", "seg");
    var rm = add(seg, "button", null, "Remove");
    rm.type = "button";
    rm.setAttribute("aria-label", "Remove ingredient " + (index + 1));
    rm.addEventListener("click", function () {
      state.rows.splice(index, 1);
      renderIngRows();
      compute();
    });

    return field;
  }

  /* ---------------------------------------------------- allergen chips */

  function renderAllergenSeg() {
    var host = el("allergenSeg");
    if (!host) return;
    clear(host);
    var i, g, b;
    for (i = 0; i < R.ALLERGENS.length; i++) {
      g = R.ALLERGENS[i];
      b = add(host, "button", null, g.short || g.label);
      b.type = "button";
      b.setAttribute("data-allergen", g.id);
      b.setAttribute("aria-pressed", state.allergens[g.id] ? "true" : "false");
      b.setAttribute("title", g.label);
      b.addEventListener("click", function () {
        var id = this.getAttribute("data-allergen");
        state.allergens[id] = !state.allergens[id];
        this.setAttribute("aria-pressed", state.allergens[id] ? "true" : "false");
        compute();
      });
    }
  }

  /* ------------------------------------------------------- read inputs */

  function overrides() {
    var o = {}, i, v;
    for (i = 0; i < REF_FIELDS.length; i++) {
      v = numOrNull(val(REF_FIELDS[i].id));
      if (v !== null) { o[REF_FIELDS[i].key] = v; }
    }
    return o;
  }

  function declaredAllergens() {
    var out = [], k;
    for (k in state.allergens) {
      if (Object.prototype.hasOwnProperty.call(state.allergens, k) && state.allergens[k]) { out.push(k); }
    }
    return out;
  }

  function readForm() {
    return {
      market: state.market,
      foodName: val("foodName"),
      brandName: val("brandName"),
      descriptor: val("descriptor"),
      veg: state.veg,
      maker: val("maker"),
      makerAddress: val("makerAddr"),
      consumerCare: val("care"),
      lotCode: val("lotCode"),
      storage: val("storage"),
      usage: val("usage"),
      imported: state.flags.imported,
      origin: val("origin"),
      netValue: numOrNull(val("netValue")),
      netUnit: val("netUnit") || "g",
      drainedValue: numOrNull(val("drained")),
      mrp: numOrNull(val("mrp")),
      pdpAreaCm2: numOrNull(val("pdpArea")),
      surfaceAreaCm2: numOrNull(val("surfaceArea")),
      blownOrMoulded: state.flags.blown,
      packHeightMm: numOrNull(val("packHeight")),
      packForm: state.packForm,
      typeSizeMm: numOrNull(val("typeSize")),
      qtyNumeralMm: numOrNull(val("qtyType")),
      symbolSizeMm: numOrNull(val("symbolSize")),
      symbolPrinted: state.flags.symbol,
      logoPrinted: state.flags.logo,
      allergensEmphasised: state.flags.emphasis,
      fssaiNumber: val("fssaiNo"),
      fdaNumber: val("fdaNo"),
      packedOn: val("packedOn"),
      shelfLifeMonths: numOrNull(val("shelfLife")),
      dateMode: state.dateMode,
      ingredients: state.rows,
      sulphiteMgKg: numOrNull(val("sulphite")),
      allergensDeclared: declaredAllergens(),
      nutrition: {
        energyKcal: numOrNull(val("nEnergy")),
        proteinG: numOrNull(val("nProtein")),
        carbG: numOrNull(val("nCarb")),
        totalSugarG: numOrNull(val("nSugar")),
        addedSugarG: numOrNull(val("nAddedSugar")),
        totalFatG: numOrNull(val("nFat")),
        satFatG: numOrNull(val("nSatFat")),
        transFatG: numOrNull(val("nTransFat")),
        cholesterolMg: numOrNull(val("nCholesterol")),
        fibreG: numOrNull(val("nFibre")),
        sodiumMg: numOrNull(val("nSodium")),
        servingSizeG: numOrNull(val("servingSize")),
        servingsPerPack: numOrNull(val("servings"))
      }
    };
  }

  /* ----------------------------------------------------------- render */

  function renderVerdict(res) {
    var s = res.summary;
    text("verdictK", "Label verdict · " + (res.market === "PH" ? "PH FDA rule set" : "FSSAI + Legal Metrology rule set"));
    text("verdict", s.mustFix === 0 ? "No blocker" : s.mustFix + (s.mustFix === 1 ? " must fix" : " must fix"));
    text("verdictSub", s.pass + " of " + s.checks + " checks pass · " + s.advisory +
      " to review · " + s.mustFix + " blocking");
  }

  function renderGroups(res) {
    var host = el("groupRows");
    if (!host) return;
    clear(host);
    var i, g, tr;
    for (i = 0; i < res.groups.length; i++) {
      g = res.groups[i];
      tr = add(host, "tr", g.mustFix ? null : "sub");
      add(tr, "td", null, g.label);
      add(tr, "td", g.mustFix ? "num neg" : "num", g.mustFix || "—");
      add(tr, "td", "num", g.advisory || "—");
      add(tr, "td", "num", g.pass || "—");
    }
    text("totMust", String(res.summary.mustFix));
    text("totAdv", String(res.summary.advisory));
    text("totPass", String(res.summary.pass));
  }

  function renderFacts(res) {
    var d = res.derived, inp = res.input;
    text("fNet", d.netQuantityText ? d.netQuantityText.replace(/^[^:]+:\s*/, "") : "—");
    text("fMinQty", mm(d.minQtyNumeralMm));
    text("fMinType", d.minTypeMm === null ? "none prescribed" : mm(d.minTypeMm));
    text("fMinSym", res.market === "IN"
      ? mm(d.minSymbolMm) + (d.minSquareMm ? " in a square of " + d.minSquareMm + " mm" : "")
      : "n/a");
    text("fPrice", res.market === "IN" ? money(inp.mrp) : "not a label declaration");
    var up = d.unitSalePrice;
    text("fUnit", !up ? "—" : up.sameAsRetail ? "same as the retail price" :
      money(up.value, C.LM_UNIT_PRICE_DP) + " " + up.per);
    text("fBB", d.bestBefore || "—");
    text("fDateForm", res.market === "PH" ? "DD Month YYYY"
      : (R.inDateStyle(inp.shelfLifeMonths, res.config) === "short" ? "DD/MM/YY" : "MMM YYYY"));
    text("fEnergy", d.computedEnergyKcal === null ? "—" : Math.round(d.computedEnergyKcal * 10) / 10 + " kcal");
    text("fSalt", d.saltEquivalentG === null ? "—" : Math.round(d.saltEquivalentG * 100) / 100 + " g");
  }

  function renderFindings(res) {
    var host = el("findings");
    if (!host) return;
    clear(host);
    var problems = res.problems.slice().sort(function (a, b) {
      if (a.severity === b.severity) return 0;
      return a.severity === "must-fix" ? -1 : 1;
    });
    if (problems.length === 0) {
      var li = add(host, "li");
      add(li, "b", null, "Nothing to fix. ");
      li.appendChild(document.createTextNode("All " + res.summary.checks +
        " checks in this rule set pass. That is not a clearance — read the scope note below."));
      return;
    }
    var i, p, item;
    for (i = 0; i < problems.length; i++) {
      p = problems[i];
      item = add(host, "li");
      add(item, "b", null, p.severity === "must-fix" ? "Must fix — " : "Review — ");
      item.appendChild(document.createTextNode(p.message + " "));
      add(item, "span", "pill", p.cite ? p.authority.split(" · ")[0] + " " + p.cite : p.authority.split(" · ")[0]);
    }
  }

  function renderLabel(res) {
    var pre = el("labelOut");
    if (!pre) return;
    clear(pre);
    var i, j, line, seg, node;
    for (i = 0; i < res.label.lines.length; i++) {
      line = res.label.lines[i];
      for (j = 0; j < line.segs.length; j++) {
        seg = line.segs[j];
        if (seg.b) {
          node = document.createElement("b");
          node.textContent = seg.t;
          pre.appendChild(node);
        } else {
          pre.appendChild(document.createTextNode(seg.t));
        }
      }
      pre.appendChild(document.createTextNode("\n"));
    }
    labelText = res.labelText;
  }

  function renderSymbol(res) {
    var isIN = res.market === "IN";
    var nonVeg = res.input.veg === "nonveg";
    show("symVeg", isIN && !nonVeg);
    show("symNonVeg", isIN && nonVeg);
    if (!isIN) {
      text("symCaption", "The Philippine rule set has no vegetarian / non-vegetarian symbol.");
      return;
    }
    text("symCaption", (nonVeg ? "Non-vegetarian: " + C.IN_NONVEG_COLOUR : "Vegetarian: " + C.IN_VEG_COLOUR) +
      ", at least " + res.derived.minSymbolMm + " mm" +
      (res.derived.minSquareMm ? " inside a square of " + res.derived.minSquareMm + " mm" : "") +
      ", on the principal display panel near the name or brand name of the food.");
  }

  function applyMarket() {
    var i;
    for (i = 0; i < IN_ONLY.length; i++) { show(IN_ONLY[i], state.market === "IN"); }
    for (i = 0; i < PH_ONLY.length; i++) { show(PH_ONLY[i], state.market === "PH"); }
  }

  function compute() {
    var res = R.lint(readForm(), overrides());
    renderVerdict(res);
    renderGroups(res);
    renderFacts(res);
    renderFindings(res);
    renderLabel(res);
    renderSymbol(res);
  }

  /* ------------------------------------------------------------ toggles */

  function pressGroup(attr, value) {
    var btns = document.querySelectorAll("[" + attr + "]"), i;
    for (i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute(attr) === value ? "true" : "false");
    }
  }

  function wireChoice(attr, key, after) {
    var btns = document.querySelectorAll("[" + attr + "]"), i;
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        state[key] = this.getAttribute(attr);
        pressGroup(attr, state[key]);
        if (after) { after(); }
        compute();
      });
    }
  }

  function wireFlags() {
    var btns = document.querySelectorAll("[data-flag]"), i;
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        var f = this.getAttribute("data-flag");
        state.flags[f] = !state.flags[f];
        this.setAttribute("aria-pressed", state.flags[f] ? "true" : "false");
        compute();
      });
    }
  }

  function paintFlags() {
    var btns = document.querySelectorAll("[data-flag]"), i, f;
    for (i = 0; i < btns.length; i++) {
      f = btns[i].getAttribute("data-flag");
      btns[i].setAttribute("aria-pressed", state.flags[f] ? "true" : "false");
    }
  }

  /* --------------------------------------------------------- seed/reset */

  function setVal(id, v) {
    var n = el(id);
    if (n) { n.value = v === null || v === undefined ? "" : String(v); }
  }

  function seedReferenceValues() {
    var i;
    for (i = 0; i < REF_FIELDS.length; i++) {
      setVal(REF_FIELDS[i].id, C[REF_FIELDS[i].key]);
    }
  }

  function seedExample() {
    var k, skip = { rows: 1, allergens: 1, flags: 1, market: 1, veg: 1, dateMode: 1, packForm: 1 };
    for (k in EXAMPLE) {
      if (!Object.prototype.hasOwnProperty.call(EXAMPLE, k) || skip[k]) continue;
      setVal(k, EXAMPLE[k]);
    }
    state.rows = EXAMPLE.rows.map(function (r) { return { name: r.name, pct: r.pct }; });
    state.allergens = {};
    for (k in EXAMPLE.allergens) {
      if (Object.prototype.hasOwnProperty.call(EXAMPLE.allergens, k)) { state.allergens[k] = EXAMPLE.allergens[k]; }
    }
    state.flags = {
      symbol: EXAMPLE.flags.symbol, logo: EXAMPLE.flags.logo,
      emphasis: EXAMPLE.flags.emphasis, imported: EXAMPLE.flags.imported, blown: EXAMPLE.flags.blown
    };
    state.market = EXAMPLE.market;
    state.veg = EXAMPLE.veg;
    state.dateMode = EXAMPLE.dateMode;
    state.packForm = EXAMPLE.packForm;
  }

  function resetAll() {
    var inputs = document.querySelectorAll("input[type=number], input[type=text]"), i;
    for (i = 0; i < inputs.length; i++) { inputs[i].value = ""; }
    var unit = el("netUnit");
    if (unit) { unit.value = "g"; }
    state.rows = [{ name: "", pct: "" }, { name: "", pct: "" }, { name: "", pct: "" }];
    state.allergens = {};
    state.flags = { symbol: false, logo: false, emphasis: false, imported: false, blown: false };
    state.veg = "veg";
    state.dateMode = "use-by";
    state.packForm = "package";
    seedReferenceValues();           // configuration, not data: restore the defaults
    pressGroup("data-veg", state.veg);
    pressGroup("data-datemode", state.dateMode);
    pressGroup("data-market", state.market);
    pressGroup("data-packform", state.packForm);
    paintFlags();
    renderAllergenSeg();
    renderIngRows();
    text("copyNote", "");
    compute();
  }

  /* -------------------------------------------------------------- init */

  function init() {
    seedExample();
    seedReferenceValues();
    renderAllergenSeg();
    renderIngRows();
    paintFlags();
    pressGroup("data-market", state.market);
    pressGroup("data-veg", state.veg);
    pressGroup("data-datemode", state.dateMode);
    pressGroup("data-packform", state.packForm);
    applyMarket();

    var inputs = document.querySelectorAll("input[type=number], input[type=text]"), i;
    for (i = 0; i < inputs.length; i++) { inputs[i].addEventListener("input", compute); }
    var unit = el("netUnit");
    if (unit) { unit.addEventListener("change", compute); }

    wireChoice("data-market", "market", applyMarket);
    wireChoice("data-veg", "veg", null);
    wireChoice("data-datemode", "dateMode", null);
    wireChoice("data-packform", "packForm", null);
    wireFlags();

    var addBtn = el("addIng");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        state.rows.push({ name: "", pct: "" });
        renderIngRows();
        compute();
        var last = el("ing" + (state.rows.length - 1) + "name");
        if (last) { last.focus(); }
      });
    }

    var p = el("print");
    if (p) { p.addEventListener("click", function () { window.print(); }); }

    var r = el("reset");
    if (r) { r.addEventListener("click", resetAll); }

    var copyBtn = el("copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var settled = false;
        function done(ok) {
          if (settled) { return; }
          settled = true;
          if (ok) { text("copyNote", "Label copy is on the clipboard."); return; }
          selectLabel();                 // leave it selected so the copy shortcut works
          text("copyNote", "The clipboard is not available here — the block above is selected, so copy it from there.");
        }
        /* A clipboard write can sit pending forever without user activation, so the
           button always says something within a moment either way. */
        var timer = setTimeout(function () { done(false); }, 1200);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            navigator.clipboard.writeText(labelText).then(
              function () { clearTimeout(timer); done(true); },
              function () { clearTimeout(timer); done(false); }
            );
          } catch (e) { clearTimeout(timer); done(false); }
        } else { clearTimeout(timer); done(false); }
      });
    }

    compute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
