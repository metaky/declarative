# Gemini Caching Evaluation

This note documents the Step 4 decision on whether explicit Gemini context caching is worth implementing for the current Declarative translation flow.

## Decision

Do **not** implement explicit caching at this time.

Keep relying on:

- the Gemini API's built-in implicit caching when it happens naturally
- the existing usage metadata logs to monitor whether the request profile changes enough to revisit this later

## Why We Are Deferring Explicit Caching

### 1. Representative prompt sizes are mostly below the published implicit caching threshold

Google's Gemini caching docs say:

- implicit caching is enabled automatically on Gemini 2.5 models
- Gemini 2.5 Flash has a published minimum input token count of **1024** for context caching
- explicit caching is intended for larger repeated context where the developer wants guaranteed cost savings

Official source:
- [Context caching docs](https://ai.google.dev/gemini-api/docs/caching)

Our measured prompt-token profile does not strongly fit that pattern.

From the saved Step 3 comparison set:

- prompt count: 12 cases
- minimum prompt tokens: **854**
- maximum prompt tokens: **1013**
- average prompt tokens: **926**
- cases at or above 1024 tokens: **0**

That means the representative evaluation set never crossed the published 1024-token floor for Gemini 2.5 Flash implicit caching.

### 2. Recent live traffic shows the same basic shape

Recent `gemini_usage_metadata` logs from production show common prompt sizes such as:

- 854
- 855
- 856
- 857
- 860
- 871
- 875
- 879
- 905
- 909
- 912
- 938
- 981

This supports the same conclusion: the normal translation path is usually under 1024 tokens.

### 3. We did observe one cache-hit-like live event, but it looks inconsistent rather than dependable

One recent production request showed:

- `prompt_token_count: 938`
- `cached_content_token_count: 812`
- `existing_translations_count: 4`

That suggests some cache benefit can still appear in practice on repeated-prefix requests, especially in a `Get more ideas` style flow.

However:

- it was not the common pattern in recent logs
- it does not look stable enough to justify extra caching complexity
- the core product path still appears too small to rely on caching as a meaningful cost lever

### 4. Explicit caching adds complexity without a strong payoff signal

Explicit caching would require us to:

- create and manage cache resources
- choose TTL behavior
- track cache names and lifecycle
- thread cached content into generation requests
- verify no correctness regressions

That complexity is better justified when the app repeatedly sends a large static prefix that is clearly above the model's caching threshold and responsible for a meaningful share of cost.

The current translation workflow does not show that profile strongly enough.

## Recommendation

For now:

- do not implement explicit caching
- keep implicit caching enabled by default
- continue logging:
  - `prompt_token_count`
  - `cached_content_token_count`
  - `cache_tokens_details`
  - `total_token_count`
- revisit this decision only if one of these becomes true:
  - average prompt size moves above 1024 consistently
  - a refactor introduces a larger repeated shared context
  - `Get more ideas` remains expensive after prompt-size cleanup and shows repeatable cache-hit patterns worth optimizing further

## What To Optimize Instead

Safer near-term cost work remains:

- Step 5: trim prompt verbosity
- Step 6: reduce unnecessary context in `Get more ideas`

Those are more likely to reduce cost for this app than explicit caching under the current request profile.
