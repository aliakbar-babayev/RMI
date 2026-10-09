# P1: PayBridge - Mobil cüzdan və P2P ödənişlər

**Sahə:** Fintex | **Sponsor:** Kamran Əliyev (Maliyyə direktoru, Caspian FinServe) | **Status:** İcra olunur (26 həftədən 6-cı həftə)
**Müddət:** 1 sentyabr 2026 - 28 fevral 2027 | **Büdcə:** 480 000 AZN

---

## 1. Layihə strategiyası
**Vizyon:** Azərbaycanda istifadəçilərə QR kod və telefon nömrəsi vasitəsilə satıcılara ödəniş etməyə, hesabı bölüşdürməyə və P2P köçürmələr göndərməyə imkan verən mobil cüzdan.

**Məqsədlər**
1. MVP-ni (cüzdan balansının artırılması, P2P köçürmə, QR ilə satıcıya ödəniş) 15 fevral 2027-ci il tarixinədək istifadəyə vermək.
2. İstifadəyə verildikdən sonra 3 ay ərzində 20 000 təsdiqlənmiş istifadəçi cəlb etmək.
3. İstifadəyə verilməzdən əvvəl Mərkəzi Bankın elektron pul üzrə təhlükəsizlik yoxlamasından keçmək.

**Strategiya:** Mikroxidmətlərə əsaslanan backend qurmaq, kənar KYC provayderindən istifadə etmək və kartla balans artırılmasını lisenziyalı ödəniş prosessoruna həvalə etmək. Buraxılış iki mərhələdə olacaq (yanvarda qapalı beta, fevralda ictimai buraxılış).

**Əhatə dairəsinə daxil deyil (v1):** Beynəlxalq köçürmələr, kripto, kredit funksiyaları.

**Əsas fərziyyələr:** KYC provayderinin API-si 2026-cı ilin oktyabrına hazır olacaq; prosessorun sandbox mühiti 3-cü həftədə əlçatan olacaq; tənzimləyici mövcud uyğunluq sənədlərini qəbul edəcək.

---

## 2. Komanda üzvləri
| Ad | Rol | Yüklənmə |
|---|---|---|
| Kamran Əliyev | İcraçı sponsor | 5% |
| Leyla Məmmədova | Layihə meneceri | 100% |
| Rəşad Hüseynov | Texniki rəhbər / Backend arxitektor | 100% |
| Nigar Həsənova | Backend proqramçı (ödənişlər) | 100% |
| Tural Quliyev | Mobil proqramçı (Flutter) | 100% |
| Aysel Kərimova | UI/UX dizayner | 50% |
| Elvin Səfərov | QA mühəndisi | 100% |
| Sabina İsmayılova | Təhlükəsizlik və uyğunluq üzrə məsul şəxs | 40% |
| Orxan Bağırov | DevOps mühəndisi | 60% (digər 2 layihə ilə bölüşdürülür) |

---

## 3. Layihə planı
| Mərhələ | Tarixlər | Əsas nəticələr | Status |
|---|---|---|---|
| Başlanğıc və tələblər | 1 sen - 21 sen | Tələblər sənədi, arxitekturanın ilkin layihəsi | Tamamlanıb |
| Dizayn | 15 sen - 15 okt | UX axınları, API spesifikasiyası, verilənlər bazası sxemi | 80% |
| Əsas proqramlaşdırma | 5 okt - 15 dek | Cüzdan, ledger, P2P, KYC inteqrasiyası | İcra olunur |
| Satıcı və QR modulu | 1 dek - 10 yan | QR ödəniş, satıcı paneli | Başlanmayıb |
| Test və təhlükəsizlik yoxlaması | 5 yan - 5 fev | Penetrasiya testi, yük testi, UAT | Başlanmayıb |
| Qapalı beta | 10 yan - 31 yan | 500 beta istifadəçi | Başlanmayıb |
| Buraxılış | 15 fev | İctimai buraxılış | Başlanmayıb |

**Asılılıqlar:** KYC provayderinin API-si (xarici), ödəniş prosessorunun sandbox mühiti (xarici), tənzimləyicinin yoxlama vaxtı (xarici, 6 fevrala təyin edilib).

---

## 4. Büdcə (AZN)
| Kateqoriya | Planlaşdırılıb | Xərclənib | Qalıq |
|---|---|---|---|
| Proqramlaşdırma | 210 000 | 52 000 | 158 000 |
| İnfrastruktur və bulud | 60 000 | 9 500 | 50 500 |
| Təhlükəsizlik və uyğunluq (penetrasiya testi, audit) | 45 000 | 0 | 45 000 |
| Kənar lisenziyalar (KYC, SMS, prosessor) | 38 000 | 14 000 | 24 000 |
| UI/UX dizayn | 30 000 | 18 000 | 12 000 |
| QA və test | 35 000 | 3 000 | 32 000 |
| Marketinq və buraxılış | 32 000 | 0 | 32 000 |
| Ehtiyat fondu | 30 000 | 11 500 | 18 500 |
| **Cəmi** | **480 000** | **108 000** | **372 000** |

*Qeyd: 6-cı həftədə ehtiyat fondunun artıq 38%-i istifadə olunub.*

---

## 5. RACSI matrisi
R = Məsul, A = Hesabat verən, C = Məsləhətləşilən, S = Dəstək verən, I = Məlumatlandırılan

| Fəaliyyət | Sponsor | PM | Texniki rəhbər | Backend | Mobil | QA | Təhlükəsizlik | DevOps |
|---|---|---|---|---|---|---|---|---|
| Tələblərin təsdiqi | A | R | C | C | C | I | C | I |
| Arxitektura dizaynı | I | C | A/R | S | S | I | C | S |
| Ledger və ödəniş xidməti | I | I | A | R | I | S | C | S |
| Mobil tətbiqin hazırlanması | I | I | A | S | R | S | C | I |
| KYC inteqrasiyası | I | C | A | R | S | S | C | I |
| Təhlükəsizlik testi | I | C | C | S | S | S | A/R | S |
| Yerləşdirmə və CI/CD | I | I | A | S | S | S | C | R |
| Tənzimləyiciyə təqdimat | A | R | C | I | I | I | R | I |
| Büdcə nəzarəti | A | R | I | I | I | I | I | I |

---

## 6. Texniki arxitekturanın xülasəsi
- Flutter mobil tətbiqi -> API Gateway (Node.js) -> mikroxidmətlər (auth, cüzdan, ledger, bildirişlər) -> PostgreSQL.
- Ledger xidmətini yalnız bir proqramçı (Nigar) yazıb və ona baxır.
- Autentifikasiya 30 günlük müddəti olan JWT ilə işləyir; refresh-token rotasiyası hələ yoxdur.
- Admin paneli bütün komandanın hazırlıq dövründə istifadə etdiyi bir ortaq admin hesabı ilə qorunur.
- Staging və production eyni bulud hesabını paylaşır; gizli açarlar repozitoriyadakı `.env` faylında saxlanılır.
- Gündəlik verilənlər bazası ehtiyat nüsxələri planlaşdırılıb, lakin hələ qurulmayıb.
- Köçürmə limitləri hazırkı versiyada yalnız mobil tətbiq tərəfində yoxlanılır.

---

## 7. İclas qeydləri

### İclas 1: Sprint 3 planlaması (24 sentyabr 2026)
**İştirakçılar:** Leyla, Rəşad, Nigar, Tural, Elvin, Orxan
- Rəşad: ledger xidməti qrafik üzrə gedir, lakin "hazırda rekonsilyasiya məntiqini həqiqətən yalnız Nigar başa düşür."
- Tural yekun API spesifikasiyasını istədi; Rəşad dedi ki, spesifikasiya "yəqin ki, gələn həftə bitəcək."
- Orxan bildirdi ki, vaxtını üç layihə arasında bölür və CI/CD-ni yalnız "boş vaxt olanda" qura bilər.
- Elvin qeyd etdi ki, hələ test mühiti yoxdur, ona görə də proqramçıların noutbuklarında test edir.
- Leyla KYC provayderi barədə soruşdu; Rəşad: "API-ni oktyabrın ortasına vəd ediblər, yazılı öhdəlik yoxdur."
- **Qərarlar:** Əsas proqramlaşdırmanın 5 oktyabrda başlaması qüvvədə qalır. Leyla KYC provayderinə yazılı müraciət edəcək.
- **Tapşırıqlar:** Rəşad - API spesifikasiyasını yekunlaşdırsın (2 okt). Orxan - CI/CD planı təklif etsin (30 sen). Leyla - KYC provayderi ilə əlaqə saxlasın.

### İclas 2: Rəhbər komitə (6 oktyabr 2026)
**İştirakçılar:** Kamran, Leyla, Rəşad, Sabina
- Kamran rəqib analoji funksiyanı elan etdiyi üçün MVP-yə "keşbek" funksiyasının əlavə edilməsində israr etdi. Rəşad dedi ki, bu "mümkündür, amma qrafiki sıxacaq." Kamran: "Əlavə edək, onsuz buraxılış edə bilmərik."
- Sabina xatırlatdı ki, tənzimləyici təhlükəsizlik arxitekturası sənədini yoxlamadan 4 həftə əvvəl tələb edir; sənədə hələ başlanmayıb.
- Leyla büdcənin plan üzrə olduğunu bildirdi; Kamran "ehtiyat fonduna toxunmamağı" xahiş etdi.
- Rəşad qeyd etdi ki, prosessorun sandbox mühiti qeyri-sabit işləyir və balans artırma testləri iki dəfə uğursuz olub.
- **Qərarlar:** Keşbek MVP-nin əhatə dairəsinə əlavə edildi, son tarix və büdcə dəyişdirilmədi.
- **Tapşırıqlar:** Sabina - təhlükəsizlik sənədinə başlasın (13 okt). Rəşad - keşbek üçün iş həcmini qiymətləndirsin (9 okt).

---

## 8. Status hesabatları

### Həftəlik status hesabatı - 5-ci həftə (2 oktyabr 2026-cı il tarixinədək)
**Ümumi:** Yaşıl | **Qrafik:** Yaşıl | **Büdcə:** Yaşıl | **Əhatə:** Yaşıl
- Tamamlanıb: UX axınları təsdiqlənib, verilənlər bazası sxemi v1, cüzdan xidmətinin skeleti.
- Növbəti həftə üçün plan: API spesifikasiyasının yekunlaşdırılması, KYC inteqrasiyasına başlanılması.
- Problemlər: Bildirilməyib.
- Bildirilən risklər: Yoxdur.

### Həftəlik status hesabatı - 6-cı həftə (9 oktyabr 2026-cı il tarixinədək)
**Ümumi:** Yaşıl | **Qrafik:** Sarı | **Büdcə:** Yaşıl | **Əhatə:** Sarı
- Tamamlanıb: cüzdan balansının artırılması (sandbox), P2P köçürmə prototipi.
- İcra olunur: API spesifikasiyası (1 həftə gecikir), keşbek üzrə qiymətləndirmə.
- Problemlər: Prosessorun sandbox mühitinin qeyri-sabitliyi, test mühitinin olmaması.
- Bildirilən risklər: "API spesifikasiyasında kiçik gecikmə."
- Göstəricilər: Komandanın sürəti (velocity) 32-dən 24 story point-ə düşüb.
