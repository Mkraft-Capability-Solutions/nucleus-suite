# _tooling — requirements build tooling (not part of the delivered requirements package)

Builds the source-derived documents in `../requirements/` from the controlled workbooks in `../data-form-process-sheets/`, renders use cases and user stories from `usecases/<DOM>.json`, then refreshes logos, links, the master register (DOC-02) and folder indexes.

| File | Role |
| :--- | :--- |
| `regenerate.sh` | Entry point; run after an approved change (CM-02) |
| `xlsx_dump.py` | Standard-library `.xlsx` reader |
| `srclib.py` | Parsing, domain mapping, third-party-name cleaner, header/sign-off/measurement blocks, Mermaid helpers |
| `gen.py` | Domain packs FRS-<DOM>-00..13 and BA, DA, IA, AI, NFR, VV, TR, RB, SRC documents; coverage audit TR-04 |
| `authored.py` | Authored capability gaps (CG) and frontier features (FX) |
| `usecases/` | Authored use cases and user stories (JSON), one file per domain |
| `finalize.py` | Logo, link repair, DOC-02, folder READMEs |
| `normalize_handwritten.py` | One-off normaliser used for the 1.0.0 consolidation of hand-written documents |
