# Get More Ideas Prompt Comparison

Generated: 2026-04-18T12-36-57-335Z

This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.

## Token Summary

- Current prompt average prompt tokens: **902**
- Proposed prompt average prompt tokens: **1243**
- Average difference: **341**

## Review Guidance

- Use [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md) while reviewing.
- Treat any increase in generic language, praise-as-pressure, or missing task parts as more important than token differences.
- For follow-up cases, distinctness matters, but not at the expense of authenticity or usefulness.
- Be especially critical of the `Interest Based`, `Fewer Words`, and multi-part cases.

## follow-up-default-shoes-car — Default follow-up

- Tone: Default
- Fewer Words: No
- Text: Get your shoes on and come to the car.
- Existing translations in prompt: 4
- Review focus: Distinct follow-up ideas; No generic rewordings; Still low-pressure

### Current follow-up prompt

- Duration: 7297 ms
- Usage: promptTokenCount: 848 | candidatesTokenCount: 150 | thoughtsTokenCount: n/a | totalTokenCount: 998 | cachedContentTokenCount: n/a

1. The car is all ready to go; it's waiting in the driveway. It looks like shoe-wearing time, then out to the car.
2. It's time for the car adventure. Shoes go on our feet, then we head for the car.
3. The car is sitting outside, ready for our trip. Shoes are usually a good idea for the walk to the car.
4. Our ride is waiting. I wonder if shoes first, then a quick dash to the car, might feel easiest.

### Proposed follow-up prompt

- Duration: 2810 ms
- Usage: promptTokenCount: 1188 | candidatesTokenCount: 103 | thoughtsTokenCount: n/a | totalTokenCount: 1291 | cachedContentTokenCount: 849

1. The shoes are right by the door, and the car will be just outside.
2. Stepping into shoes comes before walking out to the car.
3. Having shoes on helps with getting to the car comfortably.
4. Soon we will be in the car, ready for the trip.

### Human Review Notes

```txt
Prompt verdict:
- Current prompt: 
- Proposed prompt: 

What the current prompt did better:
- 

What the proposed prompt did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep current / Proposed looks better / Needs more iteration
```

## follow-up-interest-bedtime-dinosaur — Interest Based follow-up

- Tone: Interest Based
- Fewer Words: No
- Interest: Dinosaurs
- Text: Please come to the bathroom, brush your teeth, and bring your dinosaur to bed.
- Existing translations in prompt: 4
- Review focus: Interest stays grounded; Multi-part fidelity; Distinctness without gimmicks

### Current follow-up prompt

- Duration: 3119 ms
- Usage: promptTokenCount: 897 | candidatesTokenCount: 167 | thoughtsTokenCount: n/a | totalTokenCount: 1064 | cachedContentTokenCount: n/a

1. The bathroom light is on; the toothbrush is ready for action. Dinosaur friends often enjoy a quick stop here before settling into their sleeping spot.
2. It looks like the toothbrush is waiting, and then it will be time for your dinosaur's journey to bed.
3. The bathroom is open, and a little later, it'll be time to get your dinosaur tucked in. I wonder if your dinosaur is ready for teeth-brushing time before bed.
4. The toothpaste is on the counter, and soon after, the dinosaur will be ready to head for bed. The bathroom is all set.

### Proposed follow-up prompt

- Duration: 1603 ms
- Usage: promptTokenCount: 1241 | candidatesTokenCount: 133 | thoughtsTokenCount: n/a | totalTokenCount: 1374 | cachedContentTokenCount: 855

1. The toothbrush is waiting by the sink, and then the dinosaur can go on a bedtime journey.
2. The path from here leads to the bathroom, and once teeth are brushed, the dinosaur is all set for bed.
3. Getting the dinosaur ready for bed will happen right after teeth are brushed, and the bathroom is where that starts.
4. A clean mouth and a sleepy dinosaur making their way to bed sounds like a good plan.

### Human Review Notes

```txt
Prompt verdict:
- Current prompt: 
- Proposed prompt: 

What the current prompt did better:
- 

What the proposed prompt did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep current / Proposed looks better / Needs more iteration
```

## follow-up-fewer-words-lunch — Fewer Words follow-up

- Tone: Straightforward
- Fewer Words: Yes
- Text: Wash your hands and come to the kitchen for lunch.
- Existing translations in prompt: 4
- Review focus: Compact but complete; No clipped or bossy drift; Fresh follow-up angles

### Current follow-up prompt

- Duration: 2653 ms
- Usage: promptTokenCount: 959 | candidatesTokenCount: 114 | thoughtsTokenCount: n/a | totalTokenCount: 1073 | cachedContentTokenCount: 816

1. Hand washing usually happens before we eat. Lunch is ready in the kitchen.
2. I notice the sink is available, then the kitchen is ready for lunch.
3. Lunch is waiting in the kitchen. Hand washing would be next, then coming to the table.
4. The kitchen will be set for lunch as soon as hands are washed.

### Proposed follow-up prompt

- Duration: 1688 ms
- Usage: promptTokenCount: 1285 | candidatesTokenCount: 117 | thoughtsTokenCount: n/a | totalTokenCount: 1402 | cachedContentTokenCount: 860

1. The sink area is open, and then the kitchen is set for lunch.
2. Handwashing first, then the journey to the kitchen for lunch.
3. Some soap is available for hands, and then we can get lunch on the table in the kitchen.
4. Hands could use a wash, and lunch is in the kitchen when you're ready.

### Human Review Notes

```txt
Prompt verdict:
- Current prompt: 
- Proposed prompt: 

What the current prompt did better:
- 

What the proposed prompt did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep current / Proposed looks better / Needs more iteration
```

## follow-up-multipart-bed-bathroom — Multi-part follow-up

- Tone: Equalizing
- Fewer Words: No
- Text: Please come to the bathroom, get your pajamas on, and bring your book to bed.
- Existing translations in prompt: 4
- Review focus: All parts stay present; Equalizing tone stays natural; Distinctness across follow-up rounds

### Current follow-up prompt

- Duration: 1766 ms
- Usage: promptTokenCount: 905 | candidatesTokenCount: 138 | thoughtsTokenCount: n/a | totalTokenCount: 1043 | cachedContentTokenCount: n/a

1. The bathroom is ready, and it looks like pajamas are calling for a story in bed soon.
2. It's time for settling down; the bathroom, pajamas, and a good book are all part of the bedtime journey.
3. Pajamas and a book are waiting for us right after a quick stop in the bathroom.
4. I wonder if we should head to the bathroom first, then get those pajamas on, and grab a book for bed.

### Proposed follow-up prompt

- Duration: 2509 ms
- Usage: promptTokenCount: 1258 | candidatesTokenCount: 133 | thoughtsTokenCount: n/a | totalTokenCount: 1391 | cachedContentTokenCount: n/a

1. The bathroom lights are on, and the pajamas are out for getting ready with your book for bed.
2. Moving from the bathroom to pajamas, and then your book to bed, completes the evening flow.
3. The pajamas are right here, ready for the trip from the bathroom with your book to bed.
4. Getting to the bathroom, into pajamas, and tucking in with your book often helps us all settle for the night.

### Human Review Notes

```txt
Prompt verdict:
- Current prompt: 
- Proposed prompt: 

What the current prompt did better:
- 

What the proposed prompt did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep current / Proposed looks better / Needs more iteration
```

