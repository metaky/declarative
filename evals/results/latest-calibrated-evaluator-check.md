# Calibrated Evaluator Check

Generated: 2026-06-02T16-26-48-328Z

This check re-scores the 40 human-labeled calibration sets without regenerating translations.

## Summary

- Model: gemini-2.5-flash
- Sets re-scored: 40
- Prior automated agreement on comparable rows: 10/31 (32%)
- Raw calibrated evaluator agreement: 16/40 (40%)
- Postprocessed calibrated agreement: 25/40 (63%)
- Calibrated verdicts: Pass 22, Borderline 10, Fail 8, Unknown 0
- Postprocessed verdicts: Pass 15, Borderline 9, Fail 16, Unknown 0
- Human verdicts: Pass 10, Borderline 11, Fail 19, Unknown 0
- Token use for this evaluator check: prompt 59088, output 38324

## Remaining Disagreements

### current-02-running-house-default-fewer

- Human: Pass
- Raw calibrated evaluator: Borderline
- Postprocessed calibrated evaluator: Borderline
- Prior automated: Fail
- Tone: Default; Fewer Words: On
- Human note: All good
- Evaluator recommendation: The set provides multiple usable declarative options for the intent. However, only option 3 truly adheres to the 'Fewer Words' filter. The set is Borderline because while there are good usable options, the 'Fewer Words' constraint is not consistently met, especially with option 4 which is also slightly higher pressure. Consider refining the 'Fewer Words' adherence for options 1, 2, and 4 to make the set stronger overall.

### current-13-dinner-hands-straightforward-standard

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: Fail
- Tone: Straightforward; Fewer Words: Off
- Human note: Option 1 is close. It matches the right tone, but "time to wash hands" is too direct for declarative language. Something like "Dinenr is ready on the table. We could wash hands." is softer and more declarative. The other options don't really work conversationally. These are all rather short and could be expanded by a few words to make room for better responses. The "fewerwords" responses are about the same length as these and are as brief as you can get, so feel free to use more words when it helps the responses.
- Evaluator recommendation: This set is excellent. All options are usable and align well with the straightforward tone and caregiving intent. It provides good variety without compromising clarity or low pressure.

### current-14-dinner-hands-straightforward-fewer

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: Fail
- Tone: Straightforward; Fewer Words: On
- Human note: Options 2 and 3 are short and straightforward. 1 is close as well. 4 feels too aggressive with "time to get downstairs."
- Evaluator recommendation: This set is strong and fully meets the criteria for 'Straightforward' tone and 'Fewer Words' setting. All options are usable and directly address the caregiver's intent. It is recommended to keep this set as is.

### current-15-dinner-hands-humorous-standard

- Human: Pass
- Raw calibrated evaluator: Borderline
- Postprocessed calibrated evaluator: Borderline
- Prior automated: Fail
- Tone: Humorous; Fewer Words: Off
- Human note: Options 1 and 2 are both fun and do a good job of becoming humorous. 3 and 4 are OK, but simply adding an exclamation point to a response doesn't really make it "humorous" or fun.
- Evaluator recommendation: The set is borderline. While all options are usable and cover the core tasks without being high-pressure, none truly achieve the requested 'Humorous' tone. The attempts at humor feel superficial and generic. This set provides usable options, but the tone filter mostly misses, preventing a 'Pass' verdict.

### current-17-dinner-hands-equalizing-standard

- Human: Fail
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Borderline
- Prior automated: Fail
- Tone: Equalizing; Fewer Words: Off
- Human note: Only option 4 has an equalizing component (I'm not sure if…) but even that doesn't really meet equalizing needs. Equalizing should make the child feel smart or strong or capable, and/or make the adult seem incapable, weak, or needing the child's expertise.
- Evaluator recommendation: This set passes due to having two genuinely usable options that effectively meet the 'Equalizing' tone goal while covering the task. While the first two options miss the specific tone, they are not harmful or unusable. The presence of strong options makes the set overall useful.
- Postprocess reasons: Equalizing serious mismatch count 2

### current-21-toys-upstairs-default-standard

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: Pass
- Tone: Default; Fewer Words: Off
- Human note: Options 1 and 4 are great. 2 and 4 are both too direct to work as declarative statements. We could expand our word count in these to make more room for declarative statements if necessary.
- Evaluator recommendation: This set is strong and meets the caregiver's intent effectively. It provides several good, low-pressure, declarative options for the cleanup task and destination. The overall usefulness is high.

### current-25-toys-upstairs-humorous-standard

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: Pass
- Tone: Humorous; Fewer Words: Off
- Human note: Options 1 and 2 are both humorous. 3 and 4 lack the same fun and humour.
- Evaluator recommendation: This set successfully meets the caregiver's intent and the humorous tone goal. All options are usable, with options 1-3 being particularly strong. The set can be passed.

### current-27-toys-upstairs-equalizing-standard

- Human: Fail
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: Pass
- Tone: Equalizing; Fewer Words: Off
- Human note: Option 4 is the closest good combination - it starts with a declarative statement and incorporates the "boss" idea as equalizing. Great! Most of the others do a decent job of equalizing but start off without using declarative statements.
- Evaluator recommendation: This set is excellent and fully aligns with the 'Equalizing' tone goal. All options are usable and would be highly effective for the stated caregiver intent. This set should pass.

### anchor-good-safety-default

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: n/a
- Tone: Default; Fewer Words: Off
- Human note: These all technically do work, but they are all a little abrupt and terse. This is common for short inputs like "stop running in the house" but I think we need to find a way to allow the responses to be a little more conversational. This even might be something that needs to be covered in the master prompt.
- Evaluator recommendation: This set is strong and effectively meets the caregiver's intent and tone requirements. It provides multiple usable options for the user.

### anchor-weak-safety-caption

- Human: Fail
- Raw calibrated evaluator: Borderline
- Postprocessed calibrated evaluator: Borderline
- Prior automated: n/a
- Tone: Default; Fewer Words: On
- Human note: Options 2, 3, and 4 do not make any sense. Option 1 kind of works, but isn't great. Short options that can work here might be something like "We have slow feet inside." or "
- Evaluator recommendation: The set is Borderline. While Option 1 is genuinely usable and aligns well with the 'Fewer Words' and 'Default' tone, options 2 and 3 are too vague and do not adequately address the core task. Option 4 is acceptable but not strong. The presence of one good option prevents a Fail, but the inconsistencies in task coverage and overall usefulness make it Borderline. Further refinement is needed to ensure more options are genuinely helpful and task-relevant, even with the 'Fewer Words' constraint.

### anchor-good-dinner-sequence

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: n/a
- Tone: Default; Fewer Words: Off
- Human note: I like option3. Even though it is brief and to the point, it actually is a nice version of declarative language. The others seem too short and don't have a conversational nature to them. That terseness takes away from some of the declarative nature of the responses.
- Evaluator recommendation: The set passes effectively. It provides multiple usable options that fulfill the caregiver's intent while adhering to the default tone and low-pressure goals. Options 1 and 3 are particularly strong.

### anchor-good-cleanup-destination

- Human: Borderline
- Raw calibrated evaluator: Pass
- Postprocessed calibrated evaluator: Pass
- Prior automated: n/a
- Tone: Straightforward; Fewer Words: Off
- Human note: Take inspiration from Option3. It is straightforward and declarative. It does not get "cute" which is part of the goal of the straightforward filter. Option1 is close, but just a little awkward.
- Evaluator recommendation: This set is strong and provides multiple usable options that adhere well to the 'Straightforward' tone while covering both the cleanup action and the destination.

### anchor-weak-cleanup-destination-loss

- Human: Borderline
- Raw calibrated evaluator: Fail
- Postprocessed calibrated evaluator: Fail
- Prior automated: n/a
- Tone: Default; Fewer Words: On
- Human note: All options neglect mentioning that the toys go upstairs in your room. This can be OK with the fewerwords filter, but we have to be careful. Option1 is actualy really nice - it points out the problem without making a demand. The other 3 are nonsense. I might simply change Option1 to "The toys are everywhere. Upstairs?" While this is a broken fragment of a question at the end, that is acceptable for fewerwords, and it gives a direction to the child without actually creating a demand.
- Evaluator recommendation: The model needs significant improvement in understanding and incorporating the full intent of the original request, especially when 'Fewer Words' is active. It should still aim to cover critical elements like the object to be cleaned and its destination, even with brevity. The current suggestions are too abstract and miss key information.
- Postprocess reasons: model reported zero usable options

### anchor-weak-interest-gimmick

- Human: Pass
- Raw calibrated evaluator: Borderline
- Postprocessed calibrated evaluator: Borderline
- Prior automated: n/a
- Tone: Interest Based; Fewer Words: Off
- Human note: The harmful option would be Option3 because it makes a promise (pokemon cards are at the sink) that might not be true. I love the integration of pokemon throughout all of them, I just don't want to make promises about specific items being in places that we can't be sure are possible for the parents.
- Evaluator recommendation: The set has a few usable options that try to use the Pokemon interest, but the integration often feels forced or inauthentic. Option 2 is a serious mismatch for the Interest Based tone. To improve, focus on more natural and genuinely integrated ways to use the interest without creating false premises or sounding clunky. It's currently Borderline as there are some usable options, but the overall tone consistency needs work.

### anchor-good-interest-light

- Human: Fail
- Raw calibrated evaluator: Borderline
- Postprocessed calibrated evaluator: Borderline
- Prior automated: n/a
- Tone: Interest Based; Fewer Words: Off
- Human note: These don't integrate the interests well.
- Evaluator recommendation: The set provides usable, low-pressure, and task-covering options. However, it largely fails to meet the 'Interest Based: Pokemon' tone request, with only one option making a decent, though not excellent, attempt. The overall tone fidelity is low. It's borderline because there is one usable option that attempts the tone, and no options are harmful or should-not-show. Improvements are needed to genuinely incorporate the interest into more options.
- Postprocess reasons: Interest Based serious mismatch count 3


## All Re-Scored Rows

| Item | Human | Raw Calibrated | Postprocessed | Prior Automated | Best Options | Excellent | Should-Not-Show | Serious Mismatch |
|---|---|---|---|---|---:|---:|---:|---:|
| current-01-running-house-default-standard | Pass | Pass | Pass | Fail | 3 | 0 | 0 | 0 |
| current-02-running-house-default-fewer | Pass | Borderline | Borderline | Fail | 3 | 0 | 0 | 0 |
| current-03-running-house-straightforward-standard | Pass | Pass | Pass | Pass | 1 | 1 | 0 | 0 |
| current-04-running-house-straightforward-fewer | Pass | Pass | Pass | Fail | 2 | 0 | 0 | 0 |
| current-05-running-house-humorous-standard | Fail | Fail | Fail | Fail | 0 | 0 | 0 | 0 |
| current-06-running-house-humorous-fewer | Borderline | Borderline | Borderline | Fail | 4 | 0 | 0 | 0 |
| current-07-running-house-equalizing-standard | Pass | Pass | Pass | Pass | 3 | 1 | 0 | 0 |
| current-08-running-house-equalizing-fewer | Borderline | Pass | Borderline | Pass | 2 | 1 | 0 | 0 |
| current-09-running-house-interest-based-standard | Borderline | Borderline | Borderline | Fail | 2 | 0 | 0 | 2 |
| current-10-running-house-interest-based-fewer | Fail | Fail | Fail | Fail | 1 | 0 | 0 | 1 |
| current-11-dinner-hands-default-standard | Pass | Pass | Pass | Pass | 4 | 2 | 0 | 0 |
| current-12-dinner-hands-default-fewer | Fail | Pass | Fail | Pass | 4 | 0 | 0 | 0 |
| current-13-dinner-hands-straightforward-standard | Borderline | Pass | Pass | Fail | 3 | 0 | 0 | 0 |
| current-14-dinner-hands-straightforward-fewer | Borderline | Pass | Pass | Fail | 4 | 0 | 0 | 0 |
| current-15-dinner-hands-humorous-standard | Pass | Borderline | Borderline | Fail | 0 | 0 | 0 | 0 |
| current-16-dinner-hands-humorous-fewer | Fail | Borderline | Fail | Fail | 1 | 1 | 0 | 0 |
| current-17-dinner-hands-equalizing-standard | Fail | Pass | Borderline | Fail | 2 | 0 | 0 | 2 |
| current-18-dinner-hands-equalizing-fewer | Fail | Pass | Fail | Pass | 2 | 2 | 0 | 0 |
| current-19-dinner-hands-interest-based-standard | Fail | Fail | Fail | Pass | 0 | 0 | 0 | 0 |
| current-20-dinner-hands-interest-based-fewer | Fail | Borderline | Fail | Pass | 1 | 1 | 0 | 2 |
| current-21-toys-upstairs-default-standard | Borderline | Pass | Pass | Pass | 1 | 1 | 0 | 0 |
| current-22-toys-upstairs-default-fewer | Fail | Pass | Fail | Pass | 4 | 2 | 0 | 0 |
| current-23-toys-upstairs-straightforward-standard | Pass | Pass | Pass | Fail | 4 | 0 | 0 | 0 |
| current-24-toys-upstairs-straightforward-fewer | Fail | Borderline | Fail | Pass | 1 | 0 | 0 | 1 |
| current-25-toys-upstairs-humorous-standard | Borderline | Pass | Pass | Pass | 3 | 0 | 0 | 0 |
| current-26-toys-upstairs-humorous-fewer | Fail | Fail | Fail | Pass | 0 | 0 | 0 | 0 |
| current-27-toys-upstairs-equalizing-standard | Fail | Pass | Pass | Pass | 4 | 0 | 0 | 0 |
| current-28-toys-upstairs-equalizing-fewer | Fail | Pass | Fail | Pass | 2 | 2 | 0 | 0 |
| current-29-toys-upstairs-interest-based-standard | Fail | Fail | Fail | Fail | 0 | 0 | 0 | 2 |
| current-30-toys-upstairs-interest-based-fewer | Fail | Fail | Fail | Fail | 0 | 0 | 0 | 4 |
| current-31-dinner-hands-interest-missing-standard | Fail | Pass | Fail | Fail | 4 | 1 | 0 | 0 |
| anchor-good-safety-default | Borderline | Pass | Pass | n/a | 4 | 0 | 0 | 0 |
| anchor-weak-safety-caption | Fail | Borderline | Borderline | n/a | 1 | 0 | 0 | 2 |
| anchor-good-dinner-sequence | Borderline | Pass | Pass | n/a | 2 | 0 | 0 | 0 |
| anchor-weak-dinner-sequence-loss | Fail | Fail | Fail | n/a | 3 | 0 | 0 | 1 |
| anchor-good-cleanup-destination | Borderline | Pass | Pass | n/a | 4 | 0 | 0 | 0 |
| anchor-weak-cleanup-destination-loss | Borderline | Fail | Fail | n/a | 0 | 0 | 0 | 0 |
| anchor-good-equalizing | Pass | Pass | Pass | n/a | 2 | 0 | 0 | 0 |
| anchor-weak-interest-gimmick | Pass | Borderline | Borderline | n/a | 0 | 0 | 0 | 1 |
| anchor-good-interest-light | Fail | Borderline | Borderline | n/a | 1 | 0 | 0 | 3 |
