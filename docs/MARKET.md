# US Wedding Market — Research Findings

**Date:** 2026-08-13
**Purpose:** The factual base the product rests on. Numbers, timelines, and
structural facts cited by [PRD.md](../PRD.md) and used as defaults in code.

This is a reference document, not a plan. When a benchmark in the app disagrees
with this file, one of the two is wrong and this file is the one to check first.
Related: [GLOSSARY.md](GLOSSARY.md) for terminology,
[CULTURAL-TRADITIONS.md](CULTURAL-TRADITIONS.md) for the multicultural layer.

---

## 1. How Americans actually plan a wedding

**Engagement to wedding is typically 12–18 months.** Popular venues and
peak-season dates (May–October, Saturday preferred) are booked 12–18 months out.
Shorter engagements of 6–9 months are common and need a genuinely compressed task
set rather than the same list with tighter dates.

The canonical booking order — this is the backbone of the task graph:

| When | What happens |
|---|---|
| 12–18 mo | Overall budget, draft guest count, venue + date, planner, wedding insurance |
| 9–12 mo | Photographer, videographer, caterer, band/DJ, officiant; engagement party; wedding website; save-the-dates; gown ordered (6–9 mo before alterations) |
| 6–8 mo | Florist, cake, rentals, hair and makeup, transportation, hotel room blocks, registry, honeymoon and passports |
| 4–6 mo | Invitations ordered, menu tasting, ceremony music, suits, wedding party attire, pre-marital counseling if the venue is religious |
| 2–3 mo | Invitations mailed (6–8 weeks out), marriage license research, day-of timeline draft, seating chart started, vows, bachelor/ette, shower |
| 1 mo | RSVP chase, final headcount to caterer, license obtained, final fitting, escort/place cards, final payments and tips prepped |
| 1 week | Rehearsal and rehearsal dinner, emergency kit, final counts delivered, vendor arrival times confirmed |
| Day of / after | Ceremony, reception, send-off; then thank-yous, name change, dress preservation, album |

These month buckets are not a standard — they are hand-computed critical-path
results for an average wedding. Bliss computes them instead, which is what lets
it serve a couple with six months, three hours a week, and a rented dress. See
[DESIGN.md](../DESIGN.md) § CPM Scheduler.

### 1.1 Structural facts specific to the US

1. **Legal marriage is a separate, state-level task.** The license is issued by a
   county clerk, expires (typically 30–90 days), and many states impose a waiting
   period — 3 days in AK, FL, IN, IA, KS, LA, ME, MA, MI, MS, MO, NH, NJ, OR, PA,
   TN, WA; 48 hours in MD. Officiant rules also vary, and some jurisdictions
   (parts of NY) do not reliably accept online ordinations, which can invalidate a
   marriage. This is why Bliss has a dedicated Legal quest and why these values
   live in a lookup table.
2. **Post-wedding legal admin is not automatic.** A name change requires Social
   Security → driver's license → passport → banks, in that order.
3. **Multi-event structure, not one banquet:** engagement party, shower,
   bachelor/ette, welcome party, rehearsal dinner, wedding day, farewell brunch.
4. **Registry and wedding website are core, not optional.** The website carries
   RSVP, travel, dress code, and registry links.
5. **Guest logistics are heavy:** hotel room blocks, shuttles, welcome bags for
   out-of-town guests, plus-one policy, kids policy, dietary tracking, RSVP with
   meal choice.
6. **Tipping and vendor gratuity is an expected budget line.**
7. **Weather backup plan and wedding insurance** are standard; many venues
   require a certificate of insurance.
8. **No auspicious-date logic.** The US equivalent is season, venue availability,
   holiday weekends, guest travel, and off-peak pricing (Friday, Sunday, winter).

## 2. Budget benchmarks

The Knot 2026 Real Weddings Study: average US wedding **≈ $34,200**, average
**117 guests**, **≈ $290–300 per guest**. Venue ≈ **$12,900**; catering ≈
**$85/person**; photography ≈ **$3,800**; florals ≈ **$2,900**; DJ ≈ **$1,700**;
live band ≈ **$4,200**.

Planner-standard allocation, used as the app's default budget model
(`BUDGET_ALLOCATION` in `packages/types`):

| Category | % of budget |
|---|---|
| Venue + catering, incl. bar | 40–50% |
| Photography + videography | 10–12% |
| Flowers + decor | 8–10% |
| Attire + beauty | 5–9% |
| Music / entertainment | 5–10% |
| Rings | ~4% |
| Stationery | 2–3% |
| Transportation | ~2% |
| Favors / gifts | ~2% |
| **Buffer + tips** | **5–10%** |

Budget tiers: `Under $20k` · `$20k–$40k` · `$40k–$75k` · `$75k+`, always shown
with a regional-variance note (NYC, CA, NJ high; Midwest and South lower).

Guest tiers are set against the 117 average:
`under_50 | 50_100 | 100_150 | 150_250 | over_250`.

## 3. Competitors

| Product | Strength | The gap Bliss aims at |
|---|---|---|
| **The Knot** | Vendor marketplace scale, SEO reach | The checklist is one static list for everyone; culture is a blog category |
| **Zola** | Registry plus website plus checklist, strong brand | Same static checklist; monetization pulls toward registry, not planning |
| **Joy** | Best free website and RSVP | Planning is thin; it is a website product |
| **Minted** | Stationery and design quality | Paper only |
| Spreadsheets, Notion templates | Free, infinitely flexible | Nobody tells you what you forgot, or that it is already too late |

None of them generate a different list for a couple who is renting the dress
versus commissioning it, and none of them model lead time as a constraint. That
is the opening.

## 4. Multicultural context

About **one in four US couples blends two traditions**, and the US wedding market
is heavily multicultural. This is Bliss's clearest differentiator and it has its
own document — see [CULTURAL-TRADITIONS.md](CULTURAL-TRADITIONS.md) for the
shipped heritage packs, cross-cutting immigrant-family needs (bilingual copy,
international guest lead times, certified document translation, immigration
adjacency), and how to add a pack.

---

## Sources

- [Zola — Ultimate Wedding Planning Checklist & Timeline](https://www.zola.com/expert-advice/your-ultimate-wedding-planning-checklist)
- [Loverly — 12-Month Wedding Timeline](https://loverly.com/planning/wedding-101/12-month-wedding-timeline)
- [planning.wedding — 12 Month Checklist](https://planning.wedding/timeline/checklist)
- [The Knot — Average Wedding Cost](https://www.theknot.com/content/average-wedding-cost)
- [The Knot Worldwide — 2026 Real Weddings Study](https://www.theknotww.com/press-releases/the-knot-worldwide-unveils-2026-real-weddings-study)
- [The Knot — Wedding Budget Breakdown](https://www.theknot.com/content/wedding-budget-ways-to-save-money)
- [MyWeddingKit — Wedding Budget Percentages 2026](https://myweddingkit.co/blog/wedding-budget-percentages)
- [G Squared Weddings — Wedding Glossary (400+ terms)](https://gsquaredweddings.com/wedding-glossary/)
- [Jessica Dum — Common Wedding Terminology](https://jessicadum.com/resources-common-wedding-terminology/)
- [WedSociety — Wedding Terminology Guide](https://www.wedsociety.com/article/wedding-terminology/)
- [The Knot — Multicultural Wedding Planning Advice](https://www.theknot.com/content/multicultural-wedding-tips)
- [David's Bridal — Blending Wedding Traditions from Two Cultures](https://www.davidsbridal.com/content/wedding-traditions/how-to-beautifully-blend-wedding-traditions-from-two-cultures)
- [FindLaw — Marriage License Requirements](https://www.findlaw.com/family/marriage/marriage-license-requirements.html)
- [Herman Legal Group — How to Obtain a Marriage License in the US and Abroad](https://www.lawfirm4immigrants.com/how-to-get-a-marriage-license-in-the-us/)
- [Assorted Artistries — Getting Married in New York: Licenses & Officiants](https://assortedartistries.com/2026/04/14/how-to-get-married-in-new-york/)
