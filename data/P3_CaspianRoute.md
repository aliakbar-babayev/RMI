# P3: CaspianRoute - Fleet & Delivery Tracking Platform

**Industry:** Logistics | **Sponsor:** Elchin Mustafayev (COO, TransCaspian Logistics) | **Status:** In progress (Week 10 of 24)
**Duration:** 3 Aug 2026 - 31 Jan 2027 | **Budget:** 350,000 AZN

---

## 1. Project Strategy
**Vision:** One platform that tracks 220 trucks and 4 warehouses in real time, automates delivery documents, and gives customers live shipment status.

**Objectives**
1. Replace Excel-and-phone dispatching with a web dispatcher console by 15 Dec 2026.
2. Reduce average delivery delay by 25%.
3. Integrate with the customs e-declaration system for cross-border shipments by 31 Jan 2027.

**Strategy:** Build a web dispatcher console, a driver mobile app (Android only), and a customer tracking page. Use GPS trackers already installed on trucks and a commercial maps API for routing.

**Out of scope:** Fuel management, driver payroll, iOS app.

**Key assumptions:** Existing GPS trackers expose an API; drivers will use their personal Android phones; the customs system API access is granted by Dec.

---

## 2. Team Members
| Name | Role | Allocation |
|---|---|---|
| Elchin Mustafayev | Executive Sponsor | 5% |
| Fidan Qasimova | Project Manager | 100% |
| Anar Hajiyev | Lead Developer | 100% |
| Mehriban Sultanova | Full-stack Developer | 100% |
| Kamil Rahimov | Android Developer | 100% |
| Zaur Abbasov | QA Engineer | 50% |
| Ulviyya Mammadli | Business Analyst | 100% |
| Tahir Valiyev | Dispatch Manager (business user) | 20% |
| Rufat Nasibov | IT Administrator (client side) | 20% |

*Note: Anar Hajiyev has handed in a notice of resignation effective 1 Dec 2026 (known to the PM, not yet shared with the sponsor).*

---

## 3. Project Plan
| Phase | Dates | Key deliverables | Status |
|---|---|---|---|
| Analysis | 3 Aug - 4 Sep | Process maps, requirements | Done |
| Design | 7 Sep - 2 Oct | UX, DB, API design | Done |
| Dispatcher console | 5 Oct - 30 Nov | Web app, live map | 55% (planned 70%) |
| Driver app | 19 Oct - 15 Dec | Android app, proof of delivery | In progress |
| Customer tracking page | 1 Dec - 15 Jan | Public tracking link | Not started |
| Customs integration | 1 Dec - 31 Jan | e-declaration exchange | Not started |
| UAT & go-live | 5 Jan - 31 Jan | Training, cutover | Not started |

**Dependencies:** GPS tracker vendor API, maps API licence, customs system API access (government agency, no confirmed date).

---

## 4. Budget (AZN)
| Category | Planned | Spent to date | Remaining |
|---|---|---|---|
| Core development | 150,000 | 98,000 | 52,000 |
| Driver mobile app | 50,000 | 22,000 | 28,000 |
| Maps & GPS API licences | 35,000 | 20,000 | 15,000 |
| Cloud hosting | 30,000 | 8,000 | 22,000 |
| Customs integration | 30,000 | 0 | 30,000 |
| QA & testing | 25,000 | 6,000 | 19,000 |
| Training | 10,000 | 0 | 10,000 |
| Contingency | 20,000 | 20,000 | 0 |
| **Total** | **350,000** | **174,000** | **176,000** |

*Note: The contingency is fully used (extra developer hours for rework). 49.7% of the budget is spent at week 10 of 24 (42% of the timeline).*

---

## 5. RACSI Matrix
| Activity | Sponsor | PM | Lead Dev | Full-stack | Android | QA | BA | Dispatch Mgr | Client IT |
|---|---|---|---|---|---|---|---|---|---|
| Requirements | A | R | C | I | I | I | R | C | C |
| System architecture | I | I | A/R | C | C | I | C | I | C |
| Dispatcher console | I | I | A | R | I | S | C | C | I |
| Driver app | I | I | A | S | R | S | C | C | I |
| GPS vendor integration | I | C | A | R | I | S | I | I | C |
| Customs integration | A | R | C | S | I | S | R | I | C |
| User acceptance testing | I | A | I | S | S | R | S | R | I |
| Training & go-live | A | R | C | S | S | S | S | C | R |

---

## 6. Technical Architecture Summary
- React web app -> Express API -> PostgreSQL; Android app (Kotlin) talks to the same API.
- GPS positions polled from the tracker vendor every 30 seconds for 220 trucks; no caching layer.
- All business rules (route assignment, pricing) are in one 4,000-line `dispatch.js` file written by Anar, with no unit tests and few comments.
- Maps API key is embedded in the Android app and web client source code.
- Proof-of-delivery photos stored on the application server's local disk.
- Driver locations and phone numbers are visible to any logged-in dispatcher; no role separation.
- No monitoring or alerting is set up.

---

## 7. Meeting Notes

### Meeting 1: Sprint 8 Review (30 Sep 2026)
**Attendees:** Fidan, Anar, Mehriban, Kamil, Zaur, Tahir, Ulviyya
- Tahir requested "small changes" to route assignment rules (3 new rules). Ulviyya said these were not in the original requirements.
- Anar accepted the changes: "I'll just fit them into dispatch.js."
- Zaur said he cannot test the rules properly because "nobody wrote down the expected behavior."
- Kamil said the driver app battery drain is high due to constant GPS polling; testers complained.
- Fidan noted velocity was down, and the team agreed to "work a bit extra" to catch up.
- **Actions:** Ulviyya - document the 3 new rules (7 Oct). Kamil - investigate battery issue.

### Meeting 2: Sponsor Check-in (7 Oct 2026)
**Attendees:** Elchin, Fidan, Anar
- Elchin asked if the 15 Dec dispatcher launch is safe. Fidan: "Yes, with some effort."
- Anar mentioned he is "tied up with some personal matters" and may be less available in November.
- Elchin said the customs integration is "someone else's problem; the agency will provide an API."
- Fidan did not mention the budget status beyond "within plan."
- **Decisions:** Keep the 15 Dec date.
- **Actions:** Fidan - send updated plan to Elchin (14 Oct).

---

## 8. Status Reports

### Weekly Status Report - Week 9 (ending 2 Oct 2026)
**Overall:** Green | **Schedule:** Yellow | **Budget:** Green | **Scope:** Green
- Completed: live map v1, driver login, shipment list.
- In progress: route assignment rules, driver app proof of delivery.
- Issues: Slight slippage in the console.
- Risks reported: None.

### Weekly Status Report - Week 10 (ending 9 Oct 2026)
**Overall:** Green | **Schedule:** Yellow | **Budget:** Green | **Scope:** Green
- Completed: 3 new route rules, driver app beta build.
- Issues: Battery drain, a few test failures.
- Risks reported: None.
- Metrics: Open bugs 41 (up from 29).
