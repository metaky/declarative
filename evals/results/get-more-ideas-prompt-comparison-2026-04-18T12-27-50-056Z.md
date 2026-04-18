# Get More Ideas Prompt Comparison

Generated: 2026-04-18T12-27-50-056Z

This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.

## Token Summary

- Current prompt average prompt tokens: **881**
- Proposed prompt average prompt tokens: **1243**
- Average difference: **362**

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

- Duration: 2795 ms
- Usage: promptTokenCount: 826 | candidatesTokenCount: 113 | thoughtsTokenCount: n/a | totalTokenCount: 939 | cachedContentTokenCount: 790

1. It's time for shoes, then the car is the next stop on our adventure.
2. The shoes are here, and the car is waiting for us out front.
3. Shoes go on feet, then it's off to the car we go.
4. I'm thinking about shoes and then heading to the car.

### Proposed follow-up prompt

- Duration: 1109 ms
- Usage: promptTokenCount: 1188 | candidatesTokenCount: 113 | thoughtsTokenCount: n/a | totalTokenCount: 1301 | cachedContentTokenCount: n/a

1. The shoes are by the door, and the car will be there for us.
2. From here, it's shoes, and then we're off to the car.
3. Shoe-putting-on seems like a good step before the car ride.
4. Getting shoes on helps us get out to the car easily.

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

- Duration: 1287 ms
- Usage: promptTokenCount: 879 | candidatesTokenCount: 142 | thoughtsTokenCount: n/a | totalTokenCount: 1021 | cachedContentTokenCount: n/a

1. The bathroom light is on, and toothbrushes are waiting. A dinosaur friend could join the trip to bed after that.
2. Toothbrushing is part of our routine before bed. A dinosaur might be thinking about its cozy spot for the night, too.
3. It's time for teeth to get sparkly clean. Then the dinosaur can be tucked in for sleepy time.
4. I wonder if the dinosaur wants to watch teeth get brushed before heading to its comfy bed spot.

### Proposed follow-up prompt

- Duration: 1231 ms
- Usage: promptTokenCount: 1241 | candidatesTokenCount: 129 | thoughtsTokenCount: n/a | totalTokenCount: 1370 | cachedContentTokenCount: 855

1. The toothbrush is waiting by the sink, and then the dinosaur can be ready for the bed adventure.
2. Getting to the bathroom leads to brushing teeth, then the dinosaur can join you for bedtime.
3. There's room for the dinosaur to wait outside the bathroom while teeth are being brushed, then off to bed.
4. It works well when teeth get brushed in the bathroom before the dinosaur goes to bed.

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

- Duration: 1241 ms
- Usage: promptTokenCount: 923 | candidatesTokenCount: 116 | thoughtsTokenCount: n/a | totalTokenCount: 1039 | cachedContentTokenCount: 809

1. Handwashing comes before lunch. The kitchen is ready when you are.
2. The kitchen table is set for lunch. Time to take care of hands first.
3. Lunch is on the table! It's usually nice to wash hands before eating.
4. The kitchen smells wonderful! It looks like handwashing would be a good step before joining.

### Proposed follow-up prompt

- Duration: 1467 ms
- Usage: promptTokenCount: 1285 | candidatesTokenCount: 108 | thoughtsTokenCount: n/a | totalTokenCount: 1393 | cachedContentTokenCount: 860

1. The soap and water are there for hands, and then the kitchen for lunch.
2. From the sink to the kitchen is the path for lunch.
3. There are towels available for clean hands, then the kitchen table is set for lunch.
4. Clean hands make sense before we enjoy lunch in the kitchen.

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

- Duration: 1176 ms
- Usage: promptTokenCount: 896 | candidatesTokenCount: 133 | thoughtsTokenCount: n/a | totalTokenCount: 1029 | cachedContentTokenCount: n/a

1. It's time for the bedtime routine; bathroom, pajamas, and a book for bed are next on the list.
2. The bathroom is ready, pajamas are waiting, and your book is eager for a bedtime read.
3. I wonder if we should start with the bathroom, or pajamas, before we grab a book for bed.
4. Getting ready for bed means the bathroom, then pajamas, and choosing a book to read.

### Proposed follow-up prompt

- Duration: 1351 ms
- Usage: promptTokenCount: 1258 | candidatesTokenCount: 124 | thoughtsTokenCount: n/a | totalTokenCount: 1382 | cachedContentTokenCount: n/a

1. The bathroom light is on, and pajamas plus a book are waiting for the journey to bed.
2. A little path leads from the bathroom to pajamas, then to finding a book for bed.
3. Getting the pajamas on can happen right after the bathroom, before taking a book to bed.
4. Bedtime usually flows from the bathroom, to pajamas, then to picking out a book.

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

