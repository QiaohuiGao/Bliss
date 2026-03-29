import type { PlanningStyle } from '@bliss/types'

interface TaskTemplate {
  stage: number
  title: string
  whyItMatters: string
  howToDoIt: Record<PlanningStyle, string>
  doneDefinition: string
  dueGuidance: string
  isDeliverable: boolean
  celebrationTrigger?: string
  sortOrder: number
}

export const STAGE_TASKS: TaskTemplate[] = [
  // ─── Stage 1: Foundation ──────────────────────────────────────────────────
  {
    stage: 1, sortOrder: 1,
    title: 'Align on your wedding vision',
    whyItMatters: 'Every decision that follows — venue, vendors, budget — flows from your shared vision. Getting aligned now saves real heartache later.',
    howToDoIt: {
      full_diy: 'Spend an evening together looking at photos that resonate. Note what draws you in: outdoor spaces, candlelight, natural textures. Write down 3 words that describe the feeling you want.',
      mixed: 'Look at a mix of real wedding photos and Pinterest boards together. Identify 3–5 consistent aesthetic threads. Note which elements you want to DIY vs. hire out.',
      vendor_led: 'Browse wedding magazines and photographer portfolios together. Identify 3–5 images that represent your ideal day. Save them to share with your planner or florist.',
      full_service: 'Collect 5–10 images from magazines, Instagram, and real weddings that feel right. Organize them to share with your wedding planner at your first meeting.',
    },
    doneDefinition: "Both partners have described the feeling they want from the wedding day in 3–5 words, and you've agreed on at least 3 vibe tags.",
    dueGuidance: '12–18 months before the wedding — the earlier the better.',
    isDeliverable: true,
  },
  {
    stage: 1, sortOrder: 2,
    title: 'Set your guest count range',
    whyItMatters: "Your guest count is the single number that shapes everything: venue size, catering cost, how intimate the day feels. It's worth getting this right before you fall in love with a venue.",
    howToDoIt: {
      full_diy: "Write out your \"must invite\" list first — immediate family, closest friends. Then a \"would love to have\" list. See where the numbers land naturally before making decisions.",
      mixed: "Each partner makes their own must-invite list independently. Compare. Add the would-love list. Look at the total and discuss what feels right vs. what feels manageable.",
      vendor_led: "Write your lists, then have an honest conversation about family expectations. This is often where the most negotiation happens — it\'s normal.",
      full_service: 'Work through your lists together, then bring them to your planner. They can help you have the hard conversations about family expectations diplomatically.',
    },
    doneDefinition: "You've agreed on a guest count range (e.g. 40–60 people) and selected your guest count mode in your Bliss profile.",
    dueGuidance: '12–18 months before. Venues often have guest minimums — knowing your count lets you rule venues in or out early.',
    isDeliverable: true,
  },
  {
    stage: 1, sortOrder: 3,
    title: 'Define what matters most',
    whyItMatters: "Budget trade-offs are inevitable. Knowing what you care about most — great food, stunning photos, an amazing band — means you'll make better decisions when you have to choose.",
    howToDoIt: {
      full_diy: 'Each partner independently ranks: ceremony, food, music, photos, florals, attire, venue, and the experience for guests. Compare your lists. Your top 2–3 shared priorities get the most investment.',
      mixed: 'Rank your priorities together. For DIY elements (florals, decorations, stationery), note which you genuinely want to make vs. which you\'re DIYing only for budget reasons.',
      vendor_led: "Rank your priorities together. Note which categories you want handled by professionals so you don't have to think about them on the day.",
      full_service: "Rank priorities together to guide your planner. Share these rankings at your first meeting — they'll use them to allocate your budget.",
    },
    doneDefinition: "Both partners have agreed on your top 3 wedding priorities, saved in your Bliss profile.",
    dueGuidance: '12–18 months before, alongside vision and guest count.',
    isDeliverable: true,
  },
  {
    stage: 1, sortOrder: 4,
    title: 'Decide: indoor, outdoor, or mixed',
    whyItMatters: "Indoor and outdoor venues have completely different logistics, costs, and backup planning needs. Knowing your preference lets you rule out entire categories of venues immediately.",
    howToDoIt: {
      full_diy: 'Consider what your vision calls for. Outdoor: natural light, nature backdrop, but requires weather backup and may need tent rental. Indoor: controlled environment, often all-inclusive, less flexibility. Backyard: intimate and personal, requires permit research.',
      mixed: 'Think about how much logistics you want to manage. Outdoor venues — especially backyard — require more DIY coordination. Established indoor venues handle more for you.',
      vendor_led: 'Discuss your preference honestly. Outdoor is beautiful but adds vendor coordination complexity. Indoor venues are often better if you want vendors to handle more.',
      full_service: "Share your preference with your planner early. It significantly affects venue options and overall logistics.",
    },
    doneDefinition: "You've decided whether you're looking for indoor, outdoor, or mixed venues.",
    dueGuidance: 'Decide this before you start touring venues — it will cut your search in half.',
    isDeliverable: true,
  },

  // ─── Stage 2: Venue & Date ────────────────────────────────────────────────
  {
    stage: 2, sortOrder: 1,
    title: 'Tour 3–5 venues',
    whyItMatters: "Venues book fast — especially for popular dates. Seeing 3–5 venues in person gives you a real baseline for comparison and helps you understand what you actually love vs. what looks good in photos.",
    howToDoIt: {
      full_diy: "Search for venues that fit your vibe and size. For outdoor or backyard events, also research permits, restrooms, parking, and tent requirements at this stage. Take detailed notes at each visit.",
      mixed: "Search for venues across styles: full-service (venue + catering), semi-blank (venue only), and outdoor. Compare what\'s included at each. Note which elements you might want to DIY.",
      vendor_led: "Focus on venues that include or have strong preferred vendor relationships. Ask each venue: What\'s included? Who handles day-of coordination? Can I bring my own vendors?",
      full_service: "Your planner will likely have a shortlist. If not, describe your vision and they'll filter options. Attend tours with your planner so they can ask the right questions.",
    },
    doneDefinition: "You've visited at least 3 venues and have notes on each covering: what's included, pricing, available dates, and guest capacity.",
    dueGuidance: '12–14 months before. Popular venues book 12–18 months out.',
    isDeliverable: false,
  },
  {
    stage: 2, sortOrder: 2,
    title: 'Book your venue and lock the date',
    whyItMatters: "The venue locks the date, and the date drives every other vendor booking. This is the highest-leverage decision in the entire planning process.",
    howToDoIt: {
      full_diy: 'Once you\'ve chosen a venue, review the contract carefully: what\'s included, what\'s prohibited (outside catering, decor restrictions), deposit schedule, cancellation policy. Don\'t sign anything you don\'t understand.',
      mixed: 'Compare your top 2 venues on: total cost for your guest count, flexibility on vendors, what\'s included, and gut feel from the tour. Negotiate if possible — many venues have flexibility on off-peak dates.',
      vendor_led: "Compare venues on vendor flexibility and what's included. An all-inclusive venue saves you vendor coordination. A raw venue gives you more control but requires more coordination.",
      full_service: "Your planner can help negotiate contract terms and flag any clauses that could cause problems later. Let them review before you sign.",
    },
    doneDefinition: 'Signed venue contract in hand, wedding date confirmed, deposit paid.',
    dueGuidance: 'Book as soon as you find the right venue — dates go fast.',
    isDeliverable: true,
    celebrationTrigger: 'venue_booked',
  },

  // ─── Stage 3: Core Vendors ─────────────────────────────────────────────────
  {
    stage: 3, sortOrder: 1,
    title: 'Book your photographer',
    whyItMatters: "Photos are the thing you keep forever. Your photographer's style shapes what you'll have for the rest of your lives. Book early — the best photographers fill their calendars 12–18 months out.",
    howToDoIt: {
      full_diy: "Look at full wedding galleries (not just highlight shots) to understand their real work. Review 3 photographers. Check: Do the photos look natural? Do people look comfortable? Is the lighting good indoors and out?",
      mixed: 'Review 2–3 full galleries. Consider whether you want a photojournalist (candid, storytelling) or editorial (posed, magazine-style). Meet or video call before booking — you\'ll spend most of your wedding day with them.',
      vendor_led: 'Review 2–3 full galleries and have a call with each photographer. Ask: How many photos do we get? How long until delivery? Do you have backup equipment? Have you shot at our venue before?',
      full_service: "Ask your planner for 2–3 photographer recommendations. Review galleries together and narrow to one. Your planner may be able to negotiate package details.",
    },
    doneDefinition: "Photographer booked, contract signed, deposit paid.",
    dueGuidance: '10–12 months before. The best photographers book up very quickly after a popular date is set.',
    isDeliverable: true,
    celebrationTrigger: 'photographer_booked',
  },
  {
    stage: 3, sortOrder: 2,
    title: 'Book your caterer',
    whyItMatters: "Food is one of the top things guests remember. Your caterer also affects the event flow — when food goes out, how long dinner takes, whether cocktail hour feels relaxed.",
    howToDoIt: {
      full_diy: "If your venue allows outside catering, get 2–3 quotes from caterers who've worked your venue type. Schedule tastings. Ask about: staffing ratios, what they provide (linens, plates, etc.), and what you handle.",
      mixed: "Get quotes from 2–3 caterers. Tastings are essential — never book based on menu alone. Ask what they provide vs. what you rent separately. Compare true all-in cost.",
      vendor_led: "Check if your venue has in-house catering or a preferred vendor list. In-house catering is easier but less flexible on menu. Compare at least 2 options even if one is convenient.",
      full_service: 'Work with your planner on catering. They\'ll have trusted vendors and can help ensure the caterer fits your overall event timeline and service style.',
    },
    doneDefinition: 'Caterer booked, menu direction agreed, contract signed, deposit paid.',
    dueGuidance: '10–12 months before for popular caterers, 8 months minimum.',
    isDeliverable: false,
  },
  {
    stage: 3, sortOrder: 3,
    title: 'Book your band or DJ',
    whyItMatters: "Music sets the energy for every part of the day — ceremony, cocktail hour, dinner, dancing. The difference between a great DJ or band and a mediocre one is the difference between a party and a playlist.",
    howToDoIt: {
      full_diy: "For a smaller or DIY wedding, a carefully curated Spotify playlist with a designated friend managing it can work beautifully. For dancing, a DJ is a significant upgrade. Watch live video (not highlight reels) of any performer you consider.",
      mixed: 'Decide: band or DJ. Bands create energy but cost more ($3–8K vs $1–3K). Watch live performance videos. For a DJ, get references and review their MC style — they\'ll be speaking to your guests all night.',
      vendor_led: "Get referrals from your venue or photographer. Watch live video (not just highlight clips). Ask about their process for learning your musical preferences and do-not-play list.",
      full_service: "Your planner will have recommendations. Attend a live event if possible, or at minimum watch full performance videos of their work at weddings similar to yours.",
    },
    doneDefinition: 'Band or DJ booked, contract signed, deposit paid.',
    dueGuidance: '10–12 months before — good musicians book up fast, especially on weekends.',
    isDeliverable: false,
  },
  {
    stage: 3, sortOrder: 4,
    title: 'Secure your officiant',
    whyItMatters: "Your officiant runs the ceremony — the most important 20 minutes of the day. The right person makes it personal, meaningful, and exactly right for you.",
    howToDoIt: {
      full_diy: 'A close friend or family member who gets ordained online (through Universal Life Church or similar) is a beautiful, meaningful choice. Make sure they\'re comfortable public speaking. Have them write the ceremony collaboratively with you.',
      mixed: "Consider: ordained friend (personal, free), civil officiant from the courthouse (official, minimal), or professional wedding officiant (experienced, polished). Budget $200–600 for a professional.",
      vendor_led: "Hire a professional officiant. Read reviews and meet them before booking. Ask: Do you customize your ceremonies? Have you officiated at our venue? Can we review the ceremony script together?",
      full_service: "Ask your planner for recommendations. A professional officiant typically runs $300–600 and will work with you on ceremony customization.",
    },
    doneDefinition: 'Officiant confirmed and ceremony date/time on their calendar.',
    dueGuidance: '10–12 months before, especially if using a popular professional or if a friend needs time to prepare.',
    isDeliverable: false,
  },

  // ─── Stage 4: Guests & Logistics ─────────────────────────────────────────
  {
    stage: 4, sortOrder: 1,
    title: 'Finalize your guest list with addresses',
    whyItMatters: "You need physical mailing addresses to send save-the-dates and invitations. Collecting addresses is surprisingly time-consuming — starting early saves a frantic scramble later.",
    howToDoIt: {
      full_diy: "Create a simple spreadsheet: name, mailing address, email, phone, side (your family or partner's), must-invite vs nice-to-have. Use Bliss to track RSVP status later. For addresses, text family members or use a digital address collector.",
      mixed: "Build your list in Bliss's guest manager. Start with must-invites, then add nice-to-haves. Use the address collector tool to email guests asking for their current address.",
      vendor_led: "Build your list in Bliss. Focus on getting accurate addresses — people move. A quick text or email to each family branch asking to confirm current addresses is worth it.",
      full_service: "Give your planner the list (names + relationships). They can handle address collection and will format it for your invitation printer.",
    },
    doneDefinition: "Full guest list entered in Bliss with at least mailing addresses for all must-invite guests.",
    dueGuidance: '8–9 months before — you need this complete before ordering save-the-dates.',
    isDeliverable: true,
  },
  {
    stage: 4, sortOrder: 2,
    title: 'Send save-the-dates',
    whyItMatters: "Save-the-dates give guests — especially out-of-towners — time to arrange travel and take time off work. Sending them early dramatically improves attendance.",
    howToDoIt: {
      full_diy: "Design your own using Canva (free, excellent templates). Print through Moo or Canva print. Include: your names, the date, the city, and a note that a formal invitation follows. Mail 6–9 months before the wedding.",
      mixed: "Use Canva or a stationery site (Minted, Artifact Uprising) for physical save-the-dates, or Paperless Post / Joy for digital. Digital is faster and cheaper; physical feels more special.",
      vendor_led: "Order from a stationery designer or site like Minted. Choose a design that matches your overall aesthetic — save-the-dates set expectations for the rest of the event.",
      full_service: "Your stationer or planner will handle this. Make sure they have your guest list with addresses and that you approve the design before printing.",
    },
    doneDefinition: 'Save-the-dates sent (mailed or emailed) to all must-invite guests.',
    dueGuidance: '6–8 months before the wedding. Earlier for destination or holiday weekends.',
    isDeliverable: true,
    celebrationTrigger: 'save_dates_sent',
  },
  {
    stage: 4, sortOrder: 3,
    title: 'Set up your wedding website',
    whyItMatters: "Your wedding website is where guests go for all the information they need: date, location, travel, hotel blocks, registry, RSVP. Having it up early reduces questions in your inbox.",
    howToDoIt: {
      full_diy: "Use Zola, Joy, or The Knot (all free). Build a simple one-pager: date and time, venue address (with map), travel tips, hotel block info once booked, registry links, and your RSVP form. Keep it warm and personal.",
      mixed: "Same platforms work. Add a short \"our story\" section — guests love reading about how you met. Update the site as hotel blocks and registry are finalized.",
      vendor_led: "Choose a platform that connects with your RSVP system. Zola integrates registry and RSVPs in one place. Make sure guests can RSVP directly on the site — it dramatically reduces manual tracking.",
      full_service: "Many planners have a preferred platform. Make sure it has an RSVP function and is easy for guests to navigate. Your planner can help with content.",
    },
    doneDefinition: "Wedding website is live with at minimum: date, venue address, and RSVP information.",
    dueGuidance: "Launch with your save-the-dates so the link can go on the card.",
    isDeliverable: false,
  },
  {
    stage: 4, sortOrder: 4,
    title: 'Book hotel room blocks',
    whyItMatters: "Out-of-town guests need somewhere to stay. Room blocks let you reserve a set of rooms at a negotiated rate — guests book directly and you're not on the hook if rooms go unused.",
    howToDoIt: {
      full_diy: "Call 1–2 hotels near your venue. Ask for a courtesy room block (usually 10–15 rooms). Negotiate: reduced rate, deadline for release (guests should book 3 months before), and complimentary room for you.",
      mixed: "Contact 2 hotels at different price points to accommodate guests at various budgets. Include both links on your wedding website.",
      vendor_led: "Ask your venue coordinator if they have preferred hotel partners — many do. This simplifies the process significantly.",
      full_service: "Your planner handles this. Tell them: how many out-of-town guests, any preferred hotel brands, and your budget range for guests.",
    },
    doneDefinition: "At least one hotel room block confirmed with a booking link to share with guests.",
    dueGuidance: '7–9 months before — hotels fill quickly for weekend dates.',
    isDeliverable: false,
  },

  // ─── Stage 5: Details & Design ────────────────────────────────────────────
  {
    stage: 5, sortOrder: 1,
    title: 'Finalize your florals',
    whyItMatters: "Florals set the visual tone of the entire day. Whether you're doing a few simple arrangements or a full floral design, finalizing this now gives enough time for ordering, preparation, and any DIY work.",
    howToDoIt: {
      full_diy: "Buy from a local wholesale flower market or order through Floralessence or Mayesh. Order flowers 1–2 days before. Prep space, tools, and vessels in advance. Focus on 2–3 flower varieties for a cohesive look. Practice one arrangement beforehand.",
      mixed: "Decide which elements to DIY (centerpieces, bud vases) and which to hire out (bridal bouquet, ceremony arch). Get a quote from a local florist for just the bouquet and ceremony pieces — it\'s often more affordable than you think.",
      vendor_led: "Meet with 2–3 florists. Bring your vision board. Ask for an itemized quote covering: bridal bouquet, bridesmaid bouquets, boutonnieres, ceremony florals, and reception centerpieces.",
      full_service: "Your planner will have florist relationships. Share your vision and budget. Ask to see photos from similar weddings they've done.",
    },
    doneDefinition: "Florist booked (or DIY plan confirmed), floral brief approved, deposit paid if applicable.",
    dueGuidance: '4–6 months before — popular florists book up, and DIY prep takes more time than expected.',
    isDeliverable: false,
  },
  {
    stage: 5, sortOrder: 2,
    title: 'Order your invitation suite',
    whyItMatters: "Invitations need to reach guests 6–8 weeks before the wedding — which means you need to order, receive, address, and mail them with time to spare. The process takes longer than most couples expect.",
    howToDoIt: {
      full_diy: "Design with Canva and print through Moo or Canva Print. Include: names, date, time, venue (full address), dress code, RSVP deadline, and wedding website. If using RSVP cards, include a return envelope.",
      mixed: "Design your own through Canva, or order a semi-custom design from Artifact Uprising, Basic Invite, or Minted. Budget $150–400 for 75 suites. Order 15% more than your guest count.",
      vendor_led: "Order from Minted, Zola, or a local stationer. Budget 6–8 weeks for design, printing, and delivery. Order extras for keepsakes and anyone you might have missed.",
      full_service: "Your stationer or planner will handle this. Provide final guest count + 15% buffer. Approve a proof before printing.",
    },
    doneDefinition: "Final invitation suite ordered. Mailing plan in place (who addresses, when to mail).",
    dueGuidance: '3–4 months before the wedding so invitations go out 6–8 weeks before.',
    isDeliverable: true,
  },
  {
    stage: 5, sortOrder: 3,
    title: 'Order wedding party attire',
    whyItMatters: "Wedding dresses and suits can take 3–6 months to arrive, and alterations add another 4–8 weeks. Starting now means no last-minute panic.",
    howToDoIt: {
      full_diy: "If you're making your own attire or choosing off-the-rack, you have more flexibility. Off-the-rack from BHLDN, Azazie, or Nordstrom cuts lead times significantly. Always schedule alterations — even off-the-rack dresses need them.",
      mixed: "Order the wedding dress from a bridal shop (allow 4–6 months for custom/semi-custom). For bridesmaids and groomsmen, consider Azazie or The Black Tux — they ship in 3–4 weeks.",
      vendor_led: "Visit 2–3 bridal shops. Go to the first appointment with an open mind — photos don\'t tell you how a dress feels. For groomswear, visit 2–3 menswear shops or formalwear rentals.",
      full_service: "Ask your planner for stylist recommendations. Some offer full wardrobe coordination including bridesmaids and groomswear.",
    },
    doneDefinition: "Wedding attire ordered for both partners. Alterations scheduled for 4–6 weeks before the wedding.",
    dueGuidance: '4–5 months before — this is often tighter than couples expect.',
    isDeliverable: false,
  },
  {
    stage: 5, sortOrder: 4,
    title: 'Plan your rehearsal dinner',
    whyItMatters: "The rehearsal dinner is the night-before gathering that brings families together for the first time in a low-stakes setting. It doesn\'t need to be elaborate — but it does need to be planned.",
    howToDoIt: {
      full_diy: "A backyard dinner, a private room at a favorite restaurant, or a catered home gathering all work beautifully. Keep it simple: great food, relaxed atmosphere, a few toasts. Budget $30–60 per person for catering.",
      mixed: "Book a private room at a restaurant 2–3 months before (popular spots fill quickly). Typical guest list: immediate family, wedding party, and their partners. Optionally extend to out-of-town guests.",
      vendor_led: "Call restaurants now for a private room or buyout. Tell them your count (typically 20–40 people), date, and approximate budget. Many offer set menus for private events.",
      full_service: "Your planner can handle venue search and booking. Give them a budget and preferred vibe (casual, elegant, etc.) and they'll present options.",
    },
    doneDefinition: "Rehearsal dinner venue or plan confirmed. Guest list for rehearsal dinner set.",
    dueGuidance: '3–4 months before the wedding.',
    isDeliverable: false,
  },

  // ─── Stage 6: Final Countdown ──────────────────────────────────────────────
  {
    stage: 6, sortOrder: 1,
    title: 'Submit final headcount to your caterer',
    whyItMatters: "Caterers need a final headcount to order food, staff appropriately, and set up the right number of place settings. Most caterers need this 2–3 weeks before the wedding.",
    howToDoIt: {
      full_diy: "Count your confirmed RSVPs in Bliss. Add 2–3 extra for any late responses. Contact your caterer with the final number. Confirm: dietary restrictions, service times, and when they arrive to set up.",
      mixed: "Review Bliss's RSVP tracker for final count. Confirm the number with your caterer in writing (email). Ask them to confirm back with the agreed headcount and any additions to the menu.",
      vendor_led: "Email your caterer with final count, all dietary restrictions, and confirm the day-of timeline: when they arrive, cocktail hour start, dinner service start, last call.",
      full_service: "Your planner coordinates this. Provide them with the final RSVP count from your guest management system.",
    },
    doneDefinition: "Final headcount submitted to caterer in writing. Confirmation received.",
    dueGuidance: '2–3 weeks before the wedding (confirm your caterer\'s specific deadline at booking).',
    isDeliverable: false,
  },
  {
    stage: 6, sortOrder: 2,
    title: 'Build your day-of timeline',
    whyItMatters: "A detailed timeline is what separates a smooth wedding day from a chaotic one. Every vendor needs to know exactly when to arrive and what's happening when.",
    howToDoIt: {
      full_diy: "Start from ceremony time and work backwards (hair/makeup, getting ready) and forwards (cocktail hour, dinner, first dance, etc.). Use 15-minute intervals. Build in buffer time — things always run long. Share with every vendor 1 week before.",
      mixed: "Build the timeline together with your partner. Include: getting-ready start, first look (if doing one), ceremony, cocktail hour, dinner, key moments (first dance, cake cutting, parent dances, send-off). Share with all vendors.",
      vendor_led: "Ask your photographer and caterer for their input — they have experience knowing what takes longer than expected. Incorporate their feedback before finalizing.",
      full_service: "Your planner builds this. Review it carefully — you'll know certain things (family dynamics, grandparent mobility) that they won't. Request a draft 3 weeks before the wedding.",
    },
    doneDefinition: "Day-of timeline complete with 15-minute intervals. Shared with all vendors.",
    dueGuidance: '2–3 weeks before the wedding.',
    isDeliverable: true,
  },
  {
    stage: 6, sortOrder: 3,
    title: 'Confirm all vendor arrival times',
    whyItMatters: "Vendors showing up late or to the wrong entrance is a common cause of stress on the wedding day. Confirming everyone in writing one week out prevents surprises.",
    howToDoIt: {
      full_diy: "Email every vendor with: arrival time, exact address (including any loading dock or service entrance details), parking instructions, your day-of contact\'s phone number.",
      mixed: "Send one organized email to all vendors (or individual emails). Include the full day-of timeline so everyone sees the full picture, not just their part.",
      vendor_led: "Same as above. Ask each vendor to confirm receipt and their planned arrival time in reply. Keep a running doc of confirmations.",
      full_service: "Your planner handles vendor communication. Ask them to confirm they've received acknowledgment from every vendor by one week before.",
    },
    doneDefinition: "All vendor arrival times confirmed in writing. Each vendor has the venue address, day-of contact, and timeline.",
    dueGuidance: '1 week before the wedding.',
    isDeliverable: false,
  },
  {
    stage: 6, sortOrder: 4,
    title: 'Complete your hair and makeup trial',
    whyItMatters: "A trial run lets you see exactly how your look will photograph, make adjustments, and time the morning precisely. It eliminates one major variable on the wedding day itself.",
    howToDoIt: {
      full_diy: "Practice your look at home using the same products you'll use on the day. Take photos in natural light. Time how long it takes. If using a friend, do a practice run with them.",
      mixed: "Do a trial with your hair and makeup artist 4–8 weeks before the wedding. Bring photos of what you want and what you don\'t want. Take photos in different lighting.",
      vendor_led: "Schedule a trial with your stylist 4–8 weeks before. Consider doing it on a day you have an event (engagement photos, bridal shower) so you get real-world feedback.",
      full_service: "Your planner can recommend trusted stylists. Schedule the trial well in advance — stylists' calendars fill up close to popular wedding dates.",
    },
    doneDefinition: "Hair and makeup trial completed. Look approved and any adjustments noted for the day.",
    dueGuidance: '4–8 weeks before the wedding.',
    isDeliverable: false,
  },
  {
    stage: 6, sortOrder: 5,
    title: 'Hold your rehearsal',
    whyItMatters: "The rehearsal ensures everyone knows where to stand, when to walk, and what to do. It also helps the wedding party feel calm and confident on the day itself.",
    howToDoIt: {
      full_diy: "Run through the full ceremony processional, ceremony, and recessional. Assign roles: who walks with whom, who cues the music, who hands over rings. Keep it light and fun — 30–45 minutes is enough.",
      mixed: "Run the rehearsal at the venue if possible, or at a similar space. Walk through the processional order, ceremony blocking, and recessional. Do it twice.",
      vendor_led: "Ask your officiant to lead the rehearsal — they've done this many times. Share your ceremony script with them in advance so they can guide everyone smoothly.",
      full_service: "Your planner leads the rehearsal. Brief them beforehand on any family sensitivities (divorced parents, estranged relatives) that affect positioning.",
    },
    doneDefinition: "Rehearsal completed. Everyone in the wedding party knows their role, cue, and where to stand.",
    dueGuidance: 'The evening before the wedding, usually followed by the rehearsal dinner.',
    isDeliverable: false,
  },

  // ─── Stage 7: Post-Wedding ─────────────────────────────────────────────────
  {
    stage: 7, sortOrder: 1,
    title: 'Return all rentals',
    whyItMatters: "Most rental contracts have a strict return window — usually 24–48 hours. Missing it means extra charges. Getting it done immediately also lets you start the post-wedding period without loose ends.",
    howToDoIt: {
      full_diy: "Assign a trusted family member or friend to be the rentals coordinator on the wedding day and the day after. Make a list of everything rented: suits, linens, decor, equipment. Have a vehicle ready.",
      mixed: "Make a full rental return checklist before the wedding. Assign specific people to handle specific items. Brief them before the day.",
      vendor_led: "Confirm return logistics with each rental company before the wedding. Ask them: Can you pick up on Sunday? If not, who's responsible for transport?",
      full_service: "Your planner coordinates rental returns. Confirm this is in their scope before the wedding.",
    },
    doneDefinition: "All rented items (suits, linens, decor, equipment) returned by the contracted deadline.",
    dueGuidance: 'Within 24–48 hours of the wedding. Check each rental contract.',
    isDeliverable: false,
  },
  {
    stage: 7, sortOrder: 2,
    title: 'Send thank-you notes',
    whyItMatters: "Thank-you notes are one of the most meaningful things you'll do after the wedding. Guests remember them. They close the loop on a day people genuinely showed up for you.",
    howToDoIt: {
      full_diy: "Design and print your own thank-you cards from Canva. Write personal notes — reference the specific gift or something meaningful about having them there. Aim to send within 3 months.",
      mixed: "Order thank-you cards from your stationer or Minted. Write 5–10 notes per day starting within a week of returning from your honeymoon. It's much easier in smaller batches.",
      vendor_led: "Same approach — personal notes in batches. Use Bliss's guest list to track who you've thanked. Mention something specific about each person's gift or presence.",
      full_service: "Notes are personal — no planner can write them for you. Start within 2 weeks of the wedding. Tracking in Bliss helps.",
    },
    doneDefinition: "Thank-you notes sent to all guests within 3 months of the wedding.",
    dueGuidance: 'Start within 2 weeks, complete within 3 months.',
    isDeliverable: true,
  },
  {
    stage: 7, sortOrder: 3,
    title: 'Back up your wedding photos',
    whyItMatters: "Your photographer will deliver digital files. Backing them up in multiple places immediately protects them forever. Hard drives fail. Cloud accounts get closed. Multiple backups matter.",
    howToDoIt: {
      full_diy: "When your gallery arrives: download all files immediately. Back up to at least two locations: an external hard drive plus cloud storage (Google Photos, iCloud, or Dropbox). Consider a second cloud backup.",
      mixed: "Download the gallery to your computer. Copy to an external drive. Upload to cloud storage. Share with a family member so they have copies too.",
      vendor_led: "Same as above. Many photographers also store files for 1–3 years as a courtesy backup — but don't rely on it.",
      full_service: "Your planner may remind you — but backing up photos is personal and important. Do it as soon as your gallery arrives.",
    },
    doneDefinition: "Wedding photos backed up to at least 2 separate locations (one local, one cloud).",
    dueGuidance: 'Within a week of receiving your gallery from the photographer.',
    isDeliverable: false,
  },
  {
    stage: 7, sortOrder: 4,
    title: 'Review and tip your vendors',
    whyItMatters: "Vendors work incredibly hard on your wedding day. Tips are customary (15–20% for most) and mean a great deal. Online reviews help other couples find great vendors.",
    howToDoIt: {
      full_diy: "Prepare tip envelopes before the wedding (labeled with vendor names) with cash or Venmo handles. Have someone distribute them at the end of the night. Write reviews on Google and The Knot within a week while memories are fresh.",
      mixed: "Same as above. Typical tips: photographer $100–300, caterer 15–20% (often included), DJ $50–150, officiant $50–100. Check your contracts — tips may already be built in.",
      vendor_led: "Prepare envelopes before the wedding. After the wedding, send personal thank-you emails to vendors before writing reviews. Genuine, specific reviews mean more than generic praise.",
      full_service: "Your planner can advise on tipping norms. They typically receive 15–20% of their fee as a tip if they did exceptional work.",
    },
    doneDefinition: "All vendors tipped and reviewed online.",
    dueGuidance: 'Tips: wedding day. Reviews: within 1 week while the experience is fresh.',
    isDeliverable: false,
  },
]
