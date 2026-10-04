"""Extract bounded, temporary procedure context from a text-based PDF."""

from __future__ import annotations

from io import BytesIO
import re

from pypdf import PdfReader

from dental import catalog

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_PAGES = 20
MAX_PAGE_STREAM_BYTES = 2 * 1024 * 1024
MAX_EXTRACTED_CHARS = 100_000
MAX_EXCERPT_CHARS = 700

ALIASES = {
    "cleaning": ("cleaning", "prophylaxis", "d1110", "d1120"),
    "exam-xrays": ("dental exam", "x-rays", "xrays", "bitewing", "d0120", "d0210", "d0274"),
    "filling": ("filling", "fillings", "cavity", "composite restoration", "d2391", "d2392", "d2330"),
    "extraction": ("extraction", "tooth removal", "wisdom teeth", "d7140", "d7210"),
    "root-canal": ("root canal", "endodontic", "d3310", "d3320", "d3330"),
    "crown-bridge": ("crown", "bridge", "d2740", "d2750", "d6240"),
    "implant": ("implant", "d6010", "d6058"),
    "dentures": ("dentures", "partials", "d5110", "d5120", "d5213"),
    "orthodontics": ("orthodontic", "orthodontics", "braces", "clear aligners", "d8080", "d8090"),
    "cosmetic": ("whitening", "veneers", "bonding", "d9972", "d2962"),
}


class PdfIntakeError(Exception):
    def __init__(self, code: str, message: str, status: int = 422):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def _candidate_matches(text: str):
    found = []
    for procedure_id, phrases in ALIASES.items():
        if procedure_id not in catalog.PROCEDURE_CATALOG:
            continue
        positions = [match.start() for phrase in phrases
                     if (match := re.search(r"\b" + re.escape(phrase) + r"\b", text, re.I))]
        if positions:
            entry = catalog.PROCEDURE_CATALOG[procedure_id]
            found.append((min(positions), {"value": procedure_id, "label": entry.label}))
    return sorted(found, key=lambda item: item[0])


def extract_procedure_pdf(stream, filename: str) -> dict:
    name = str(filename or "").replace("\\", "/").split("/")[-1][:120]
    if not name.lower().endswith(".pdf"):
        raise PdfIntakeError("invalid_pdf", "Choose a PDF file.", 415)
    raw = stream.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise PdfIntakeError("too_large", "Choose a PDF smaller than 5 MB.", 413)
    if not raw.startswith(b"%PDF-"):
        raise PdfIntakeError("invalid_pdf", "This file is not a readable PDF.", 415)
    try:
        reader = PdfReader(BytesIO(raw))
        if reader.is_encrypted:
            raise PdfIntakeError("encrypted_pdf", "Password-protected PDFs cannot be read here.")
        page_count = len(reader.pages)
        if not 1 <= page_count <= MAX_PAGES:
            raise PdfIntakeError("page_limit", "Choose a PDF with 20 pages or fewer.")
        pieces = []
        total = 0
        for page in reader.pages:
            contents = page.get_contents()
            if contents and len(contents.get_data()) > MAX_PAGE_STREAM_BYTES:
                raise PdfIntakeError("too_complex", "This PDF page is too large to process.")
            page_text = page.extract_text() or ""
            if page_text:
                pieces.append(page_text[:MAX_EXTRACTED_CHARS - total])
                total += len(pieces[-1])
            if total >= MAX_EXTRACTED_CHARS:
                break
    except PdfIntakeError:
        raise
    except Exception as exc:
        raise PdfIntakeError("invalid_pdf", "This PDF could not be read.") from exc
    text = re.sub(r"\s+", " ", " ".join(pieces)).strip()
    if not text:
        raise PdfIntakeError("no_text", "This PDF looks like a scan with no selectable text. Upload a text-based PDF or type your procedure.")
    matches = _candidate_matches(text)
    center = matches[0][0] if matches else 0
    start = max(0, min(center - 100, len(text) - MAX_EXCERPT_CHARS))
    excerpt = text[start:start + MAX_EXCERPT_CHARS].strip()
    return {"filename": name, "page_count": page_count, "excerpt": excerpt,
            "candidates": [candidate for _, candidate in matches]}
