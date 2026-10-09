# P2: GridSense - Smart Meter Monitoring Platform

**Industry:** Energy / IoT | **Sponsor:** Farid Jafarov (Deputy Director, Absheron Regional Power Distribution) | **Status:** In progress (Week 3 of 36)
**Duration:** 1 Oct 2026 - 30 Jun 2027 | **Budget:** 720,000 AZN

---

## 1. Project Strategy
**Vision:** Real-time monitoring of electricity consumption and faults across 15,000 smart meters, with automatic outage detection and anomaly (theft) alerts.

**Objectives**
1. Install and connect 15,000 meters in 3 districts by 31 May 2027.
2. Detect outages within 2 minutes of occurrence.
3. Reduce non-technical losses (suspected theft) by 12% in the pilot districts within 6 months.

**Strategy:** Phased rollout (District A pilot with 1,500 meters, then B and C). Use LoRaWAN gateways, MQTT ingestion, and a time-series database. Hardware is procured from a single overseas supplier to reduce unit cost.

**Out of scope:** Billing system replacement, consumer mobile app.

**Key assumptions:** Hardware arrives within 10 weeks of order; field crews can install 60 meters/day; the utility's existing billing system exposes an API.

---

## 2. Team Members
| Name | Role | Allocation |
|---|---|---|
| Farid Jafarov | Executive Sponsor | 5% |
| Gunel Rzayeva | Project Manager | 100% |
| Vusal Mehdiyev | Solution Architect | 100% |
| Ismayil Abdullayev | IoT/Embedded Engineer | 100% |
| Narmin Aliyeva | Backend Developer | 100% |
| Cavid Orujov | Frontend Developer | 100% |
| Samir Najafov | Field Operations Lead | 80% |
| Ramil Valiyev | Data Engineer | 50% |
| Lala Bayramova | Procurement Specialist | 30% |
| Murad Aslanov | Cybersecurity Consultant | 20% (external) |

---

## 3. Project Plan
| Phase | Dates | Key deliverables | Status |
|---|---|---|---|
| Initiation & survey | 1 Oct - 30 Oct | Site survey, requirements | In progress |
| Procurement | 15 Oct - 15 Jan | Meter & gateway order, delivery | In progress |
| Platform development | 1 Nov - 15 Mar | Ingestion pipeline, dashboard, alerts | Not started |
| Pilot (District A) | 15 Jan - 30 Mar | 1,500 meters live | Not started |
| Rollout (Districts B & C) | 1 Apr - 31 May | 13,500 meters | Not started |
| Optimization & handover | 1 Jun - 30 Jun | Training, documentation | Not started |

**Dependencies:** Hardware delivery (external), billing system API (internal IT, no owner assigned), field crew availability.

---

## 4. Budget (AZN)
| Category | Planned | Spent to date | Remaining |
|---|---|---|---|
| Hardware (meters, gateways) | 280,000 | 56,000 (20% deposit) | 224,000 |
| Software development | 190,000 | 24,000 | 166,000 |
| Cloud & telemetry infrastructure | 70,000 | 2,000 | 68,000 |
| Installation field work | 80,000 | 0 | 80,000 |
| Security & penetration testing | 40,000 | 0 | 40,000 |
| Training | 20,000 | 0 | 20,000 |
| Contingency | 40,000 | 0 | 40,000 |
| **Total** | **720,000** | **82,000** | **638,000** |

*Note: Hardware prices are quoted in USD; the budget is in AZN with no currency buffer.*

---

## 5. RACSI Matrix
| Activity | Sponsor | PM | Architect | IoT Eng | Backend | Field Lead | Procurement | Security |
|---|---|---|---|---|---|---|---|---|
| Requirements & site survey | A | R | C | C | I | R | I | I |
| Hardware selection | I | A | C | R | I | C | R | C |
| Procurement & delivery | I | A | I | C | I | C | R | I |
| Ingestion pipeline | I | I | A | C | R | I | I | C |
| Device firmware & provisioning | I | I | A | R | S | C | I | C |
| Field installation | I | A | I | C | I | R | I | I |
| Security testing | I | C | C | S | S | I | I | A/R |
| Billing system integration | A | R | C | I | R | I | I | I |
| Training & handover | I | A | C | S | S | R | I | I |

---

## 6. Technical Architecture Summary
- Meters -> LoRaWAN gateways -> MQTT broker -> ingestion service -> TimescaleDB -> React dashboard.
- Meter firmware updates over the air (OTA) are planned but the signing mechanism is not yet designed.
- MQTT broker is configured with anonymous access during the prototype phase; TLS is "to be added later."
- One gateway per 800 meters; no redundancy planned for gateways.
- Single MQTT broker instance with no clustering.
- Alerts (outage, anomaly) are sent only by email.
- Meter data includes household consumption patterns; no data retention or privacy policy has been defined.

---

## 7. Meeting Notes

### Meeting 1: Kick-off (2 Oct 2026)
**Attendees:** Farid, Gunel, Vusal, Ismayil, Samir, Lala
- Farid stressed that the pilot must be running by March "because the minister will visit."
- Lala said the supplier needs a 20% deposit and quoted 10-12 weeks delivery. No penalty clause for late delivery was agreed.
- Samir warned that winter weather in January may slow field installation; "we haven't planned for that."
- Vusal said the billing API is not documented and "nobody in IT has said they own it."
- **Decisions:** Order hardware from the single approved supplier.
- **Actions:** Lala - place the order (9 Oct). Gunel - find a billing system owner (16 Oct).

### Meeting 2: Architecture Review (8 Oct 2026)
**Attendees:** Gunel, Vusal, Ismayil, Narmin, Murad
- Murad asked about meter authentication and OTA signing; Ismayil said "we'll look at it after the pilot."
- Narmin raised that the MQTT broker can handle about 5,000 devices, not 15,000, based on her tests.
- Vusal suggested clustering the broker; Gunel said it "can wait until the budget is clearer."
- Ramil is only available half-time and the data model is still open.
- **Decisions:** Continue with the current architecture for the pilot.
- **Actions:** Murad - provide a security checklist (15 Oct). Narmin - run a load test (22 Oct).

---

## 8. Status Reports

### Weekly Status Report - Week 2 (ending 9 Oct 2026)
**Overall:** Green | **Schedule:** Green | **Budget:** Green | **Scope:** Green
- Completed: kick-off, site survey for District A (60%), hardware order placed.
- Planned: finish survey, begin ingestion prototype.
- Issues: None.
- Risks reported: None.

### Weekly Status Report - Week 3 (preview, draft)
**Overall:** Green | **Schedule:** Green | **Budget:** Green
- Prototype ingestion running with 50 simulated devices.
- Billing owner still unassigned.
- Supplier confirmed 12-week delivery (revised from 10-12).
