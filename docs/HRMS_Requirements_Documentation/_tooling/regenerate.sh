#!/usr/bin/env bash
# Regenerate all source-derived requirement documents from ../../data-form-process-sheets,
# then refresh logos, links, the master register (DOC-02) and folder READMEs.
# Run only after the source-workbook change has been approved through CM-02.
set -euo pipefail
cd "$(dirname "$0")"
python3 -I gen.py
python3 -I finalize.py
python3 -I known_issues.py
