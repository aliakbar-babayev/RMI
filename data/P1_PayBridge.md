# P1: PayBridge - Mobile Wallet & P2P Payments

**Industry:** Fintech | **Sponsor:** Kamran Aliyev (CFO, Caspian FinServe) | **Status:** In progress (Week 6 of 26)
**Duration:** 1 Sep 2026 - 28 Feb 2027 | **Budget:** 480,000 AZN

---

## 1. Project Strategy
**Vision:** A mobile wallet that lets Azerbaijani users pay merchants, split bills, and send P2P transfers using QR codes and phone numbers.

**Objectives**
1. Launch MVP (wallet top-up, P2P transfer, QR merchant payment) by 15 Feb 2027.
2. Onboard 20,000 verified users within 3 months of launch.
3. Pass the central bank's e-money security review before launch.

**Strategy:** Build on a microservices backend, use a third-party KYC provider, and outsource card top-up to a licensed payment processor. Release in two phases (closed beta in Jan, public in Feb).

**Out of scope (v1):** International transfers, crypto, credit features.

**Key assumptions:** KYC provider API is ready by Oct 2026; the processor sandbox is available in week 3; the regulator accepts the existing compliance document set.

---

## 2. Team Members
| Name | Role | Allocation |
|---|---|---|
| Kamran Aliyev | Executive Sponsor | 5% |
| Leyla Mammadova | Project Manager | 100% |
| Rashad Huseynov | Tech Lead / Backend Architect | 100% |
| Nigar Hasanova | Backend Developer (payments) | 100% |
| Tural Guliyev | Mobile Developer (Flutter) | 100% |
| Aysel Karimova | UI/UX Designer | 50% |
| Elvin Safarov | QA Engineer | 100% |
| Sabina Ismayilova | Security & Compliance Officer | 40% |
| Orkhan Bagirov | DevOps Engineer | 60% (shared with 2 other projects) |

---

## 3. Project Plan
| Phase | Dates | Key deliverables | Status |
|---|---|---|---|
| Initiation & requirements | 1 Sep - 21 Sep | Requirements doc, architecture draft | Done |
| Design | 15 Sep - 15 Oct | UX flows, API spec, DB schema | 80% |
| Core development | 5 Oct - 15 Dec | Wallet, ledger, P2P, KYC integration | In progress |
| Merchant & QR module | 1 Dec - 10 Jan | QR payment, merchant dashboard | Not started |
| Testing & security review | 5 Jan - 5 Feb | Pen test, load test, UAT | Not started |
| Closed beta | 10 Jan - 31 Jan | 500 beta users | Not started |
| Launch | 15 Feb | Public release | Not started |

**Dependencies:** KYC provider API (external), payment processor sandbox (external), regulator review slot (external, booked for 6 Feb).

---

## 4. Budget (AZN)
| Category | Planned | Spent to date | Remaining |
|---|---|---|---|
| Development | 210,000 | 52,000 | 158,000 |
| Infrastructure & cloud | 60,000 | 9,500 | 50,500 |
| Security & compliance (pen test, audit) | 45,000 | 0 | 45,000 |
| Third-party licences (KYC, SMS, processor) | 38,000 | 14,000 | 24,000 |
| UI/UX design | 30,000 | 18,000 | 12,000 |
| QA & testing | 35,000 | 3,000 | 32,000 |
| Marketing & launch | 32,000 | 0 | 32,000 |
| Contingency | 30,000 | 11,500 | 18,500 |
| **Total** | **480,000** | **108,000** | **372,000** |

*Note: Contingency is already 38% used at week 6.*

---

## 5. RACSI Matrix
R = Responsible, A = Accountable, C = Consulted, S = Supportive, I = Informed

| Activity | Sponsor | PM | Tech Lead | Backend Dev | Mobile Dev | QA | Security | DevOps |
|---|---|---|---|---|---|---|---|---|
| Requirements sign-off | A | R | C | C | C | I | C | I |
| Architecture design | I | C | A/R | S | S | I | C | S |
| Ledger & payment service | I | I | A | R | I | S | C | S |
| Mobile app development | I | I | A | S | R | S | C | I |
| KYC integration | I | C | A | R | S | S | C | I |
| Security testing | I | C | C | S | S | S | A/R | S |
| Deployment & CI/CD | I | I | A | S | S | S | C | R |
| Regulator submission | A | R | C | I | I | I | R | I |
| Budget control | A | R | I | I | I | I | I | I |

---

## 6. Technical Architecture Summary
- Flutter mobile app -> API Gateway (Node.js) -> microservices (auth, wallet, ledger, notification) -> PostgreSQL.
- Ledger service is written and maintained by a single developer (Nigar).
- Auth uses JWT with a 30-day token lifetime; no refresh-token rotation yet.
- Admin panel is protected by one shared admin account used by the whole team during development.
- Staging and production share the same cloud account; secrets are stored in a `.env` file in the repository.
- Daily database backups are planned but not yet configured.
- Transfer limits are validated only on the mobile client in the current build.

---

## 7. Meeting Notes

### Meeting 1: Sprint 3 Planning (24 Sep 2026)
**Attendees:** Leyla, Rashad, Nigar, Tural, Elvin, Orkhan
- Rashad: ledger service is on track, but "only Nigar really understands the reconciliation logic right now."
- Tural asked for the final API spec; Rashad said the spec "will be finished next week, probably."
- Orkhan said he is splitting time across three projects and can only set up CI/CD "when there is a free slot."
- Elvin raised that no test environment exists yet, so he is testing on developers' laptops.
- Leyla asked about the KYC provider; Rashad: "They promised the API by mid-October, no written commitment."
- **Decisions:** Keep the Oct 5 start for core dev. Leyla to chase the KYC provider in writing.
- **Actions:** Rashad - finalize API spec (2 Oct). Orkhan - propose a CI/CD plan (30 Sep). Leyla - contact KYC provider.

### Meeting 2: Steering Committee (6 Oct 2026)
**Attendees:** Kamran, Leyla, Rashad, Sabina
- Kamran pushed to add a "cashback" feature to the MVP because a competitor announced one. Rashad said it is "doable but will squeeze the schedule." Kamran: "Let's include it, we can't launch without it."
- Sabina reminded the group that the regulator needs the security architecture document 4 weeks before the review; it is not started.
- Leyla reported the budget is on track; Kamran asked to "avoid touching the contingency."
- Rashad mentioned that the processor's sandbox has been unstable and top-up tests failed twice.
- **Decisions:** Cashback added to MVP scope, no change to deadline or budget.
- **Actions:** Sabina - start the security document (13 Oct). Rashad - estimate cashback effort (9 Oct).

---

## 8. Status Reports

### Weekly Status Report - Week 5 (ending 2 Oct 2026)
**Overall:** Green | **Schedule:** Green | **Budget:** Green | **Scope:** Green
- Completed: UX flows approved, DB schema v1, wallet service skeleton.
- Planned next week: API spec finalization, KYC integration start.
- Issues: None reported.
- Risks reported: None.

### Weekly Status Report - Week 6 (ending 9 Oct 2026)
**Overall:** Green | **Schedule:** Yellow | **Budget:** Green | **Scope:** Yellow
- Completed: wallet top-up (sandbox), P2P transfer prototype.
- In progress: API spec (delayed 1 week), cashback estimate.
- Issues: Processor sandbox instability, no test environment.
- Risks reported: "Minor delay in API spec."
- Metrics: Velocity dropped from 32 to 24 story points.
