"""Pre-loaded demo documents. The Azerbaijani and Russian texts should be checked by a native speaker."""

SAMPLES = [
    {
        "id": "en-fintech-sprint4",
        "language": "en",
        "title": "FinTech Migration – Sprint 4 Notes",
        "source": "core-db",
        "text": """Sprint 4 retrospective – Core Banking Migration

The vendor still has not delivered the sandbox API; they now say it will be ready "sometime in January".
Our go-live date of March 1 is fixed by the central bank and cannot move.
Data migration rehearsal on core-db failed yesterday: 0.8% of account balances did not reconcile.
Only Rashad knows the legacy batch jobs, and he is on leave for three weeks in February.
The cutover is planned for a single weekend with no parallel run.
Several developers share the root password for prod-web-02 to deploy hotfixes.
QA estimates that regression testing needs 4 weeks, but the plan gives 10 days.
Budget contingency is 5%, and we have already used half of it on extra vendor hours.""",
    },
    {
        "id": "az-mobile-bank",
        "language": "az",
        "title": "Mobil Bank Tətbiqi – Həftəlik Toplantı",
        "source": "mobile-api",
        "text": """Mobil bank tətbiqi layihəsi – həftəlik toplantı qeydləri

Ödəniş modulunun inteqrasiyası podratçı tərəfindən iki həftə gecikdirilib.
Test mühitində mobile-api serveri son həftədə üç dəfə dayanıb.
Müştəri məlumatları hələ də şifrələnmədən test bazasına köçürülür.
Layihənin büdcəsinin 70%-i artıq xərclənib, lakin işin yalnız yarısı tamamlanıb.
Mərkəzi Bankın yeni tələbləri ilə bağlı hüquq şöbəsinin rəyi hələ alınmayıb.
Komandada yalnız bir iOS proqramçısı var.
Tətbiqin ictimai təqdimatı aprel ayına planlaşdırılıb və marketinq kampaniyası artıq başlayıb.""",
    },
    {
        "id": "ru-erp-rollout",
        "language": "ru",
        "title": "Внедрение ERP – протокол совещания",
        "source": "erp-prod",
        "text": """Протокол совещания по внедрению ERP-системы

Поставщик сообщил о задержке поставки лицензий на три недели.
Резервное копирование сервера erp-prod не проверялось с прошлого года.
Пользователи из бухгалтерии ещё не прошли обучение, а запуск назначен на первое число месяца.
Интеграция со складской системой работает нестабильно и теряет часть заказов.
Доступ администратора к базе данных есть у всех сотрудников отдела ИТ.
Бюджет на консультантов почти исчерпан, а договор с ними заканчивается в следующем месяце.""",
    },
]
