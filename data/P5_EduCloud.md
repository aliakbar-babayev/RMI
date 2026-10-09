# P5: EduCloud - University LMS Cloud Migration

**Industry:** Education / IT Infrastructure | **Sponsor:** Prof. Rafig Gasimov (Vice-Rector, Baku Technical Academy) | **Status:** Planning/early execution (Week 2 of 44)
**Duration:** 1 Oct 2026 - 31 Aug 2027 | **Budget:** 410,000 AZN

---

## 1. Project Strategy
**Vision:** Migrate the university's aging on-premise learning management system (LMS), student information system, and file servers to a cloud platform with single sign-on (SSO), before the 2027/28 academic year starts on 15 September 2027.

**Objectives**
1. Migrate data and services for 14,000 students and 900 staff with less than 4 hours of downtime during cutover.
2. Introduce SSO across LMS, email, library, and the student portal.
3. Cut annual infrastructure and maintenance cost by 30%.

**Strategy:** "Lift, clean, and shift." Clean the data first, migrate in three waves (library and files, LMS, student information system), run old and new systems in parallel for the summer, and cut over in August.

**Out of scope:** Replacing the LMS product, campus network upgrades.

**Key assumptions:** The current LMS version is supported by the cloud provider; the data quality is acceptable; departments will cooperate with data owners and exceptions.

---

## 2. Team Members
| Name | Role | Allocation |
|---|---|---|
| Prof. Rafig Gasimov | Executive Sponsor | 5% |
| Sabir Karimli | Project Manager | 100% |
| Orkhan Huseynzade | Cloud Architect | 80% |
| Pervin Asgarova | Systems Engineer | 100% |
| Tunar Safarli | Database / Migration Engineer | 100% |
| Ilaha Mehdizade | Identity & SSO Specialist | 60% |
| Cemil Abdullayev | Information Security Officer (university) | 30% |
| Gulnar Ibrahimova | Training & Change Manager | 50% |
| Nijat Rustamov | Legacy System Administrator (university) | 40% |
| Vendor team (CloudBridge LLC) | Migration services (3 consultants) | External |

*Note: Nijat is the only person who knows the legacy system configuration. He is retiring in June 2027.*

---

## 3. Project Plan
| Phase | Dates | Key deliverables | Status |
|---|---|---|---|
| Assessment & inventory | 1 Oct - 15 Nov | System inventory, dependency map | In progress |
| Data cleaning | 1 Nov - 31 Jan | Cleaned datasets, retention rules | Not started |
| Cloud foundation & security | 15 Nov - 31 Jan | Landing zone, network, IAM | Not started |
| SSO implementation | 1 Feb - 15 Apr | SSO for 4 systems | Not started |
| Migration Wave 1 (files, library) | 1 Feb - 31 Mar | Data moved | Not started |
| Migration Wave 2 (LMS) | 1 Apr - 15 Jun | LMS live in the cloud (parallel) | Not started |
| Migration Wave 3 (student info system) | 15 Jun - 31 Jul | SIS live (parallel) | Not started |
| Training & cutover | 1 Aug - 31 Aug | Final cutover | Not started |

**Dependencies:** Vendor capacity (CloudBridge), exam and registration calendars (no change windows during Jan and June exam periods), sign-off by 11 faculties.

---

## 4. Budget (AZN)
| Category | Planned | Spent to date | Remaining |
|---|---|---|---|
| Migration services (vendor) | 120,000 | 15,000 | 105,000 |
| Cloud infrastructure (12 months) | 85,000 | 0 | 85,000 |
| Data cleaning | 40,000 | 0 | 40,000 |
| SSO & integrations | 45,000 | 0 | 45,000 |
| Training & communication | 35,000 | 0 | 35,000 |
| Security | 30,000 | 0 | 30,000 |
| Testing | 30,000 | 0 | 30,000 |
| Contingency | 25,000 | 0 | 25,000 |
| **Total** | **410,000** | **15,000** | **395,000** |

*Note: The cloud infrastructure budget covers 12 months only; the parallel-run period requires paying for both systems, which was not included in the estimate.*

---

## 5. RACSI Matrix
| Activity | Sponsor | PM | Cloud Architect | Sys Eng | DB Eng | SSO Spec | Security | Legacy Admin | Vendor |
|---|---|---|---|---|---|---|---|---|---|
| System inventory | I | A | C | R | R | C | I | R | C |
| Cloud architecture | I | C | A/R | S | S | C | C | C | C |
| Data cleaning | A | R | I | S | R | I | C | C | S |
| SSO implementation | I | A | C | S | I | R | C | C | S |
| Data migration | I | A | C | S | R | I | C | C | R |
| Security review | I | C | C | S | I | C | A/R | I | S |
| User training | A | R | I | I | I | I | I | I | S |
| Cutover & rollback | A | R | C | R | R | S | C | C | R |

---

## 6. Technical Architecture Summary
- Current: 3 physical servers in the campus data room (LMS on Moodle 3.9, student information system on a 2014 .NET application with SQL Server 2012, Windows file server).
- Moodle 3.9 and SQL Server 2012 are both out of vendor support.
- SIS has hardcoded database connection strings and a shared `sa` administrator account.
- Backups are done manually by Nijat to an external disk once a week; restore has never been tested.
- Student records contain duplicates and inconsistent IDs (estimated at 8-10%).
- Target: cloud VMs and managed database, Azure AD-compatible SSO (SAML/OIDC).
- There is no documentation of integrations between the library, LMS, and SIS; they exchange CSV files nightly via scheduled scripts.
- Network connectivity between campus and cloud is planned as an ordinary internet connection with VPN, with no bandwidth sizing.

---

## 7. Meeting Notes

### Meeting 1: Project Kick-off (2 Oct 2026)
**Attendees:** Prof. Rafig, Sabir, Orkhan, Pervin, Cemil, Nijat, CloudBridge representative
- Nijat said the nightly CSV scripts "have been working since 2016, but I would not touch them."
- CloudBridge said their consultants are shared with other clients and "may rotate."
- Cemil asked about the student data classification; Prof. Rafig: "Security review can come after the migration plan."
- Sabir noted that no go/no-go criteria for cutover exist yet.
- Orkhan said the university internet link is 200 Mbps, shared with all campus users.
- **Decisions:** Start assessment now; defer the security review.
- **Actions:** Pervin - complete inventory (15 Nov). Nijat - document scripts (when time permits).

### Meeting 2: Risk and Planning Session (9 Oct 2026)
**Attendees:** Sabir, Orkhan, Tunar, Ilaha, Gulnar
- Tunar did a quick data sample: about 9% of student records have duplicate or missing IDs. "It could break SSO matching."
- Ilaha said 11 faculties use different local tools (some use Google Classroom) that may need SSO integration too.
- Gulnar asked when training can begin; Sabir: "We'll see after migration."
- Orkhan: "Parallel run means double hosting cost for two months; this is not in the budget."
- Sabir said he does not want to raise this with the sponsor yet "so as not to scare him."
- **Decisions:** Hold the budget issue until the inventory is done.
- **Actions:** Tunar - full data quality report (30 Oct). Ilaha - list all faculty tools (30 Oct).

---

## 8. Status Reports

### Weekly Status Report - Week 1 (ending 2 Oct 2026)
**Overall:** Green | **Schedule:** Green | **Budget:** Green | **Scope:** Green
- Completed: kick-off, vendor onboarding.
- Planned: inventory start.
- Issues: None.
- Risks reported: None.

### Weekly Status Report - Week 2 (ending 9 Oct 2026)
**Overall:** Green | **Schedule:** Green | **Budget:** Green | **Scope:** Green
- Completed: server inventory 30%, vendor access set up.
- Planned: continue inventory, begin dependency map.
- Issues: None.
- Risks reported: "Data quality (to be assessed)."
