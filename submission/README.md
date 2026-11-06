# BNB OpenFour review package — 0.2.0

This package is ready for engineering review. It has not been submitted to the official Registry and is not a production release.

- Preset brief/composition: `developer/startup/presets/bnb-expansion.json`.
- Owned source: `developer/startup/contracts`; compiler/settings: `developer/startup/hardhat.config.cjs`.
- Upstream provenance: `docs/SOURCE_LOCK.json` and `developer/startup/vendor/openfour/manifest.json`.
- Schema: `schemas.json`, discoverable through ExpansionTokenModule and Tools.
- Registration/creation/lifecycle example: `developer/startup/scripts/verify-fork.cjs`.
- Local developer-owned Registry, reused implementation addresses, checks and local transaction hashes: `docs/reports/openfour-fork.json`.
- Defensive review and remaining release gates: `docs/SECURITY_REVIEW.md` and `docs/FOURMEME_REVIEW_CHECKLIST.md`.

The fork Registry is ephemeral localhost evidence, not a persistent public review deployment. To review interactively, deploy a funded developer-owned BNB testnet fork using the included toolkit, register the same composition, and configure the upstream Workbench with that Registry. The current token/curve/migrate schemas can drive its creation form. Bootstrap, attestation and bridge-state UX still need a production integration with the source operator; no production UI is claimed here.

Pending before official submission: author/contact, public test deployment, live source/DVN configuration and reconciliation, creation signer policy, failed-launch recovery policy, independent audit, LP-policy approval and official preset ID. No private keys or deployment secrets are included.
