# One-Tap Variations Implementation TODO

Update this checklist continuously while implementing the feature. Change each completed item from `[ ]` to `[x]` immediately after finishing that individual task.
For browser-based QA and manual verification, prefer the [$playwright-cli](/Users/kyle.wegner/.codex/skills/playwright-cli/SKILL.md) workflow over the Playwright MCP.

## Data model and history upsert changes
- [x] Add stable translation ids and variation-related types
- [x] Extend history entries with nested variation caches
- [x] Replace prepend-only history saves with run upsert behavior
- [x] Restore cached variations when reopening a Recent item

## Request-scoped challenge token refactor
- [x] Fetch a fresh challenge token per translate request in the network service
- [x] Remove shared challenge token state from the translator component
- [x] Ensure rapid successive variation requests do not collide on single-use tokens

## Action-aware rate limit updates
- [x] Add action-aware client rate limits for translate, more ideas, and variation requests
- [x] Separate server challenge and translate rate-limit buckets
- [x] Add variation burst limiting on the server
- [x] Return calm variation-specific rate-limit messaging for inline errors

## Inline variation UI and state handling
- [x] Add one open variation panel at a time
- [x] Add per-card variation controls and chip sets
- [x] Swap `Shorter` to `Longer` when Fewer Words is enabled
- [x] Cache results by source card and variation kind
- [x] Keep previous variation results visible while a new chip is loading
- [x] Support latest-click-wins with abort and stale-response protection
- [x] Add copy controls for variation outputs

## Variation prompt builder and server mode handling
- [x] Add request `mode` handling for translate, more ideas, and variation
- [x] Add dedicated variation prompt builder
- [x] Add variation-specific mock responses
- [x] Return exactly 2 variation results per request

## Analytics and error-state instrumentation
- [x] Track variation cache hits, aborts, stale responses, and rate-limit metadata
- [x] Keep variation failures local to the inline panel

## Eval dataset and prompt-review scripts
- [x] Create variation eval cases covering tones, multipart prompts, and Fewer Words
- [x] Add a variation review script with heuristic checks
- [x] Add or extend review guidance for variation output quality

## Manual QA and acceptance checks
- [x] Use playwright-cli rather than the Playwright MCP for browser-based QA
- [x] Record manual user review approval for UX, interactivity, and Recent behavior
- [x] Verify one open variation panel at a time
- [x] Verify cached chip clicks do not create network requests
- [x] Verify rapid chip clicks keep only the latest result
- [x] Verify Recent does not create duplicate entries during variation play
- [x] Verify restoring Recent preserves cached variations with panels collapsed
- [x] Verify `Fewer Words` swaps `Shorter` to `Longer` everywhere
- [x] Verify original and variation copy buttons work independently
- [ ] Confirm TODO.md is fully checked off
- [x] Confirm no duplicate Recent entries are created during variation play
- [x] Confirm prompt eval results justify shipping the feature

## Hold Before Commit
- [x] Accept overall prompt updates based on review of the generated review.md artifacts
- [ ] Wait for further review instructions before committing or shipping the implementation
