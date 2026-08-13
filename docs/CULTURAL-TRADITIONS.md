# Cultural Traditions

About **one in four US couples blends two traditions**. This is Bliss's clearest
differentiator: The Knot and Zola treat culture as a blog category, not as
something that changes your task list, your lead times, and your vendor set.

---

## How it works

Cultural traditions are **additive packs**, never a fork of the base tree.

```
onboarding: cultures[] ──► generator merges packs into the base 14 quests
                            │
                            ├─ grafts:  extra sections appended to existing quests
                            └─ quests:  whole new quests (multi-day event traditions)
```

Implementation:

- Structure: [`apps/api/src/content/culture-packs.ts`](../apps/api/src/content/culture-packs.ts)
- Copy: [`packages/i18n/src/content/en/cultures.json`](../packages/i18n/src/content/en/cultures.json)
- Key namespace: `culture.<culture>.*`, kept separate from `quest.*`

**Culture is independent of locale.** A Chinese-American couple may well want an
English UI with the Chinese tradition pack. Never infer one from the other.

Selecting two heritages merges both. Verified output:

| Selection | Quests | Sections | Tasks |
|---|---|---|---|
| Base (traditional) | 14 | 50 | 208 |
| + South Asian | 15 | 58 | 233 |
| + Chinese | 15 | 57 | 225 |
| + Chinese + Jewish | 16 | 63 | 243 |

Regenerate with `bun run verify:generation`.

---

## Shipped packs

| Heritage | Rituals and events modeled | Planning consequences |
|---|---|---|
| **South Asian** | Mehndi, Sangeet, Haldi, Baraat, Mandap, Saptapadi, Jaimala, Vidaai | Multi-day (2-4 events), 300-500 guests, South Asian caterer, dhol, pandit or imam, per-event outfits, guest attire guidance |
| **Chinese** | Tea ceremony, door games, hair combing, qipao and outfit changes, 8-10 course banquet, red envelopes, double happiness decor | Venue with a Chinese kitchen, elder-order etiquette, two-family gift exchange, bilingual MC, longer banquet timeline |
| **Jewish** | Ketubah, chuppah, bedeken, circling, sheva brachot, breaking the glass, hora, yichud, aufruf | No Shabbat or holiday dates, rabbi/cantor availability, kosher decision *before* booking a venue, ketubah artist lead time |
| **Korean** | Paebaek, hanbok, jeonan-rye, ceremonial table | Hanbok rental plus a dresser, paebaek room at the venue, family-bow choreography |
| **Nigerian / West African** | Traditional engagement (Igba Nkwu, Yoruba engagement), aso-ebi, money spray, gele | Two weddings, fabric sourced and distributed months out, alaga or MC, small bills arranged with the bank in advance |
| **Mexican / Latin American** | Misa, lazo, padrinos/madrinas, arras, mariachi, hora loca, vals, dollar dance | Pre-Cana requirements, padrino sponsorship distributes real budget, late-night second meal |
| **Persian / Iranian** | Sofreh Aghd, knife dance, honey ritual, aghd and jashn | Sofreh designer, aghd officiant, dinner starts much later than a US venue expects |
| **Vietnamese** | Lễ Gia Tiên, ancestral altar, áo dài, gift trays | Odd number of trays, unmarried carriers assigned early, family procession |
| **Filipino** | Cord, veil, and candle sponsors; principal sponsors | Sponsor lists grow; decide the number before the names |
| **Greek** | Koumbaro, stefana, koufeta, money dance | Stefana lead time, church requirements |

Accepted at onboarding but not yet packed: Ethiopian, Italian, Polish, Hmong,
Armenian, Arab. They follow the same pattern (ancestral or family ceremony +
Western ceremony + banquet) and are additive to write.

---

## Cross-cutting needs

These are not per-heritage; they apply to any couple blending traditions or with
family abroad, and they are woven through the base tree.

**Interfaith and two-officiant ceremonies.** Ritual order is a family
negotiation before it is a logistics problem. The Ceremony quest carries tasks
for blending scripts and introducing both officiants to each other.

**Bilingual everything.** Invitations, signage, program, MC. A good bilingual MC
keeps both halves of the room in the same moment rather than translating after
the fact.

**International guests.**
- Save-the-dates 9-12 months out, not 6-8
- Visa invitation letters, which some consulates require and which take months
- Passport validity (many countries require six months remaining)
- Hotel blocks and airport logistics

**Documents for the marriage license.** Foreign birth certificates and divorce
decrees generally need **certified English translation**. Some consulates also
want single-status affidavits. This is in the Legal quest with a lead time,
because couples discover it far too late.

**Immigration adjacency.** Informational only, never legal advice. Couples
marrying on a K-1 visa have a **90-day window**. Others plan around adjustment of
status or a separate ceremony abroad. Every one of these tasks ships with a
"consult an attorney" disclaimer.

**Family money and politics.** The US "bride's family pays" convention is
largely obsolete, and was never the convention for many immigrant families —
some expect the groom's family or padrinos to fund specific items. The
Foundation quest asks who is contributing *and* whether the contribution comes
with expectations, because that is the actual conversation.

---

## Adding a pack

1. Add the heritage to `Culture` in `packages/types/src/index.ts`.
2. Add an entry to `CULTURE_PACKS` in `apps/api/src/content/culture-packs.ts`:
   grafts for sections that belong inside an existing quest, `quests` for
   traditions that are genuinely their own multi-day arc.
3. Add copy under `culture.<name>.*` in
   `packages/i18n/src/content/en/cultures.json`.
4. Add the onboarding label under `onboarding.step.cultures.option.<name>`.
5. Run `bun run verify:generation` — it fails if any generated row has no
   catalog entry.

**Write real lead times.** The value of a pack is not the ritual names, which
the couple already knows. It is telling them that aso-ebi fabric has to be
sourced and distributed months out, or that a fully kosher kitchen narrows their
venue list before they tour anything.
