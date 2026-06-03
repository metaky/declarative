# Evaluator Calibration Packet

Generated: 2026-06-02T16:05:41.976Z

This packet translates Kyle’s completed review into concrete evaluator-tuning guidance. It treats the existing `hasHarmfulOption` field as a legacy serious-mismatch flag unless the note clearly describes a true should-not-show issue.

## Snapshot

- Labeled sets: 40
- Comparable prior automated sets: 31
- Prior automated disagreements: 21
- False negatives, where automation failed a human Pass/Borderline: 9
- False positives, where automation passed/borderlined a human Fail: 9
- Fewer Words fidelity cases called out by notes: 14
- Cases with at least one excellent option but human Fail: 4

## Tone Distribution From Human Labels

| Tone | Sets | Pass | Borderline | Fail | Sets With Excellent Option |
|---|---:|---:|---:|---:|---:|
| Default | 10 | 3 | 4 | 3 | 7 |
| Straightforward | 8 | 3 | 3 | 2 | 5 |
| Humorous | 6 | 1 | 2 | 3 | 3 |
| Equalizing | 7 | 2 | 1 | 4 | 5 |
| Interest Based | 9 | 1 | 1 | 7 | 3 |

## Top Evaluator Bias Patterns

1. The evaluator was too harsh on short-but-usable safety/default outputs. Kyle accepted several terse running-house outputs as useful, while still noting that standard mode could be more conversational.
2. The evaluator underweighted `Fewer Words` fidelity. Kyle failed or downgraded sets where the toggle was on but outputs were not materially shorter, even when an individual line was otherwise decent.
3. The evaluator over-rewarded one strong Interest Based or Equalizing option when most of the set missed the tone strategy. Kyle values a great option, but tone filters still need set-level consistency.
4. The evaluator under-recognized real Humorous success. Kyle counted playful rhythm/fun as successful humor and rejected mere exclamation points as insufficient.
5. The evaluator did not distinguish serious mismatch from true should-not-show harm. This made failures less actionable and made the system seem more safety-critical than Kyle intended.

## Calibrated Evaluator Wording To Add

- Do not fail a set only because outputs are short or plain if at least 1-2 options are genuinely usable and the selected mode is not `Fewer Words`-violating.
- For `Fewer Words`, compare against the standard expectation: the set should be materially compact while still preserving safety, sequence, and destination.
- For Interest Based and Equalizing, a single excellent option is useful signal, but the set can still fail when most options miss the selected tone strategy.
- For Humorous, reward actual lightness, playful rhythm, or a small fun image; do not count punctuation alone as humor.
- Treat questions as valid declarative-adjacent softening when they invite collaboration or wondering. Penalize fake choices, question-demands, and repetitive question-only sets.
- Reserve `shouldNotShow` for output that should not be displayed. Use `seriousMismatch` for severe tone/filter/declarative misses.

## Suggested Kyle Review Cases

These are the highest-value examples for manual disagreement review or compact evaluator few-shots.

### current-01-running-house-default-standard

- Human verdict: Pass
- Prior automated verdict: Fail
- Tone: Default; Fewer Words: Off
- bestOptionCount: 3+; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: All appropriate, but responses are short. This follows on the short prompt, but in comparison to the "fewerwords" filter on, these are the same or actually shorter than some of those. We can train to be slightly more converastional.

Outputs:
1. The floor in here is for walking. [7 words]
2. The running happens outside. [4 words]
3. I wonder if we could try out our walking feet in here. [12 words]
4. Movement is happening quickly in the house right now. [9 words]

### current-12-dinner-hands-default-fewer

- Human verdict: Fail
- Prior automated verdict: Pass
- Tone: Default; Fewer Words: On
- bestOptionCount: 0; hasExcellentOption: false; legacy serious-mismatch flag: false
- Kyle note: "fewwerwords" should result in shorter statements. Good examples here would be something like. "Dinner's ready. We could wash hands." or "Those hands might be dirty for dinner time!"

Outputs:
1. Dinner is ready on the table. Time for handwashing before we eat. [12 words]
2. The table is set for dinner. Handwashing usually happens before we sit down for our meal. [16 words]
3. It's dinner o'clock! Looks like everyone's coming downstairs and washing up. [11 words]
4. Dinner is served! Hands are washed before we begin. [9 words]

### current-15-dinner-hands-humorous-standard

- Human verdict: Pass
- Prior automated verdict: Fail
- Tone: Humorous; Fewer Words: Off
- bestOptionCount: 2; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: Options 1 and 2 are both fun and do a good job of becoming humorous. 3 and 4 are OK, but simply adding an exclamation point to a response doesn't really make it "humorous" or fun.

Outputs:
1. The dinner bell is ringing! And the handwashing station is ready for action. Your speedy feet might get you to the table in record time! [25 words]
2. Dinner is almost on the table! The sink is all set for some bubbly fun. Then, it's straight to the food zone. [22 words]
3. It's dinner time. The downstairs world is calling, and the water is running in the sink for hand-cleaning adventures before we eat. [22 words]
4. Dinner is approaching, and there are some hands that need a quick rinse before the feast begins! The table is waiting. [21 words]

### current-19-dinner-hands-interest-based-standard

- Human verdict: Fail
- Prior automated verdict: Pass
- Tone: Interest Based; Fewer Words: Off
- bestOptionCount: 1; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: Option 3 is great because it integrates the interest naturally, beyond just name dropping. It is a little direct, but still works. The rest do not integrate the interest in a natural way.

Outputs:
1. Dinner is ready! There is a delicious meal downstairs. It is time for clean hands before we eat. [18 words]
2. The dinner bell rang, and it looks like a Pokemon might be joining us for dinner down in the kitchen. Handwashing is the next step before we can sit down. [30 words]
3. Food is on the table, all set for dinner. Time to make our way downstairs and get hands sparkly clean, just like a freshly caught Pokemon card! [27 words]
4. Downstairs is where dinner is waiting. A good hand wash is usually what happens before we eat. [17 words]

### current-28-toys-upstairs-equalizing-fewer

- Human verdict: Fail
- Prior automated verdict: Pass
- Tone: Equalizing; Fewer Words: On
- bestOptionCount: 1; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: These actually are generally pretty good, despite me marking them as failed. These only fail because they do not fit the fewerwords filter. A better version of option2 that hits fewerwords might be "I'm confused. Do toys go up or downstairs?"

Outputs:
1. The toys are here, and their home is upstairs in your room. [12 words]
2. I'm not sure if these toys go upstairs or downstairs. You're the expert on where they live. [17 words]
3. It looks like the toys want to go on an adventure to their room upstairs. I wonder what order they like to travel in. [24 words]
4. There's a job for the 'room-reset boss' when toys are ready to go back upstairs to their spot. [18 words]

### current-08-running-house-equalizing-fewer

- Human verdict: Borderline
- Prior automated verdict: Pass
- Tone: Equalizing; Fewer Words: On
- bestOptionCount: 2; hasExcellentOption: true; legacy serious-mismatch flag: true
- Kyle note: Options 2 and 3 are decent equalizing options. 1 and 4 don't use equalizing at all, with 1 not being declarative.

Outputs:
1. The house is a walking space, and outside is a running space. [12 words]
2. I may need a speed-fit checker for the house. Walking inside, running outside. [13 words]
3. Oh, my brain forgot for a moment if this was a running zone or a walking zone. [17 words]
4. This feels like a spot for walking, and then there's a running area out there. [15 words]

### current-13-dinner-hands-straightforward-standard

- Human verdict: Borderline
- Prior automated verdict: Fail
- Tone: Straightforward; Fewer Words: Off
- bestOptionCount: 1; hasExcellentOption: false; legacy serious-mismatch flag: false
- Kyle note: Option 1 is close. It matches the right tone, but "time to wash hands" is too direct for declarative language. Something like "Dinenr is ready on the table. We could wash hands." is softer and more declarative. The other options don't really work conversationally. These are all rather short and could be expanded by a few words to make room for better responses. The "fewerwords" responses are about the same length as these and are as brief as you can get, so feel free to use more words when it helps the responses.

Outputs:
1. Dinner is ready on the table. Time to wash hands. [10 words]
2. Dinner is prepared. Handwashing happens, then eating. [7 words]
3. The table is set for dinner. Handwashing usually comes before sitting down to eat. [14 words]

### current-21-toys-upstairs-default-standard

- Human verdict: Borderline
- Prior automated verdict: Pass
- Tone: Default; Fewer Words: Off
- bestOptionCount: 2; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: Options 1 and 4 are great. 2 and 4 are both too direct to work as declarative statements. We could expand our word count in these to make more room for declarative statements if necessary.

Outputs:
1. These toys are ready to go upstairs to your room. [10 words]
2. It's time for these toys to be picked up and put away in your room. [15 words]
3. The toys are here, and your room upstairs is where they belong. [12 words]
4. I notice the toys are ready to be put back in your room up the stairs. [16 words]

### current-29-toys-upstairs-interest-based-standard

- Human verdict: Fail
- Prior automated verdict: Fail
- Tone: Interest Based; Fewer Words: Off
- bestOptionCount: 1; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: Option3 works because it integrates the interest into the declarative statement. The others either miss that or integrate the interest in an awkward way.

Outputs:
1. These Pokemon friends are having a quiet moment, noticing that the toys are out and ready to go upstairs to your room. [22 words]
2. The next thing is for the toys to be picked up and find their way to your room upstairs. [19 words]
3. I wonder if these Pokemon characters could help us think about gathering the toys to go up to your room for bedtime. [22 words]
4. It looks like the toys are waiting to be tidied up and moved to their spot in your room upstairs. [20 words]

### anchor-good-safety-default

- Human verdict: Borderline
- Prior automated verdict: n/a
- Tone: Default; Fewer Words: Off
- bestOptionCount: 3+; hasExcellentOption: true; legacy serious-mismatch flag: false
- Kyle note: These all technically do work, but they are all a little abrupt and terse. This is common for short inputs like "stop running in the house" but I think we need to find a way to allow the responses to be a little more conversational. This even might be something that needs to be covered in the master prompt.

Outputs:
1. Fast feet have more room outside. [6 words]
2. Inside is feeling like a walking-speed place right now. [9 words]
3. There is a better running spot once we are outside. [10 words]
4. The house works better for slower feet. [7 words]

## Prompt And Product Implications

- Standard mode needs room for slightly more conversational language on very short inputs, without making Fewer Words indistinguishable from standard mode.
- Fewer Words should be judged as its own product behavior, not just as "also declarative."
- Tone prompts should optimize for more excellent options per set, not just one standout line.
- The evaluator should report best option yield and set consistency separately so a useful set is not discarded and a one-good-line set is not over-celebrated.
