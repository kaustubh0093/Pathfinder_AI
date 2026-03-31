import io
import PyPDF2
import docx


def extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Extract plain text from uploaded file bytes (PDF, DOCX, TXT)."""
    filename_lower = filename.lower()

    if filename_lower.endswith(".txt"):
        try:
            return content.decode("utf-8").strip()
        except UnicodeDecodeError:
            return content.decode("latin-1").strip()

    elif filename_lower.endswith(".pdf"):
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text_piece = page.extract_text() or ""
            text += text_piece + "\n"
        return text.strip()

    elif filename_lower.endswith(".docx"):
        doc = docx.Document(io.BytesIO(content))
        return "\n".join([p.text for p in doc.paragraphs]).strip()

    return ""
