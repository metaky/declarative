# Get More Ideas Prompt Comparison

Generated: 2026-04-18T12-26-53-586Z

This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.

## Token Summary

- Current prompt average prompt tokens: **881**
- Proposed prompt average prompt tokens: **1165**
- Average difference: **284**

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

- Duration: 2120 ms
- Usage: promptTokenCount: 826 | candidatesTokenCount: 101 | thoughtsTokenCount: n/a | totalTokenCount: 927 | cachedContentTokenCount: n/a

1. The shoes are here by the door; the car is outside ready for us.
2. Shoes are usually helpful for walking to the car.
3. It's time for shoes and then the car.
4. I'm thinking about shoes and getting to the car now.

### Proposed follow-up prompt

- Duration: 1216 ms
- Usage: promptTokenCount: 1110 | candidatesTokenCount: 107 | thoughtsTokenCount: n/a | totalTokenCount: 1217 | cachedContentTokenCount: n/a

1. The car is out front, and shoes go on our feet for walking outside.
2. Walking to the car happens right after shoes are on.
3. Shoes are over here by the door, and the car is waiting.
4. We're heading to the car; shoes are usually part of that.

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

- Duration: 1222 ms
- Usage: promptTokenCount: 879 | candidatesTokenCount: 126 | thoughtsTokenCount: n/a | totalTokenCount: 1005 | cachedContentTokenCount: n/a

1. Toothbrushing happens, and then the dinosaur goes to bed.
2. The bathroom is open for teeth brushing; then, it's time for the dinosaur to snuggle into bed.
3. I wonder if the dinosaur needs a ride to the bathroom for teeth brushing before heading to bed.
4. The toothpaste is ready by the sink, and after that, the dinosaur can journey off to bed.

### Proposed follow-up prompt

- Duration: 1108 ms
- Usage: promptTokenCount: 1163 | candidatesTokenCount: 91 | thoughtsTokenCount: n/a | totalTokenCount: 1254 | cachedContentTokenCount: n/a

1. The toothbrush is waiting by the sink, and soon the dinosaur will be tucked in.
2. The bathroom lights are on, and after teeth are clean, the dinosaur can go to bed.
3. Toothbrushing happens, and then the dinosaur gets a cozy spot in bed.

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

- Duration: 1178 ms
- Usage: promptTokenCount: 923 | candidatesTokenCount: 127 | thoughtsTokenCount: n/a | totalTokenCount: 1050 | cachedContentTokenCount: n/a

1. Handwashing time, then the kitchen is ready for lunch.
2. The kitchen table is set for lunch; it looks like hands might be ready for a wash first.
3. Soap and water are here, and lunch is on the kitchen counter whenever you're ready.
4. I'm heading to the kitchen with lunch; there's a good spot by the sink for washing hands before joining.

### Proposed follow-up prompt

- Duration: 1156 ms
- Usage: promptTokenCount: 1207 | candidatesTokenCount: 88 | thoughtsTokenCount: n/a | totalTokenCount: 1295 | cachedContentTokenCount: n/a

1. The kitchen table is set for lunch, right after hands are clean.
2. Handwashing helps us get ready for lunch in the kitchen.
3. There's a spot for hands at the sink, then a spot for you at the kitchen table for lunch.

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

- Duration: 1169 ms
- Usage: promptTokenCount: 896 | candidatesTokenCount: 132 | thoughtsTokenCount: n/a | totalTokenCount: 1028 | cachedContentTokenCount: n/a

1. The bathroom is ready, and it looks like pajamas are next, with a book for bedtime.
2. Pajamas and a book are looking forward to bedtime, right after a quick stop in the bathroom.
3. It seems like the bathroom, pajamas, and a good book are all part of the journey to bed tonight.
4. I wonder if we should tackle the bathroom, then pajamas, then grab a book for bed.

### Proposed follow-up prompt

- Duration: 913 ms
- Usage: promptTokenCount: 1180 | candidatesTokenCount: 89 | thoughtsTokenCount: n/a | totalTokenCount: 1269 | cachedContentTokenCount: n/a

1. The path to bed goes through the bathroom, then pajamas, then a good book.
2. Getting ready for bed involves a stop in the bathroom, pajamas, and finding a book.
3. Pajamas and a book are waiting for the bathroom part of bedtime.

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

