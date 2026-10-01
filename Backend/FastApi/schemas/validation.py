"""Validadores compartidos para datos ingresados por personas."""

import re


def clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value or not any(character.isalpha() for character in value):
        raise ValueError("Escribe un nombre válido.")
    if any(not (character.isalpha() or character in " .'-") for character in value):
        raise ValueError("El nombre solo puede contener letras, espacios, puntos, apóstrofes y guiones.")
    return value


def clean_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = " ".join(value.split())
    if not re.fullmatch(r"\+?[0-9 ()-]+", value):
        raise ValueError("El teléfono solo puede contener números, espacios, paréntesis, guiones y un + inicial.")
    digits = re.sub(r"\D", "", value)
    if not 8 <= len(digits) <= 15:
        raise ValueError("El teléfono debe contener entre 8 y 15 dígitos.")
    return value


def clean_email(value: str) -> str:
    return value.strip().lower()


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if any(ord(character) < 32 and character not in "\r\n\t" for character in value):
        raise ValueError("El texto contiene caracteres no permitidos.")
    return value


def clean_required_text(value: str) -> str:
    cleaned = clean_optional_text(value)
    if cleaned is None:
        raise ValueError("Este campo no puede quedar vacío.")
    return cleaned


def clean_single_line(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Este campo no puede quedar vacío.")
    if any(ord(character) < 32 for character in value):
        raise ValueError("El texto contiene caracteres no permitidos.")
    return value
