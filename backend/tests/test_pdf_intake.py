"""PDF intake reads document text without saving it or inventing coverage."""

from io import BytesIO

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from pdf_intake import PdfIntakeError, extract_procedure_pdf


def pdf_with_text(text):
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    page[NameObject('/Resources')] = DictionaryObject({
        NameObject('/Font'): DictionaryObject({
            NameObject('/F1'): DictionaryObject({
                NameObject('/Type'): NameObject('/Font'),
                NameObject('/Subtype'): NameObject('/Type1'),
                NameObject('/BaseFont'): NameObject('/Helvetica'),
            }),
        }),
    })
    stream = DecodedStreamObject()
    stream.set_data(f'BT /F1 12 Tf 72 720 Td ({text}) Tj ET'.encode())
    page[NameObject('/Contents')] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_extracts_text_and_supported_procedure_without_inventing_plan_data():
    document = extract_procedure_pdf(BytesIO(pdf_with_text('Treatment plan recommends braces')),
                                     'care.pdf')
    assert document['filename'] == 'care.pdf'
    assert document['page_count'] == 1
    assert 'braces' in document['excerpt'].lower()
    assert document['candidates'] == [{'value': 'orthodontics', 'label': 'Orthodontics'}]
    assert 'plan_pays' not in document


def test_multiple_procedures_are_distinct_candidates():
    document = extract_procedure_pdf(BytesIO(pdf_with_text('Root canal and crown')),
                                     'care.pdf')
    assert {item['value'] for item in document['candidates']} == {'root-canal', 'crown-bridge'}


@pytest.mark.parametrize('raw,name,code', [
    (b'not a pdf', 'care.pdf', 'invalid_pdf'),
    (pdf_with_text('care'), 'care.txt', 'invalid_pdf'),
])
def test_rejects_wrong_or_corrupt_file(raw, name, code):
    with pytest.raises(PdfIntakeError) as error:
        extract_procedure_pdf(BytesIO(raw), name)
    assert error.value.code == code


def test_scanned_pdf_reports_missing_text():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = BytesIO()
    writer.write(output)
    with pytest.raises(PdfIntakeError) as error:
        extract_procedure_pdf(BytesIO(output.getvalue()), 'scan.pdf')
    assert error.value.code == 'no_text'


def test_rejects_oversized_document_before_parsing():
    with pytest.raises(PdfIntakeError) as error:
        extract_procedure_pdf(BytesIO(b'%PDF-' + b'a' * (5 * 1024 * 1024)), 'huge.pdf')
    assert error.value.code == 'too_large'
