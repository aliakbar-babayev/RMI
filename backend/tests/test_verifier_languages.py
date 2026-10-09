"""Quote verification on the EN / AZ / RU sample documents."""

import pytest

from app.samples import SAMPLES
from app.services.verifier import locate_quote

EN, AZ, RU = (next(s["text"] for s in SAMPLES if s["language"] == lang) for lang in ("en", "az", "ru"))


@pytest.mark.parametrize(
    ("doc", "quote"),
    [
        # Azerbaijani letters ə ğ ş ı İ, as written and in other cases
        (AZ, "Ödəniş modulunun inteqrasiyası podratçı tərəfindən iki həftə gecikdirilib."),
        (AZ, "Müştəri məlumatları hələ də şifrələnmədən test bazasına köçürülür."),
        (AZ, "MƏRKƏZİ BANKIN YENİ TƏLƏBLƏRİ"),
        (AZ, "komandada yalnız bir ios proqramçısı var"),
        # Cyrillic
        (RU, "Резервное копирование сервера erp-prod не проверялось с прошлого года."),
        (RU, "ДОСТУП АДМИНИСТРАТОРА К БАЗЕ ДАННЫХ"),
        # Quote across a line break in the document
        (EN, "The cutover is planned for a single weekend with no parallel run. Several developers share the root password"),
        (AZ, "Komandada yalnız bir iOS proqramçısı var.\nTətbiqin ictimai təqdimatı"),
        # Wrapped in quotation marks by the model
        (EN, '"Only Rashad knows the legacy batch jobs"'),
        (AZ, "«Layihənin büdcəsinin 70%-i artıq xərclənib»"),
        (RU, "„Поставщик сообщил о задержке поставки лицензий“"),
    ],
)
def test_real_quotes_verify(doc, quote):
    span = locate_quote(doc, quote)
    assert span is not None
    assert span[1] > span[0]


@pytest.mark.parametrize(
    ("doc", "quote"),
    [
        # One word changed
        (EN, "Data migration rehearsal on core-db failed today"),
        (AZ, "Ödəniş modulunun inteqrasiyası podratçı tərəfindən üç həftə gecikdirilib."),
        (RU, "Поставщик сообщил о задержке поставки лицензий на две недели."),
        # Azerbaijani letter replaced by a Latin look-alike (ə → e, ş → s)
        (AZ, "Musteri melumatlari hele de sifrelenmeden"),
        # Translated instead of copied
        (AZ, "Payment module integration was delayed by two weeks"),
    ],
)
def test_tampered_quotes_are_rejected(doc, quote):
    assert locate_quote(doc, quote) is None


def test_highlight_offsets_return_original_text():
    quote = "MƏRKƏZİ BANKIN YENİ TƏLƏBLƏRİ"
    start, end = locate_quote(AZ, quote)
    assert AZ[start:end] == "Mərkəzi Bankın yeni tələbləri"
