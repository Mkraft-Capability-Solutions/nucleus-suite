@AGENTS.md

# Claude entrypoint

Use `AGENTS.md` as the canonical project instruction source and follow its linked
`docs/engineering/` guidance. Do not maintain a competing role matrix or duplicate
architecture policies here. The current phase is local JSON UI validation; live
backend and database work requires the user's explicit signal.

Never include the private credential reference or local environment values in
responses, generated documentation, logs or client bundles. Report verified
results and unresolved gaps separately.

Strict Git Rule Followed: No code committed or pushed. All changes remain local for testing.


The user explicitly authorized documenting the shared synthetic demo password in `docs/engineering/ROLE_MODEL.md`. This narrow exception does not permit publishing production secrets or copying credentials into client bundles.
