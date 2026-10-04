# Research and decisions

## Text extraction

**Decision**: Use `pypdf==6.19.0` in Flask for text-based PDFs. Check page content stream size before text extraction to limit decompression work. Reject image-only files with a specific explanation.

**Rationale**: It is a pure-Python dependency that fits the backend without OCR. The official [pypdf documentation](https://pypdf.readthedocs.io/en/latest/user/extract-text.html) states it cannot extract text from images and warns that page streams can expand substantially in memory. Version 6.19.0 is listed on the [maintainer's PyPI page](https://pypi.org/project/pypdf/).

**Alternatives**: Browser-side extraction adds frontend processing; OCR adds scope and cost.

## Conversation handoff

**Decision**: A signed-in upload endpoint extracts text and catalog aliases, then sends compact context into the existing CX session via a document event. CX asks the user to confirm the candidate or choose among candidates before estimating. Raw document prose is never used as a plan rule.

**Rationale**: `/api/chat` accepts only 1,000-character text turns; sending a full document directly would fail or match the wrong intent.

**Alternatives**: Raw text sent to CX exceeds the limit; generative summarization may invent details.

## Navigation state

**Decision**: Lift live chat state above routed pages into a React in-memory owner. Clear it on sign-out or account change, and do not persist document excerpts in Firestore or browser storage.

**Rationale**: The current chat unmounts on account navigation and loses its session token and messages.
