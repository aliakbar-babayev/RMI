# PROJECT CHARTER & SPRINT 3 RETROSPECTIVE: CASPIANPAY CORE ENGINE MIGRATION

*Project Code:* PRJ-CASPIAN-2026  
*Domain:* FinTech / Retail Banking & Payment Clearing  
*Classification:* Internal Confidential / Level 3  
*Target Cutover Date:* 2026-12-15 (Hard Deadline)  
*Budget:* $1,450,000 USD (Contingency Reserve: 5% / $72,500)  
*Project Lead:* Murad Aliyev (Senior Engineering Director)  
*Lead Architect:* Leyla Mammadova  

---

## 1. Executive Summary & Scope

The CaspianPay modernization initiative aims to migrate 1.8 million active digital banking accounts from our legacy monolithic core database (hosted on-premise) to a distributed cloud-native settlement engine.

### Key Deliverables:
1. Automated customer account and ledger balance data migration.
2. Integration with the Central Bank Real-Time Gross Settlement (RTGS) switch.
3. Zero-downtime card transaction processing switch.
4. Legacy system deprecation and decommissioning.

### Project Constraints & Assumptions:
* *Constraint 1:* The final cutover must execute within a single 8-hour overnight maintenance window due to banking operational guidelines.
* *Assumption 1:* The external core banking vendor (FinCore Global) will deliver their certified sandbox and OpenAPI 3.0 specification by September 20, 2026.
* *Assumption 2:* All 1.8M balance ledgers will reconcile with zero tolerance (0.00% variance) during automated script execution.

---

## 2. Technical Architecture & Rollback Strategy

The production environment consists of:
* caspian-core-db01 (Primary PostgreSQL 16 cluster)
* caspian-ingress-gw01 (Reverse proxy & TLS termination)
* caspian-settlement-svc (Containerized Go microservices)

### Cutover Plan Excerpt:
> "Due to compute budget constraints, maintaining a parallel-run phase where both legacy and new engines process live clearing feeds concurrently was ruled out. We will execute a single big-bang cutover at 02:00 AM on December 15. If critical balance corruption is detected after 05:00 AM, there is currently no automated rollback procedure defined; manual database restore from cold tape backups will take an estimated 14 hours."

---

## 3. Sprint 3 Retrospective & Engineering Team Notes (Unfiltered)

Date: October 8, 2026  
Attendees: Murad A. (PM), Leyla M. (Arch), Samir Q. (DevOps), Rashad K. (Backend Lead)

### Verbatim Transcript Excerpts:

* *Samir Q. (DevOps):*
  > "We had 4 deployments fail on staging this week because developers don't have individual access keys. To keep deployment velocity on schedule, several backend developers currently share the root SSH private key and production DB administrative credentials stored in an unencrypted environment file on jumpbox-internal."

* *Rashad K. (Backend Lead):*
  > "The dry run migration script had issues yesterday on the staging replica. When we ran the rehearsal on 500,000 test accounts, 0.7% of the balances failed to balance out due to foreign key mismatches in legacy interest tables. We haven't diagnosed the root cause yet."

* *Leyla M. (Lead Architect):*
  > "FinCore Global is already 18 days behind on delivering the sandbox API specs. Their integration engineer stopped replying on Slack, and our contractual penalty clause only kicks in if they miss delivery by more than 60 days. Our payment gateway integration team has been blocked for two consecutive sprints."

* *Murad A. (Project Lead):*
  > "Marketing just committed to enterprise clients that we will also include Instant QR Merchant Checkout in the December launch. This was not in the original scope or architectural design, but leadership says it is non-negotiable for business competitiveness."
