# Human Calibration Analysis

Generated: 2026-06-02T16:05:33.469Z

- Total items: 40
- Labeled items: 40
- Unlabeled items: 0
- Human verdicts: Pass 10, Borderline 11, Fail 19
- Best option counts: 0=12, 1=10, 2=11, 3+=7
- Sets with at least one excellent option: 23
- Sets with legacy serious-mismatch flags: 3
- Comparable automated items: 31
- Automated agreement: 10/31 (32%)
- Best-option heuristic disagreements: 15

## Calibration Lessons

- The old automated evaluator is not reliable enough to guide prompt changes by itself.
- Kyle clarified that the old `hasHarmfulOption` labels usually meant "bad enough to fail the set" rather than real-world harm. Future evals should separate `shouldNotShow` from `seriousMismatch`.
- Best-option count matters, but it is not sufficient by itself: tone fidelity and `Fewer Words` fidelity can downgrade a set even when one option is strong.
- One excellent option should prevent an automatic fail unless the selected tone/filter mostly misses, task coverage is unsafe, or an option is bad enough that it should not be shown.
- Questions are allowed and can soften a demand. They should be used as one strategy in the mix, not overused as the default pattern or disguised as faux choices.
- `Fewer Words` should be materially shorter, not merely similar-length wording with the same toggle selected.
- Standard-length outputs may be allowed to use a few more words when that makes them more conversational and declarative.
- Interest Based needs true integration, not name-dropping. A single natural integrated option is useful signal, but most of the set still matters.
- Equalizing needs the child to feel smart/strong/capable or the adult to need the child’s expertise. Merely adding an expert-ish word is not enough.
- Humorous needs actual lightness or fun; exclamation points and ordinary declarative lines do not count as humor.

## Automated Disagreements

### current-01-running-house-default-standard

- Human: Pass
- Automated: Fail
- Human note: All appropriate, but responses are short. This follows on the short prompt, but in comparison to the "fewerwords" filter on, these are the same or actually shorter than some of those. We can train to be slightly more converastional.

### current-02-running-house-default-fewer

- Human: Pass
- Automated: Fail
- Human note: All good

### current-04-running-house-straightforward-fewer

- Human: Pass
- Automated: Fail
- Human note: (none)

### current-06-running-house-humorous-fewer

- Human: Borderline
- Automated: Fail
- Human note: Options 3 and 4 have some humor integrated, but the others do not. All are declarative.

### current-08-running-house-equalizing-fewer

- Human: Borderline
- Automated: Pass
- Human note: Options 2 and 3 are decent equalizing options. 1 and 4 don't use equalizing at all, with 1 not being declarative.

### current-09-running-house-interest-based-standard

- Human: Borderline
- Automated: Fail
- Human note: Good declarative statements, however the only "interest" integrations are options 1 and 4, and neither of them really lean into the interest, they just simply mention it as part of the statement.

### current-12-dinner-hands-default-fewer

- Human: Fail
- Automated: Pass
- Human note: "fewwerwords" should result in shorter statements. Good examples here would be something like. "Dinner's ready. We could wash hands." or "Those hands might be dirty for dinner time!"

### current-13-dinner-hands-straightforward-standard

- Human: Borderline
- Automated: Fail
- Human note: Option 1 is close. It matches the right tone, but "time to wash hands" is too direct for declarative language. Something like "Dinenr is ready on the table. We could wash hands." is softer and more declarative. The other options don't really work conversationally. These are all rather short and could be expanded by a few words to make room for better responses. The "fewerwords" responses are about the same length as these and are as brief as you can get, so feel free to use more words when it helps the responses.

### current-14-dinner-hands-straightforward-fewer

- Human: Borderline
- Automated: Fail
- Human note: Options 2 and 3 are short and straightforward. 1 is close as well. 4 feels too aggressive with "time to get downstairs."

### current-15-dinner-hands-humorous-standard

- Human: Pass
- Automated: Fail
- Human note: Options 1 and 2 are both fun and do a good job of becoming humorous. 3 and 4 are OK, but simply adding an exclamation point to a response doesn't really make it "humorous" or fun.

### current-18-dinner-hands-equalizing-fewer

- Human: Fail
- Automated: Pass
- Human note: Option 4 is close to being right - it gets declarative and qualizing right - but isn't shortened for the "fewerwords" filter being on.

### current-19-dinner-hands-interest-based-standard

- Human: Fail
- Automated: Pass
- Human note: Option 3 is great because it integrates the interest naturally, beyond just name dropping. It is a little direct, but still works. The rest do not integrate the interest in a natural way.

## Best-Option Heuristic Disagreements

This heuristic treats the existing `hasHarmfulOption` values as Kyle’s legacy serious-mismatch flag, not as proof that an option was unsafe or shaming.

### current-06-running-house-humorous-fewer

- Human: Borderline
- Best-option heuristic: Pass
- bestOptionCount: 2
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Options 3 and 4 have some humor integrated, but the others do not. All are declarative.

### current-08-running-house-equalizing-fewer

- Human: Borderline
- Best-option heuristic: Fail
- bestOptionCount: 2
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): true
- Human note: Options 2 and 3 are decent equalizing options. 1 and 4 don't use equalizing at all, with 1 not being declarative.

### current-14-dinner-hands-straightforward-fewer

- Human: Borderline
- Best-option heuristic: Pass
- bestOptionCount: 2
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Options 2 and 3 are short and straightforward. 1 is close as well. 4 feels too aggressive with "time to get downstairs."

### current-17-dinner-hands-equalizing-standard

- Human: Fail
- Best-option heuristic: Borderline
- bestOptionCount: 1
- hasExcellentOption: false
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Only option 4 has an equalizing component (I'm not sure if…) but even that doesn't really meet equalizing needs. Equalizing should make the child feel smart or strong or capable, and/or make the adult seem incapable, weak, or needing the child's expertise.

### current-18-dinner-hands-equalizing-fewer

- Human: Fail
- Best-option heuristic: Borderline
- bestOptionCount: 1
- hasExcellentOption: false
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Option 4 is close to being right - it gets declarative and qualizing right - but isn't shortened for the "fewerwords" filter being on.

### current-19-dinner-hands-interest-based-standard

- Human: Fail
- Best-option heuristic: Borderline
- bestOptionCount: 1
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Option 3 is great because it integrates the interest naturally, beyond just name dropping. It is a little direct, but still works. The rest do not integrate the interest in a natural way.

### current-21-toys-upstairs-default-standard

- Human: Borderline
- Best-option heuristic: Pass
- bestOptionCount: 2
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Options 1 and 4 are great. 2 and 4 are both too direct to work as declarative statements. We could expand our word count in these to make more room for declarative statements if necessary.

### current-25-toys-upstairs-humorous-standard

- Human: Borderline
- Best-option heuristic: Pass
- bestOptionCount: 2
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Options 1 and 2 are both humorous. 3 and 4 lack the same fun and humour.

### current-27-toys-upstairs-equalizing-standard

- Human: Fail
- Best-option heuristic: Borderline
- bestOptionCount: 1
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Option 4 is the closest good combination - it starts with a declarative statement and incorporates the "boss" idea as equalizing. Great! Most of the others do a decent job of equalizing but start off without using declarative statements.

### current-28-toys-upstairs-equalizing-fewer

- Human: Fail
- Best-option heuristic: Borderline
- bestOptionCount: 1
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: These actually are generally pretty good, despite me marking them as failed. These only fail because they do not fit the fewerwords filter. A better version of option2 that hits fewerwords might be "I'm confused. Do toys go up or downstairs?"

### current-29-toys-upstairs-interest-based-standard

- Human: Fail
- Best-option heuristic: Borderline
- bestOptionCount: 1
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: Option3 works because it integrates the interest into the declarative statement. The others either miss that or integrate the interest in an awkward way.

### anchor-good-safety-default

- Human: Borderline
- Best-option heuristic: Pass
- bestOptionCount: 3+
- hasExcellentOption: true
- legacy serious-mismatch flag (hasHarmfulOption): false
- Human note: These all technically do work, but they are all a little abrupt and terse. This is common for short inputs like "stop running in the house" but I think we need to find a way to allow the responses to be a little more conversational. This even might be something that needs to be covered in the master prompt.
