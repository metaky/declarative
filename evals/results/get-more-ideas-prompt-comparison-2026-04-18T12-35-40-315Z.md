# Get More Ideas Prompt Comparison

Generated: 2026-04-18T12-35-40-315Z

This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.

## Token Summary

- Current prompt average prompt tokens: **946**
- Proposed prompt average prompt tokens: **1243**
- Average difference: **297**

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

- Duration: 1534 ms
- Usage: promptTokenCount: 891 | candidatesTokenCount: 145 | thoughtsTokenCount: n/a | totalTokenCount: 1036 | cachedContentTokenCount: n/a

1. The car is waiting in the driveway. It'll be nice to have shoes on for walking out to it.
2. Shoes are on the floor by the door. That's usually the step before heading out to the car.
3. The car is all ready for us. Getting our shoes on often makes the trip to the car much comfier.
4. There's a car ride coming up. It's often helpful to have shoes on before we go out to the car.

### Proposed follow-up prompt

- Duration: 2053 ms
- Usage: promptTokenCount: 1188 | candidatesTokenCount: 107 | thoughtsTokenCount: n/a | totalTokenCount: 1295 | cachedContentTokenCount: n/a

1. The shoes are by the door, and the car will be there for us when we're ready.
2. After shoes, the path leads right to the car.
3. Getting the shoes on helps with heading out to the car.
4. Being in shoes makes the walk to the car more comfortable.

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

- Duration: 1382 ms
- Usage: promptTokenCount: 942 | candidatesTokenCount: 144 | thoughtsTokenCount: n/a | totalTokenCount: 1086 | cachedContentTokenCount: n/a

1. The bathroom light is on, and the toothbrush is waiting. Your dinosaur looks ready for a final adventure before bed.
2. Getting our teeth sparkly clean is often part of the routine, and then the dinosaur gets to lead the way to bed.
3. There's a dinosaur ready for a sleep migration, and some teeth that might appreciate a brush-up first.
4. Some people like to visit the bathroom to brush their teeth, and then their dinosaur joins them for a cozy sleep.

### Proposed follow-up prompt

- Duration: 1221 ms
- Usage: promptTokenCount: 1241 | candidatesTokenCount: 121 | thoughtsTokenCount: n/a | totalTokenCount: 1362 | cachedContentTokenCount: n/a

1. The toothbrush is waiting by the sink, and then the dinosaur can be tucked into bed.
2. Taking care of teeth is the step before the dinosaur's journey to bed.
3. There are some fresh towels if the dinosaur wants to watch teeth-brushing from the counter.
4. The day winds down with teeth, and the dinosaur finds its spot in bed afterward.

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

- Duration: 1338 ms
- Usage: promptTokenCount: 1003 | candidatesTokenCount: 109 | thoughtsTokenCount: n/a | totalTokenCount: 1112 | cachedContentTokenCount: n/a

1. The sink area is open, and lunch is waiting in the kitchen.
2. Handwashing first, then the kitchen for lunch.
3. The kitchen has lunch, and hands need a wash before we eat.
4. The lunch things are in the kitchen, and it’s a good idea to wash hands first.

### Proposed follow-up prompt

- Duration: 1414 ms
- Usage: promptTokenCount: 1285 | candidatesTokenCount: 97 | thoughtsTokenCount: n/a | totalTokenCount: 1382 | cachedContentTokenCount: 860

1. The soap is out, and the kitchen table is set for lunch.
2. The path to lunch goes through the handwashing station.
3. Getting hands clean helps everything feel good for lunch.
4. Handwashing and kitchen time go together for lunch today.

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

- Duration: 1461 ms
- Usage: promptTokenCount: 949 | candidatesTokenCount: 167 | thoughtsTokenCount: n/a | totalTokenCount: 1116 | cachedContentTokenCount: n/a

1. The bathroom is free for getting ready. Pajamas are on the bed, and your book is there too, whenever you're ready to head in that direction.
2. Looks like the path to bed goes past the bathroom for a quick stop, and then pajamas and a book are waiting for you there.
3. Getting to bed involves a quick visit to the bathroom, and then pajamas and a story book for settling in.
4. I'm figuring out the smoothest way from here to the bathroom, then getting pajamas on, and grabbing a book for bed. Any brilliant ideas from your side?

### Proposed follow-up prompt

- Duration: 1296 ms
- Usage: promptTokenCount: 1258 | candidatesTokenCount: 131 | thoughtsTokenCount: n/a | totalTokenCount: 1389 | cachedContentTokenCount: n/a

1. The bathroom light is on, and pajamas are laid out, ready for you to pick a book for bed.
2. Moving from the bathroom to pajamas, then finding a book, will lead right to bed.
3. There are some fresh pajamas in the bathroom if you'd like to choose a story to bring to bed.
4. The bathroom, pajamas, and a good book usually help make going to bed feel complete.

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

