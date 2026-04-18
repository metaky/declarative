# Get More Ideas Prompt Comparison

Generated: 2026-04-18T12-23-45-951Z

This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.

## Token Summary

- Current prompt average prompt tokens: **881**
- Proposed prompt average prompt tokens: **1025**
- Average difference: **144**

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

- Duration: 1480 ms
- Usage: promptTokenCount: 826 | candidatesTokenCount: 115 | thoughtsTokenCount: n/a | totalTokenCount: 941 | cachedContentTokenCount: n/a

1. The shoes are here by the door; the car is outside ready for our trip.
2. Shoes are usually a good idea for going out to the car.
3. The car ride is happening soon; shoes are often part of getting to the car safely.
4. I wonder if shoes feel like a good plan before heading out to the car.

### Proposed follow-up prompt

- Duration: 1100 ms
- Usage: promptTokenCount: 970 | candidatesTokenCount: 95 | thoughtsTokenCount: n/a | totalTokenCount: 1065 | cachedContentTokenCount: n/a

1. Outdoor adventures usually include shoes, and the car is waiting.
2. Heading out to the car sometimes involves shoes.
3. Shoes are often a step before getting in the car.
4. The car ride is happening soon; shoes help with that.

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

- Duration: 1398 ms
- Usage: promptTokenCount: 879 | candidatesTokenCount: 149 | thoughtsTokenCount: n/a | totalTokenCount: 1028 | cachedContentTokenCount: n/a

1. The bathroom light is on, and toothbrushes are waiting. A dinosaur friend can certainly join for story time in bed right after.
2. Toothbrush time is here for clean teeth. Then it's time for the dinosaur to snuggle up in bed.
3. It's time for teeth to get sparkly in the bathroom. The dinosaur will be so cozy in bed once that's all done.
4. The toothpaste is out for brushing. After that, it's off to bed with the dinosaur.

### Proposed follow-up prompt

- Duration: 1254 ms
- Usage: promptTokenCount: 1023 | candidatesTokenCount: 130 | thoughtsTokenCount: n/a | totalTokenCount: 1153 | cachedContentTokenCount: n/a

1. Toothbrushing happens next, and the dinosaur's cozy bed awaits for after.
2. The bathroom light is on, and the dinosaur will be ready for bed once teeth are sparkling.
3. It's time for some tooth-brushing action, and the dinosaur can join for story time in bed right after.
4. The toothpaste is out, and the dinosaur can snuggle into bed once teeth are brushed.

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

- Duration: 1168 ms
- Usage: promptTokenCount: 923 | candidatesTokenCount: 119 | thoughtsTokenCount: n/a | totalTokenCount: 1042 | cachedContentTokenCount: n/a

1. Handwashing usually happens before lunch. Lunch is ready in the kitchen.
2. The kitchen table is set for lunch. Handwashing is often a good first step.
3. I'm heading to the kitchen with lunch. Handwashing often feels good before eating.
4. It's time to get ready for lunch in the kitchen. Handwashing comes before that.

### Proposed follow-up prompt

- Duration: 1090 ms
- Usage: promptTokenCount: 1067 | candidatesTokenCount: 107 | thoughtsTokenCount: n/a | totalTokenCount: 1174 | cachedContentTokenCount: n/a

1. The water is running for handwashing, and then lunch is in the kitchen.
2. Handwashing is complete, and the kitchen is ready for lunch.
3. Handwashing first, and then the kitchen is where lunch will be.
4. It is handwashing time, and then the kitchen for lunch.

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

- Duration: 1153 ms
- Usage: promptTokenCount: 896 | candidatesTokenCount: 126 | thoughtsTokenCount: n/a | totalTokenCount: 1022 | cachedContentTokenCount: n/a

1. Bathroom time, pajamas, and a story seem to be next on the bedtime path.
2. The pajamas and a book are ready for our bedtime routine after the bathroom visit.
3. I'm thinking bathroom, then pajamas, and we can choose a book for bed.
4. Bedtime is approaching, and it involves a stop at the bathroom, getting into pajamas, and finding a favorite book.

### Proposed follow-up prompt

- Duration: 1156 ms
- Usage: promptTokenCount: 1040 | candidatesTokenCount: 122 | thoughtsTokenCount: n/a | totalTokenCount: 1162 | cachedContentTokenCount: n/a

1. The bathroom is ready, and then pajamas are next before a book in bed.
2. Time for a bathroom stop, then finding pajamas, and picking a book for bed.
3. All the bedtime things are happening: bathroom, pajamas, and a book to read in bed.
4. I'm just thinking about the bedtime sequence: bathroom, pajamas, and book for bed.

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

