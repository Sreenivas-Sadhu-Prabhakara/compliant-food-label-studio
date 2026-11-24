# Compliant Food Label Studio

A free, open-source label checker and copy generator for packaged food. Fill in the recipe, the pack and the panel once, and it tells you which mandatory declarations are missing or malformed before the print run — then writes out the label copy you can hand to a printer.

It is one HTML page with no dependencies, no build step, no account and no network calls. Everything runs in the browser; nothing you type leaves the machine.

## What it checks

- **Ingredients** — descending order of composition by weight, percentage totals, repeated entries, added water, and additives that must carry both a functional class name and an INS number.
- **Allergens** — reads your ingredient names against the eight statutory groups, in English and in the names Indian and Philippine labels actually use (`ghee`, `suji`, `moongphali`, `patis`, `hipon`), and compares them with what the label declares. `coconut milk` and `nutmeg` do not trip the milk and tree-nut rules. Sulphites are checked against the declaration threshold.
- **Net quantity** — the right unit for the quantity, including the proviso that lets a one-kilogram pack be declared either way, plus the minimum numeral height for the pack.
- **Price** — the retail sale price and the unit sale price, in the form and to the precision the rules now require.
- **Date marking** — strict date parsing, the durability date computed by month arithmetic that clamps to a shorter month, the correct printed form for the shelf life, and the right durability term for the market.
- **Licence and traceability** — the shape of the FSSAI number, the logo, the lot code.
- **Nutrition panel** — completeness for the market, the provisos that drop saturated fat, trans fat and cholesterol off a low-fat or plant-only product, per-serve values, percentage contribution to the daily reference values, and arithmetic that cannot be true (saturated plus trans fat above total fat, added sugars above total sugars, sugars above carbohydrate, macronutrients above 100 g per 100 g, declared energy far from the conversion factors).
- **Artwork** — minimum type size from two different tables, the veg / non-veg symbol by circle diameter or triangle side, and the small-package reliefs.

Findings come in two weights: **must fix** for a declaration the cited rule requires that is missing, malformed or impossible, and **review** for anything the tool cannot see or that is good practice rather than law. Every finding names the rule it comes from.

## Who it is for

Spice, snack, pickle, bakery and other small packaged-food units selling into retail in **India**, and processed-food SMEs preparing labels for the **Philippine** market. It is aimed at the person who has a recipe and a printer's quote and no compliance department.

## The rules it implements

- **India** — Food Safety and Standards (Labelling and Display) Regulations, 2020, as amended, read with the Legal Metrology (Packaged Commodities) Rules, 2011, as amended.
- **Philippines** — FDA Administrative Order 2014-0030, as amended by AO 2014-0030-A, with FDA Circular 2023-009 for the nutrition panel, DOH AO 2021-0039 for trans-fatty acids, and the surviving type-size provisions of AO 88-B s. 1984.
- **Codex Alimentarius** CXS 1-1985 where a point is common practice rather than national law; the page says so when it does.

Every statutory figure sits as a named constant in one block at the top of `assets/rules.js`, with the provision it comes from beside it. The page lists them all under **Assumptions & rates**, and the reference values, the sulphite threshold and the energy tolerance can be overridden in the inputs panel if the figure for your product differs.

## Running it

```sh
python3 -m http.server 8137
```

Then open <http://localhost:8137/>. Any static file server will do; the page is `index.html` with four files in `assets/`.

To run the rule tests:

```sh
node --test tests/rules.test.js
```

The rules live in `assets/rules.js` as a pure module with no DOM and no browser APIs, so the test suite exercises the same code the page runs. The tests are table-driven and cover each rule's boundaries — the kilogram switch, the three-month date gate, the sulphite threshold, every band edge of both type-size tables — along with malformed and hostile input.

## Honest limits

This is indicative, and it is not legal advice. It checks the rules it has been given, not the rules that apply to your product: category standards (infant nutrition, dairy, nutraceuticals, alcoholic beverages, fortified, organic, irradiated and genetically modified foods) carry extra declarations that are not modelled, nutrition and health claims are out of scope, and nutrient tolerances need laboratory values the tool does not have. It validates the shape of a licence number, never its validity. It writes label copy, not artwork.

It also does **not** check rules that are proposed but not in force — front-of-pack nutrition labelling and the bold-type nutrient draft in India, the warning-label bills in the Philippines — because flagging a compliant label is worse than saying nothing. The page lists these separately, and lists what is not implemented at all.

Statutory figures and formats change. Verify against the current notification, and against your own product standard, before you commit a print run.

MIT licensed.
