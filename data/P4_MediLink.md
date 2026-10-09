# P4: MediLink - Telemedicine & Patient Portal

**Industry:** Healthcare | **Sponsor:** Dr. Aygun Hasanli (Medical Director, Nur Clinic Group) | **Status:** In progress (Week 6 of 28)
**Duration:** 1 Sep 2026 - 31 Mar 2027 | **Budget:** 560,000 AZN

---

## 1. Project Strategy
**Vision:** Let patients of a 6-clinic network book appointments, hold video consultations, view lab results, and receive e-prescriptions from their phone.

**Objectives**
1. Launch video consultations for 3 specialties (therapy, pediatrics, cardiology) by 1 Feb 2027.
2. Integrate with the clinics' existing EHR system to show lab results and visit history.
3. Reach 8,000 registered patients in the first 3 months after launch.

**Strategy:** Build a web portal and a mobile app on top of a managed video SDK; integrate with the EHR through its HL7/REST gateway; use a cloud provider with a regional data centre.

**Out of scope:** Insurance claims, payment of medical bills (phase 2), wearable device integration.

**Key assumptions:** The EHR vendor provides API documentation and a test environment by week 4; doctors will adopt telemedicine; patient data may be hosted in the cloud under the legal basis of consent.

---

## 2. Team Members
| Name | Role | Allocation |
|---|---|---|
| Dr. Aygun Hasanli | Executive Sponsor | 10% |
| Togrul Ahmadov | Project Manager | 100% |
| Sevinj Amirova | Solution Architect | 100% |
| Murad Jabbarov | Backend Developer | 100% |
| Kenan Ibrahimov | Frontend/Mobile Developer | 100% |
| Aytan Mirzayeva | UX Designer | 60% |
| Rovshan Isgandarov | QA Engineer | 100% |
| Nurlana Huseynli | Data Protection / Legal Advisor | 20% |
| Elnur Taghiyev | EHR Vendor Liaison (external) | 20% |
| Dr. Vugar Salimov | Clinical Lead (doctor representative) | 15% |

---

## 3. Project Plan
| Phase | Dates | Key deliverables | Status |
|---|---|---|---|
| Discovery & compliance review | 1 Sep - 30 Sep | Requirements, legal assessment | Done (legal partial) |
| Design | 15 Sep - 31 Oct | UX, architecture, data model | 70% |
| Core platform | 19 Oct - 15 Jan | Auth, booking, video consultations | In progress |
| EHR integration | 1 Nov - 31 Jan | Lab results, history, prescriptions | Not started |
| Security & privacy testing | 11 Jan - 10 Feb | Pen test, privacy audit | Not started |
| Pilot with 2 clinics | 15 Jan - 28 Feb | Doctor training, 300 patients | Not started |
| Full launch | 31 Mar | All 6 clinics | Not started |

**Dependencies:** EHR vendor API (external, late), video SDK vendor, regulator opinion on telemedicine data hosting.

---

## 4. Budget (AZN)
| Category | Planned | Spent to date | Remaining |
|---|---|---|---|
| Development | 220,000 | 48,000 | 172,000 |
| Video infrastructure & SDK | 70,000 | 12,000 | 58,000 |
| EHR integration | 90,000 | 5,000 | 85,000 |
| Security & privacy compliance | 60,000 | 0 | 60,000 |
| UX design | 30,000 | 16,000 | 14,000 |
| QA & testing | 40,000 | 4,000 | 36,000 |
| Legal | 15,000 | 3,500 | 11,500 |
| Contingency | 35,000 | 0 | 35,000 |
| **Total** | **560,000** | **88,500** | **471,500** |

---

## 5. RACSI Matrix
| Activity | Sponsor | PM | Architect | Backend | Frontend | QA | Legal/DPO | EHR Liaison | Clinical Lead |
|---|---|---|---|---|---|---|---|---|---|
| Requirements & clinical workflow | A | R | C | I | I | I | C | C | R |
| Architecture & data model | I | C | A/R | S | S | I | C | C | I |
| Video consultation module | I | I | A | R | R | S | C | I | C |
| EHR integration | A | R | C | R | I | S | C | R | C |
| Privacy & compliance | A | C | C | S | S | I | R | I | I |
| Security testing | I | C | A | S | S | R | C | I | I |
| Doctor training & pilot | A | R | I | I | I | S | I | I | R |
| Go-live approval | A | R | C | I | I | C | C | I | C |

---

## 6. Technical Architecture Summary
- React web + React Native app -> Node.js API -> PostgreSQL; video via a third-party SDK; hosted in a single cloud region outside Azerbaijan (cheaper).
- Patient medical documents are uploaded to object storage with public-read links protected only by long random URLs.
- Encryption in transit is used; encryption at rest is "enabled by default in the cloud" and has not been verified.
- Doctors and patients log in with email and password; no 2FA planned for v1.
- Audit logging of who viewed which patient record is not designed.
- Video session recordings are stored for 90 days for "quality purposes"; patients are not explicitly asked for consent.
- EHR credentials are a single service account with full read access to all patients.
- No disaster recovery plan or defined RTO/RPO.

---

## 7. Meeting Notes

### Meeting 1: Compliance Workshop (22 Sep 2026)
**Attendees:** Togrul, Sevinj, Nurlana, Dr. Aygun
- Nurlana said the law on personal data may require health data to be stored within the country, but "an official opinion is not yet available."
- Sevinj noted that moving to a local data centre would raise the infrastructure cost by about 30% and delay the setup.
- Dr. Aygun: "We cannot wait for a legal opinion, we start with the cloud and fix it later if needed."
- Togrul asked whether patient consent for recordings had been designed; Nurlana: "Not yet."
- **Decisions:** Proceed with the foreign cloud region for now.
- **Actions:** Nurlana - request the regulator's written opinion (30 Sep). Togrul - add to the risk log (not done).

### Meeting 2: Technical Sync with EHR Vendor (6 Oct 2026)
**Attendees:** Togrul, Sevinj, Murad, Elnur
- Elnur said the API documentation will be available "in a couple of weeks" and the test environment "after the vendor's internal release in December."
- Murad said he can mock the EHR API but "real behavior might differ."
- Sevinj raised that the EHR API appears to support only batch polling every 15 minutes, which affects lab-result freshness.
- Dr. Vugar (by message) said doctors are skeptical and want a simple interface; 2 of 5 cardiologists said they won't use video visits.
- **Decisions:** Start with mocks and proceed.
- **Actions:** Elnur - send API docs (20 Oct). Togrul - re-plan EHR integration.

---

## 8. Status Reports

### Weekly Status Report - Week 5 (ending 2 Oct 2026)
**Overall:** Green | **Schedule:** Green | **Budget:** Green | **Scope:** Green
- Completed: booking flow design, auth service, video SDK trial.
- Issues: Waiting for legal opinion and EHR docs.
- Risks reported: "Dependency on the EHR vendor."

### Weekly Status Report - Week 6 (ending 9 Oct 2026)
**Overall:** Green | **Schedule:** Yellow | **Budget:** Green | **Scope:** Green
- Completed: first video call between two test accounts, patient registration.
- In progress: EHR mock, consent screens (not started).
- Issues: EHR test environment delayed to December; two cardiologists reluctant.
- Risks reported: "EHR vendor delay (low)."
