# Phase 5 — Gemini 3.5 Flash-Lite rollout

**Status:** Active 5% canary

**Updated:** 2026-08-19

## Current deployment contract

- **Baseline (95%):** `declarative-25-morelike-health`
  - Configuration: `gemini-2.5-flash-baseline`
  - Model: `gemini-2.5-flash`, thinking budget `0`
- **Candidate (5%):** `declarative-35lite-morelike-health`
  - Configuration: `gemini-3.5-flash-lite-minimal`
  - Model: `gemini-3.5-flash-lite`, thinking level `minimal`
- **Shared application image:** `sha256:1d85ce8e1235fc8216c4d6015a8a6f39bef9b84b7f7366e2ea5dde221d5219e4`

Both revisions contain the `More like this` interface and the `Similar` variation direction. The model configuration is the only intended runtime difference.

## Evidence gate

The previous 3.5 Flash-Lite canary produced **14 successful candidate completions with no candidate rollback trigger**. Those completions remain credited because the selected model configuration and response contract are preserved. This rebuilt candidate is required only to align the canary with the current feature release.

The 5% gate passes after:

1. at least 20 cumulative successful 3.5 Flash-Lite candidate completions (six more after the rebuild);
2. no candidate-attributable 5xx, timeout, parse, schema, output-count, configuration, or material latency regression; and
3. public root, challenge, and readiness checks remain healthy.

The remaining evidence should include a successful `Similar` variation when normal traffic provides one, without recording caregiver input or model output.

## Rollback

Immediately route 100% of traffic to `declarative-25-morelike-health` if a candidate rollback trigger occurs. Then verify:

- `https://declarativeapp.org/`
- `https://declarativeapp.org/api/challenge`
- `https://declarativeapp.org/api/healthz`

Do not use `declarative-00108-xsh` as the rollback target: while its code calls 2.5 Flash, its environment label incorrectly identifies the 3.5 configuration and it does not contain the current configuration-driven migration controls.
