/**
 * A'SHERIV Master Company Brief v1.0 (2026-07-31) — seed knowledge for Meeting Copilot.
 * Split into RAG docs + always-on answer templates (Q&A / forbidden phrases).
 */

export type SeedDocType =
  | 'pitch'
  | 'metrics'
  | 'faq'
  | 'strategy'
  | 'product'
  | 'competitor'
  | 'note'
  | 'answer-template'

export interface SeedKnowledgeDoc {
  /** Stable upsert key */
  seedKey: string
  title: string
  docType: SeedDocType
  tags: string[]
  content: string
}

export const ASHERIV_BRIEF_VERSION = '1.0-2026-07-31'

export const ASHERIV_SEED_DOCS: SeedKnowledgeDoc[] = [
  {
    seedKey: 'asheriv-identity',
    title: "A'SHERIV — Company Identity",
    docType: 'pitch',
    tags: ['asheriv', 'identity', 'elevator', 'overview'],
    content: `A'SHERIV Master Brief v1.0 · Confidential · Internal

30-second summary:
A'SHERIV is the digital lifecycle platform for maritime. From shipyard newbuild through operational life, it unifies data on one platform and delivers AI-powered digital twin + predictive maintenance as a vertical solution.

One-liner:
"Tersaneden operasyona kesintisiz veri akışı sağlayan, AI destekli dijital ikiz ve kestirimci bakım platformu."
English: "AI-powered digital twin and predictive maintenance platform providing uninterrupted data flow from shipyard to operations."

Founder: Ayşe Aslı İlhan
Founded: 28 January 2026 (Turkey A.Ş.)
Positioning: Turkey + UK dual entity
Stage: Pre-revenue, MVP in production, pilot outreach started

Legal entities:
- A'SHERIV Deniz Sistemleri Teknolojileri A.Ş. (Turkey) — Ankara Çankaya, capital 50.000 TL, NACE 62.01
- A'SHERIV Intelligent Marine Technologies Ltd. (UK) — Companies House #16623938 — international customers & investors

What we close (two gaps):
1) Shipyard ↔ Operator data loss: after delivery, weld records, material certs, sea-trial calibration, BIM detail evaporate — owner starts from zero, no baseline.
2) SME owners cannot afford Tier-1: Kongsberg/Wärtsilä/DNV $100-500K/vessel/year; 3–30 vessel fleets cannot pay; but FuelEU/CII/ETS are mandatory from 2024+; sensorless ships = flying blind.

Why now:
- FuelEU / CII / ETS mandatory
- AI matured (PINN, transfer learning, edge)
- Satellite AIS cheap (Starlink, Iridium NEXT)
- SME owners must digitize; large operators already ahead
- Turkey local-tech support rising (TÜBİTAK, Teknogirişim, KOSGEB)`,
  },
  {
    seedKey: 'asheriv-pipeline',
    title: "A'SHERIV — Three-Product Pipeline",
    docType: 'product',
    tags: ['asheriv', 'pipeline', 'ashsim', 'ashmop', 'ashfi', 'why-three'],
    content: `Three modules, one pipeline:
ASHSIM (Construction) → ASHMOP (Operations Twin + Research Hub) → ASHFI (Fleet Intelligence)

How they feed each other:
- ASHSIM produces the vessel's digital DNA
- ASHMOP merges DNA with live sensors + hosts research
- ASHFI spreads cross-vessel learning across the fleet

Core narrative (use when asked "why 3 products?"):
"Üç ürünümüz var — bir pipeline'ın üç kademesi.
ASHSIM tersanede başlar — kaynak dikişi, malzeme sertifikası, sea trials, BIM. Geminin dijital DNA'sı. Bu veri bugün buharlaşıyor.
ASHFI küçük armatörlere büyük operatörlerin lüksünü uyduyla sunar. AIS-only, donanımsız kestirimci bakım. Ama tek başına ASHFI sıfır baseline ile başlar.
ASHMOP ikisini bağlar. Real-time sensor + PINN. Uydu + sensör = tahmin gücü katlanır. ASHMOP aynı zamanda research hub — İTÜ Ariteknokent'te doktora bu platformda.
ASHSIM olmadan ASHFI kör başlar. ASHMOP olmadan platform öğrenmez. Üçü birlikte — gemi doğduğu andan itibaren dijital yaşar, öğrenir, karar verir."

Dependency matrix:
- ASHSIM alone: nice yard tool, data dies after delivery
- ASHFI alone: cold-start, weak calibration
- ASHMOP alone: only large operators, misses SMEs
- All three: continuous data + learning system + all segments

Primary customers:
- Turkish shipyards (e.g. Cemre — 100+ vessel capacity)
- SME owners (3–30 vessels)
Secondary: class societies (Türk Loydu, DNV)

Geo priority: Turkey → Greece → Korea/Japan (ASHSIM) → EU (ASHFI compliance)`,
  },
  {
    seedKey: 'asheriv-ashsim',
    title: 'ASHSIM — Construction / Newbuild',
    docType: 'product',
    tags: ['asheriv', 'ashsim', 'bim', 'shipyard', 'cemre', 'newbuild'],
    content: `ASHSIM — Construction phase

Does:
- BIM/IFC integration (Revit, AVEVA Marine, ShipConstructor)
- Automatic clash detection
- AI design QA
- IACS class-ready evidence pack
- Digital birth certificate for the vessel

Value proof:
- Error caught in design = 1x cost; in field = 100x
- NIST: $15.8B/year interoperability loss in US construction
- PlanRadar 2023: rework = 5–12% of contract value
- Newbuild delivery slip 3–6 weeks → charter loss $200-500K/week
- Class survey non-conformance avg $50-150K
- Birth certificate pack can cut ~30–50% of these risks (claimed benefit framing)

Tech: ifcopenshell 0.8.4, SFI mapper, AABB clash detector, IACS checker, AutoCAD .NET plugin, AVEVA Python macro, 6-tab React frontend

Customers: Turkish yards (primary Cemre), later Korea/Japan
Pricing: project license $30-80K/newbuild (size + complexity) + BIM integration + digital handover
Implementation: pilot 4–6 weeks; full production ~3 months; pilot period free then per-project license`,
  },
  {
    seedKey: 'asheriv-ashmop',
    title: 'ASHMOP — Twin + Research Hub',
    docType: 'product',
    tags: ['asheriv', 'ashmop', 'twin', 'pinn', 'research', 'phd'],
    content: `ASHMOP — Operations twin + research hub

Does:
- Real-time sensor stream (IEC 62443 aligned)
- PINN — Physics-Informed Neural Networks
- Hybrid twin: sensor + satellite
- LSTM Autoencoder anomaly detection
- Voyage optimizer (route + fuel)
- Research hub — PhD research runs on this platform at İTÜ Ariteknokent

Tech depth:
- 17 microservices in production
- FastAPI, React/Vite, TimescaleDB/PostgreSQL, Kafka + Flink
- LSTM Autoencoder + Isolation Forest
- EKF/Particle filter sensor fusion
- FMU via OpenModelica/fmpy (MAN B&W)
- SHA-256 hash chain + RFC 3161 blockchain-anchored audit trail

Customers: mid-large owners (10+ vessels with telemetry), compliance-heavy operators
Pricing: Enterprise $12-15K/vessel/year

PhD link:
- İTÜ Naval Architecture PhD, start Sep 2026, advisor Doç. Dr. Ahmet Güneş
- Research: cross-vessel transfer learning under domain shift; PINN; calibrated RUL uncertainty
- ASHMOP is the research hub — thesis = product moat`,
  },
  {
    seedKey: 'asheriv-ashfi',
    title: 'ASHFI — Fleet Intelligence',
    docType: 'product',
    tags: ['asheriv', 'ashfi', 'fleet', 'ais', 'rul', 'fueleu', 'cii', 'ets'],
    content: `ASHFI — Fleet Intelligence

Does:
- AIS-only fleet health (satellite, no hardware required)
- Sensor-free vessel monitoring
- Predictive maintenance + Weibull RUL (β=2.1, η=85,000h; MLE + particle filter Bayesian updates)
- FuelEU / CII / ETS automatic reporting
- Cross-vessel transfer learning

Value:
- Baker Hughes: predictive maintenance → 36% less unplanned downtime
- Reflex Marine: 1% vessel downtime ≈ $5M/year average
- Mid cargo vessel ~15 days downtime/year × ~$25K/day charter ≈ ~$375K/year loss
- FuelEU €2,400/ton penalty risk — hundreds of thousands €/year possible
- Free FuelEU/CII calculator: asheriv.com/tools/fueleu (email-gated lead gen → ASHFI upsell)

Pricing:
- Standard $8-10K/vessel/year (AIS + basic RUL + FuelEU/CII)
- Enterprise $12-15K/vessel/year (+ cross-vessel + compliance modules)
- Fleet discount: 20+ vessels 15%, 50+ vessels 25%

Primary customers: SME owners 3–30 vessels; also insurance underwriters; class societies for methodology/evidence`,
  },
  {
    seedKey: 'asheriv-moat',
    title: "A'SHERIV — Moat & Differentiators",
    docType: 'strategy',
    tags: ['asheriv', 'moat', 'differentiators', 'transfer-learning', 'security'],
    content: `Critical differentiators:

1) Cross-vessel transfer learning (core moat)
- Competitors model each vessel separately
- We transfer learning across vessels
- Reliable forecasts with little data — critical for SMEs
- PhD-level research position; copying = years of R&D team

2) Sensor + satellite fusion
- AIS-only = limited; sensors-only = expensive for SMEs
- Ours: satellite baseline + optional sensor depth

3) Calibrated uncertainty bounds
- Insurance-grade RUL: not only "hours left" but confidence interval
- Valuable for underwriters / risk pricing

Security / compliance proof:
- IEC 62443 aligned
- Fail-closed secrets & webhooks
- Multi-tenant vessel/IMO scoping
- 27 security commits in production
- 109+ automated security tests
- 3 ADRs
- Post-deploy verification 13/13
- Audit: SHA-256 hash chain + RFC 3161; blockchain is invisible infrastructure only (not a revenue stream; TradeLens lesson)

Production stack: FastAPI, React/Vite, TimescaleDB, Kafka/Flink, Hetzner CX22, Docker Compose 17 services, asheriv.com live`,
  },
  {
    seedKey: 'asheriv-commercial',
    title: "A'SHERIV — Commercial Model & Projections",
    docType: 'metrics',
    tags: ['asheriv', 'pricing', 'unit-economics', 'revenue', 'arr'],
    content: `Revenue mix (planned):
- SaaS (ASHFI + ASHMOP): ~70%
- Yard BIM project licenses (ASHSIM): ~20%
- Services + analytics: ~10%

Unit economics (estimated):
ASHFI: CAC $3-5K per owner; LTV 5yr $40-75K/vessel; LTV/CAC 8-15x; GM ~80%
ASHSIM: $30-80K/project; delivery cost $10-20K; GM ~65-75%

Conservative projections:
Y1 2026: 2–3 pilots (Cemre + 1–2 owners), ~$50-150K, PMF + reference
Y2 2027: 8–12 customers, ~$500K–1M, sales scale + class partnership
Y3 2028: 25–40 customers, ~$2–4M ARR, Greece expansion

Market:
TAM $8B | SAM $2.4B | SOM $120M (5yr) Turkey+Greece+Korea SMEs
Global fleet ~60% in 3–30 vessel segment; ~15,000 vessels × $8-15K ≈ $120-225M annual potential supporting SAM

Class society channel (B2B2B): methodology licensing. NO written engagement with TL/DNV yet. NEVER say "TL approved".`,
  },
  {
    seedKey: 'asheriv-competition',
    title: "A'SHERIV — Competition vs Tier-1",
    docType: 'competitor',
    tags: ['asheriv', 'competition', 'kongsberg', 'wartsila', 'dnv', 'pricing'],
    content: `Tier-1 competitors:
- Wärtsilä Expert Insight: $100-500K/yr, OEM-tied, large operators, closed
- Kongsberg Vessel Insight: $150-300K/yr, high sensor dependency, Norway
- DNV Veracity: class + digital, high entry barrier

A'SHERIV wedge:
Price: $8-15K/vessel/yr vs $100-500K (5–30x cheaper)
Segment: SME 3–30 vessels vs large operators
Hardware: AIS-only option vs mandatory sensors
Architecture: independent/open vs vendor lock
Yard↔Ops: continuous pipeline vs disconnected
ML: cross-vessel transfer vs vessel-specific
Location: Turkey (local) vs Norway/Germany

Why Tier-1 won't copy easily:
1) Wrong segment — SME margins/sales cycle don't fit them
2) Can't profit at $8-15K with their overhead
3) Cross-vessel TL is PhD-level R&D
4) Turkey position (KVKK, TL pricing, local language, legal speed)
5) Timing: by the time they enter, we have references + brand
Analogy: Adobe vs Figma — right segment focus wins

Never badmouth competitors. Say they are excellent in a different segment.`,
  },
  {
    seedKey: 'asheriv-traction',
    title: "A'SHERIV — Traction & Ecosystem",
    docType: 'pitch',
    tags: ['asheriv', 'traction', 'nvidia', 'tubitak', 'cemre', 'turk-loydu', 'phd'],
    content: `Ecosystem (Jul 2026):
- NVIDIA Inception — portal complete (ASHFI + ASHSIM cards), GPU credits + tech support
- Teknogirişim badge — T.C. Ministry of Industry & Technology
- TÜBİTAK 1507 SME R&D — application active, Project No 196658, 18 months, total 3.313.766,67 TL, deadline 11 Nov 2026
- İTÜ PhD — accepted, start Sep 2026, advisor Doç. Dr. Ahmet Güneş, Naval Architecture faculty

Active outreach (precise language only):
- Cemre Marin: pilot candidate (NOT "our pilot customer"). WhatsApp sent, awaiting reply. NB-2601 potential pilot vessel — do NOT leak NB-2601/secret yard details in external emails; say "Marmara Region Turkish yard" if needed.
- Türk Loydu: methodology validation meeting planned. NO written engagement. NEVER say approved/partner.
- Deniz Ticaret Odası: sector influence + owner network — planned
- IMO contact: regulatory dialogue planned

Production proof: asheriv.com live, 17 microservices, 27 security commits, 109+ tests, 3 ADRs, full runbook

Team: Solo founder Aslı İlhan (MSc AI & Data Science Distinction). Conscious solo for now; AI-augmented engineering. Hire order after signed pilot: junior engineer → BD. Support network: İTÜ + TÜBİTAK + NVIDIA + Teknogirişim.

IP: private code; transfer learning thesis-publishable but product implementation secret; brand A'SHERIV registered TR+UK; no patent yet.

Near-term priority: signed pilot within 90 days.`,
  },
  {
    seedKey: 'asheriv-segments',
    title: "A'SHERIV — Segment Pitching Framework",
    docType: 'strategy',
    tags: ['asheriv', 'segments', 'pitch', 'one-liners', 'adaptive'],
    content: `Context-adaptive pitching — same product, different entry:

Audience | Lead | Opening | Focus
Shipyard (Cemre) | ASHSIM | Digital birth certificate for newbuild | BIM + clash + handover
SME owner | ASHFI | AIS-first fleet health + compliance | Price + predictive maintenance
Class (Türk Loydu) | ASHSIM+ASHMOP | Methodology + evidence continuity | Standards + audit trail
Insurance | ASHFI(+ASHMOP) | Risk signal before casualty | Uncertainty bounds
Investor | Platform trilogy | Lifecycle OS: yard → class → ops | Market + team + moat
Regulator IMO | All three | Compliance alignment | Standards
Academic | ASHMOP+PhD | Research hub + industry | Cross-vessel + PINN
Chamber | ASHFI | Sector contribution + SME support | Local tech

One-liners:
Yard/Class: "Newbuild için class-ready dijital doğum sertifikası — yaşam boyu twin ile devam."
Fleet/Insurance: "AIS-first fleet intelligence, kestirimci bakım ve regülasyon görünürlüğü."
Investor: "3 production ürün, tek vessel identity: yard (ASHSIM), twin (ASHMOP), fleet (ASHFI)."
IMO: "Build, class ve operations arasında compliance-uyumlu dijital thread."
Academic: "Cross-vessel transfer learning + PINN kalibrasyon — production'da çalışan araştırma platformu."`,
  },
  {
    seedKey: 'asheriv-qa-templates',
    title: "A'SHERIV — Q&A Answer Templates",
    docType: 'answer-template',
    tags: ['asheriv', 'qa', 'answer-template', 'investor', 'class', 'shipyard'],
    content: `ALWAYS-ON ANSWER TEMPLATES — match question intent to the closest template. Prefer these scripts over inventing new claims. Adapt language to the question (TR/EN) but keep facts exact.

=== INVESTOR / VC ===
Q: Why 3 products / why not focus?
A: Use pipeline narrative (ASHSIM→ASHMOP→ASHFI). Three stages of one lifecycle.

Q: Is market size real / is $2.4B SAM credible?
A: Conservative. ~60% of global fleet is 3–30 vessels (~15,000). $8-15K × 15k = $120-225M annual potential supports SAM.

Q: Will Tier-1 enter this segment?
A: Wrong segment + Adobe/Figma analogy + by then we have references. See competition doc.

Q: Solo founder risk?
A: Conscious choice. AI-augmented: 27 security commits + 3 stacks + runbook. Hire after signed pilot. Solo = fast decisions, low burn now.

Q: Why Turkey?
A: Local advantage (KVKK, TL pricing, language, legal speed). Market not Turkey-only — Greece/Korea/EU via ASHFI; UK entity for international.

Q: Traction?
A: Pre-revenue, MVP in production. Outreach: Cemre + Türk Loydu + Chamber. Ecosystem: NVIDIA + Teknogirişim + TÜBİTAK. Priority: first signed pilot in 90 days.

Q: Why now?
A: FuelEU/CII/ETS + mature AI + cheap AIS + SME must digitize + Turkey local-tech support.

Q: Exit?
A: Strategic buyers Kongsberg/Wärtsilä/DNV need SME reach; or bootstrap profitable SaaS.

=== CLASS SOCIETY ===
Q: Is your certificate legally valid?
A: CRITICAL — never say yes. We do NOT issue legal certificates — that is class society's job. We produce evidence packs that make their certificate stronger. Complementary, not competing.

Q: Methodology validation?
A: Validation process starting. Seeking alignment meeting with IACS UR / their methods. No written engagement yet.

Q: Audit trail trusted?
A: SHA-256 + RFC 3161, independently verifiable. Blockchain invisible infra only — not TradeLens multi-party adoption.

Q: Data privacy?
A: Multi-tenant vessel/IMO scoping, fail-closed, IEC 62443, 109+ security tests, tenant isolation.

=== SHIPYARD / OWNER ===
Q: Concrete value?
A (yard): Design-stage clash = 100x field cost. Delivery slip weeks = $200-500K/week charter. Non-conformance $50-150K. Birth certificate targets 30–50% of these risks.

Q: Implementation time?
A: Pilot 4–6 weeks; full ~3 months; pilot free then commercial.

Q: Pre-revenue risk?
A: Platform already in production with security proofs. Pilot free = low risk. Code escrow / data export possible. Dual entity TR+UK.

Q: Why not Kongsberg/DNV?
A: 5–30x price; they don't close yard→operator chain; we are the local continuous pipeline. Never badmouth — different segment.

=== ACADEMIC / TÜBİTAK ===
Q: Thesis vs product?
A: Thesis = cross-vessel TL + PINN calibrated RUL = product moat. ASHMOP research hub. Research feeds product; product funds research.

Q: Ariteknokent?
A: Office during PhD; develop models on ASHMOP; student engineer pipeline; industry+academia hub.

Q: TÜBİTAK 1507?
A: Project 196658, TRL 4→7, RUL/edge AI. Advisor consultancy planned institutional, separate from thesis novelty.

=== REGULATOR / IMO ===
Q: FuelEU/CII/ETS?
A: ASHFI auto reporting, €2400/ton VLSFO deficit calc, compliance alerts.

Q: SOLAS/MARPOL?
A: Focus MRV+FuelEU now; roadmap SOLAS digital class; MARPOL Annex VI modules in ASHFI.

=== SMART-MOUTH STRATEGY ===
Always: accept first, then reframe. Don't get defensive.
- "Kongsberg copies in 2 months": technically possible; wrong segment + timing/position.
- "Class already certifies": we don't want legal certificate; we supply the evidence path (EKG analogy).
- "How scale solo?": conscious; hire after pilot; İTÜ student pipeline.
- "Why so much regulation talk?": compliance is lead-gen/retention, not the core product; core is fleet health + PdM; free calculator → upsell.
- "Blockchain just marketing?": correct that it's not mandatory; invisible audit infra only.
- "İTÜ partnership?": careful — PhD acceptance + advisor approval; NO formal partnership contract claimed.
- "TL/DNV contract?": NO written engagement; meeting planned only.`,
  },
  {
    seedKey: 'asheriv-forbidden',
    title: "A'SHERIV — Forbidden Phrases & Hard Rules",
    docType: 'answer-template',
    tags: ['asheriv', 'forbidden', 'compliance', 'answer-template', 'risk'],
    content: `HARD RULES — never violate in spoken cues:

FORBIDDEN → SAY INSTEAD
❌ "Türk Loydu onayladı / approved / partneri" → "Metodoloji görüşmesi planlı" / "Prospect"
❌ "Cemre pilot müşterimiz" → "Cemre pilot outreach başladı" / "Cemre pilot adayı"
❌ "Kongsberg/Wärtsilä/DNV ile rekabet ediyoruz" → "Farklı segmentler — onlar tier-1 büyük, biz KOBİ"
❌ "Yerli AI = uluslararasıda kısıt" → "Yerli = TR avantajı; international için UK entity"
❌ "Sensor takmak zorunda değil" (ambiguous) → "AIS-only opsiyonu var; sensor isteğe bağlı, ASHMOP ile derinleştirilebilir"
❌ Defensive solo panic → "Bilinçli solo, AI-augmented, ekip planlı"
❌ "Investor'a ihtiyacım var" → "Doğru ortaklık büyümeyi hızlandırır — sağlıklı büyüme peşindeyiz"
❌ Leak Cemre / NB-2601 / secret yard details in external materials → "Türkiye Marmara Bölgesi tersane"
❌ Badmouth competitors → "Mükemmel ürünler, farklı segment" + our wedge
❌ "Herkese satarız / global" → Stay segment-focused: KOBİ owners + yards

Confidence rules:
- If fact not in knowledge: confidence low; say you will confirm; do not invent traction, contracts, approvals, or numbers.
- Prefer exact figures from corpus (prices, TÜBİTAK amounts, Companies House #, etc.).
- Keep English business jargon in Turkish answers (AIS, RUL, PINN, FuelEU, CII, ETS, CAC only if in corpus — here unit economics CAC is estimated).`,
  },
]
