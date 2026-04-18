# Get More Ideas Prompt Comparison

Generated: 2026-04-18T12-30-27-828Z

This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.

## Token Summary

- Current prompt average prompt tokens: **993**
- Proposed prompt average prompt tokens: **1243**
- Average difference: **250**

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

- Duration: 1040 ms
- Usage: promptTokenCount: 937 | candidatesTokenCount: 100 | thoughtsTokenCount: n/a | totalTokenCount: 1037 | cachedContentTokenCount: n/a

1. The shoes are by the door, and the car will be there for us.
2. Getting shoes on helps us be ready for the car ride.
3. There are some shoes here, and the car is waiting.
4. These shoes are for getting into the car.

### Proposed follow-up prompt

- Duration: 1069 ms
- Usage: promptTokenCount: 1188 | candidatesTokenCount: 108 | thoughtsTokenCount: n/a | totalTokenCount: 1296 | cachedContentTokenCount: n/a

1. The shoes are by the door, and the car is out front.
2. Moving from inside to the car often means shoes go on first.
3. Car keys are in my hand, and shoes are usually helpful for walking to the car.
4. We'll be in the car once shoes are on.

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

- Duration: 1585 ms
- Usage: promptTokenCount: 989 | candidatesTokenCount: 158 | thoughtsTokenCount: n/a | totalTokenCount: 1147 | cachedContentTokenCount: n/a

1. The bathroom light is on, and the toothbrush is out. It looks like the dinosaur is ready for its cozy spot in bed when we're done here.
2. Toothpaste is on the brush! Then it's often a nice adventure for the dinosaur to find its special place in bed.
3. Brushing teeth happens first, and then the dinosaur gets to settle in for sleep. We could make sure its bed is ready!
4. There's the toothbrush! And the dinosaur often enjoys snuggling in bed right after all the teeth are clean.

### Proposed follow-up prompt

- Duration: 1153 ms
- Usage: promptTokenCount: 1241 | candidatesTokenCount: 132 | thoughtsTokenCount: n/a | totalTokenCount: 1373 | cachedContentTokenCount: n/a

1. The toothbrush is waiting by the sink, and then the dinosaur can go on a special journey to bed.
2. Getting to bed involves a quick stop in the bathroom for teeth, with the dinosaur along for the ride.
3. We can put the dinosaur's cozy spot next to the bed while teeth are being brushed.
4. Heading to the bathroom for teeth feels like a good plan before the dinosaur settles in for the night.

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

- Duration: 1259 ms
- Usage: promptTokenCount: 1050 | candidatesTokenCount: 83 | thoughtsTokenCount: n/a | totalTokenCount: 1133 | cachedContentTokenCount: n/a

1. The soap is by the sink. Lunch is on the counter in the kitchen.
2. Handwashing, and then the kitchen for lunch.
3. There's a spot open at the kitchen table, and handwashing is helpful first.

### Proposed follow-up prompt

- Duration: 1217 ms
- Usage: promptTokenCount: 1285 | candidatesTokenCount: 110 | thoughtsTokenCount: n/a | totalTokenCount: 1395 | cachedContentTokenCount: 860

1. The soap and water are by the sink, then the kitchen area for lunch.
2. Heading from hands to the kitchen. Lunch is on the counter.
3. Plenty of space at the table once hands are clean. Lunch is a good one today.
4. Everything is prepared for lunch when hands are taken care of.

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

- Duration: 1149 ms
- Usage: promptTokenCount: 996 | candidatesTokenCount: 136 | thoughtsTokenCount: n/a | totalTokenCount: 1132 | cachedContentTokenCount: n/a

1. The bathroom light is on, and the pajamas are out; the book can come with us to bed.
2. Getting ready for bed, the next stop is the bathroom, and the pajamas and book are part of that journey.
3. Those pajamas look ready for you after a quick stop in the bathroom, and your book can join you in bed.
4. The bathroom, pajamas, and your book all seem to be teaming up for bedtime tonight.

### Proposed follow-up prompt

- Duration: 1277 ms
- Usage: promptTokenCount: 1258 | candidatesTokenCount: 131 | thoughtsTokenCount: n/a | totalTokenCount: 1389 | cachedContentTokenCount: n/a

1. The bathroom light is on, and after that, the pajamas and a book will be ready for bed.
2. The path to bed goes through the bathroom, then involves pajamas, and a good book to finish.
3. Bringing the book along might make the bathroom and pajamas part of bedtime feel smoother.
4. Getting ready for bed often involves a quick bathroom stop, putting on pajamas, and having a favorite book close by.

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

