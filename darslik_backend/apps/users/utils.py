# apps/users/utils.py

def normalize_phone(phone: str) -> str:
    """
    Har xil formatdagi raqamni standart formatga keltiradi.

    Misol:
    "901234567"      → "998901234567"
    "+998901234567"  → "998901234567"
    "0901234567"     → "998901234567"
    "998901234567"   → "998901234567"
    """
    phone = str(phone).replace('+', '').replace(' ', '').replace('-', '')
    if phone.startswith('0'):
        phone = '998' + phone[1:]
    if not phone.startswith('998'):
        phone = '998' + phone
    return phone[:12]
