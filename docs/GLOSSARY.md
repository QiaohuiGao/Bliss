# US Wedding Glossary

Terms Bliss uses **verbatim** in UI copy. Using the wrong word here is not a
style problem: a couple who confuses an escort card with a place card, or a
service charge with a gratuity, makes a real and expensive mistake.

**Definitions live in
[`packages/i18n/src/locales/en/glossary.json`](../packages/i18n/src/locales/en/glossary.json)**,
not in this file, so they can be surfaced as inline tooltips and translated like
any other string. This document explains *why* these particular terms matter and
which ones are load-bearing.

---

## The terms that cause real damage when confused

| Confusion | Consequence |
|---|---|
| **Service charge** vs **gratuity** | A 20-25% service charge often does not reach the staff. Couples who assume it did under-tip; couples who budget for both are the only ones who are right. |
| **Escort card** vs **place card** | Escort cards send a guest to a *table*. Place cards assign a *seat*. Ordering the wrong one two weeks out is unrecoverable. |
| **Venue coordinator** vs **day-of coordinator** | The venue coordinator works for the venue. Couples who think they have a planner and do not are the single most common source of day-of chaos. |
| **Site fee** vs **food and beverage minimum** | The F&B minimum is usually the larger number and is quoted separately. Comparing venues on site fee alone is comparing the wrong number. |
| **Marriage license** vs **marriage certificate** | The license is the permit to marry. The certificate is proof you did. Name-change steps want the certificate. |
| **Waiting period** | Set by state law, cannot be waived. Three days in 17 states. Getting the license too late means the wedding is not legal on the day. |
| **Alterations lead time** | 6-8 weeks and 2-3 appointments, on top of a 6-9 month order time. The most underestimated number in wedding planning. |

---

## Categories covered in the catalog

- **Planning roles** — wedding planner (full-service, partial), day-of
  coordinator, venue coordinator, officiant, point person
- **Stationery and paper** — save-the-date, invitation suite, RSVP card,
  response deadline, escort card, place card, menu card, programs, signage,
  thank-you notes, calligraphy, inner/outer envelope, "and Guest"
- **Events** — engagement party, bridal shower, bachelor/bachelorette, welcome
  party, rehearsal, rehearsal dinner, first look, cocktail hour, grand entrance,
  first dance, parent dances, toasts, cake cutting, bouquet toss, last dance,
  send-off, after-party, farewell brunch
- **People** — wedding party, maid/matron of honor, best man, bridesmaids,
  groomsmen, attendants, flower girl, ring bearer, ushers, VIPs, processional
  order
- **Contracts and money** — retainer, COI, force majeure, service charge,
  gratuity, corkage fee, cake-cutting fee, plated / buffet / family-style /
  stations, open / limited / cash / consumption bar, BYOB, all-inclusive,
  minimum spend, vendor meal, overtime rate, site fee, setup/strike, final
  headcount
- **Design and rentals** — tablescape, centerpiece, charger, linens, chiavari
  chair, installation, arch/arbor/chuppah, ceremony backdrop, draping,
  uplighting, string lights, tenting, floor plan, seating chart, head table,
  sweetheart table, welcome table, guest book, escort display, flat lay, golden
  hour, getting-ready suite, shot list, run of show
- **Attire** — silhouette (A-line, ball gown, mermaid, sheath), alterations,
  bustle, veil lengths, dress codes (black tie, black tie optional, cocktail,
  semi-formal, dressy casual, garden party), tux vs suit, boutonnière, corsage
- **Types of wedding** — elopement, micro wedding, destination, courthouse,
  backyard, all-inclusive resort, second line, unplugged ceremony, content
  creator

---

## Copy rules

1. **Use the term, then explain it once.** Never invent a friendlier synonym.
   Couples will encounter the real term the moment they talk to a vendor, and a
   product that taught them a different word has actively hurt them.
2. **Attach the tooltip on first use per screen**, not every use.
3. **Numbers come from
   [docs/US-MARKET-PLAN.md](US-MARKET-PLAN.md) §1.2**, not from memory.
4. **Never state a legal fact from memory.** Marriage license rules come from
   `apps/api/src/content/marriage-license.ts` and always ship with the
   disclaimer key `quest.legal.disclaimer`.

---

## Deliberately not used

| Avoided | Instead | Why |
|---|---|---|
| "Bride" / "groom" as structural roles | "You", "your partner", "the couple" | The product must work for same-sex couples. Attire quests are named by garment, not by gender. |
| "The bride's family pays" | "Who's contributing" | Largely obsolete in the US, and never true for many immigrant families. |
| Auspicious-date logic | Season, venue availability, holiday weekends, off-peak pricing | The China-market version of this product used a lunar calendar. The US equivalent is pricing and travel. |
