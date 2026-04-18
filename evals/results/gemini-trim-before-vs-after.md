# Gemini Prompt Trim Before vs After

This report compares **Gemini 2.5 Flash before prompt trimming** vs **Gemini 2.5 Flash after prompt trimming** for the same 12 evaluation cases.

Use this document when reviewing Step 5. It avoids making you compare across separate model-comparison reports.

## Token Summary

- Before trim average prompt tokens: **926**
- After trim average prompt tokens: **820**
- Average reduction: **106**

## Review Guidance

- Treat any drop in authenticity, safety, completeness, or usefulness as more important than token savings.
- Pay extra attention to Straightforward, Interest Based, Humorous, multi-part prompts, and `Get more ideas` follow-ups.
- Use [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md) while reviewing.

## default-short-transition — Default tone short transition

- Tone: Default
- Fewer Words: No
- Text: Put your shoes on.
- Review focus: Low-pressure phrasing; No disguised command language; Natural everyday wording

### Before Trim — Gemini 2.5 Flash

- Duration: 1326 ms
- Usage: promptTokenCount: 854 | candidatesTokenCount: 91 | thoughtsTokenCount: n/a | totalTokenCount: 945

1. Shoes are for putting on feet.
2. It's shoe-wearing time now.
3. Those shoes are ready to go on someone's feet.
4. I wonder if feet want shoes on them for our adventure.

### After Trim — Gemini 2.5 Flash

- Duration: 1378 ms
- Usage: promptTokenCount: 758 | candidatesTokenCount: 88 | thoughtsTokenCount: n/a | totalTokenCount: 846

1. It looks like the shoes are ready by the door.
2. The shoes are right here, waiting.
3. I wonder if shoes would be helpful now.
4. Walking outside sometimes feels nice with shoes on.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## default-multipart-dinner — Default tone multi-part dinner flow

- Tone: Default
- Fewer Words: No
- Text: Please come downstairs, wash your hands, and sit at the table for dinner.
- Review focus: Full task coverage; Environment-first framing; Authenticity without pressure

### Before Trim — Gemini 2.5 Flash

- Duration: 1344 ms
- Usage: promptTokenCount: 865 | candidatesTokenCount: 150 | thoughtsTokenCount: n/a | totalTokenCount: 1015

1. Dinner is ready on the table and the soap is by the sink, if you're feeling hungry. It might be helpful to wash hands before eating.
2. The table is set for dinner. Hand washing is often part of getting ready to eat.
3. I'm just about to head to the table for dinner; the water's running in the bathroom if anyone's ready to wash hands before joining.
4. Dinner is getting served downstairs, and clean hands are a good way to start a meal.

### After Trim — Gemini 2.5 Flash

- Duration: 1520 ms
- Usage: promptTokenCount: 769 | candidatesTokenCount: 139 | thoughtsTokenCount: n/a | totalTokenCount: 908

1. Dinner is ready on the table and there's warm water in the sink for hand washing. We can all sit down when everyone is ready.
2. The table is set for dinner. Hands usually get washed before we eat.
3. It's dinner time. The food is getting a bit cooler and the hand washing station is free.
4. I notice the kitchen table is ready. The sink is open for hand washing, then we can enjoy dinner together.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## straightforward-cleanup — Straightforward tone cleanup

- Tone: Straightforward
- Fewer Words: No
- Text: Pick up your backpack and put your lunchbox in the kitchen.
- Review focus: Plainspoken clarity; Concise but not clipped; Multi-part completeness

### Before Trim — Gemini 2.5 Flash

- Duration: 1150 ms
- Usage: promptTokenCount: 989 | candidatesTokenCount: 125 | thoughtsTokenCount: n/a | totalTokenCount: 1114

1. The backpack is still by the door and the lunchbox is in there.
2. The lunchbox needs to get to the kitchen and the backpack is here.
3. The kitchen counter is clear for the lunchbox when it's ready, and the backpack is right here.
4. I notice the backpack and the lunchbox are still out; the kitchen is the spot for the lunchbox.

### After Trim — Gemini 2.5 Flash

- Duration: 1164 ms
- Usage: promptTokenCount: 848 | candidatesTokenCount: 128 | thoughtsTokenCount: n/a | totalTokenCount: 976

1. The backpack is by the door. The lunchbox goes in the kitchen.
2. I see the lunchbox. The kitchen is ready for it. The backpack is also right there.
3. The lunchbox can find its way to the kitchen when it's ready. The backpack also needs a spot.
4. The kitchen counter is clear for the lunchbox. The backpack could go in its usual spot.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## straightforward-fewer-words — Straightforward tone with fewer words

- Tone: Straightforward
- Fewer Words: Yes
- Text: Turn off the TV and head upstairs for bath time.
- Review focus: Brevity without losing both tasks; Low emotional temperature; No bossy shortcuts

### Before Trim — Gemini 2.5 Flash

- Duration: 1123 ms
- Usage: promptTokenCount: 1013 | candidatesTokenCount: 120 | thoughtsTokenCount: n/a | totalTokenCount: 1133

1. The TV is on; bath time is coming up next.
2. It's bath time. The TV is playing, and upstairs is where the bath is.
3. Bath time is getting close. I wonder if the TV could be off, and we could go upstairs soon.
4. The TV is on, and it's almost time for a bath upstairs.

### After Trim — Gemini 2.5 Flash

- Duration: 1266 ms
- Usage: promptTokenCount: 872 | candidatesTokenCount: 124 | thoughtsTokenCount: n/a | totalTokenCount: 996

1. The TV is still on. Bath time is coming up soon upstairs.
2. The bath water can get ready upstairs when the TV is off.
3. It is almost time to switch off the TV. We can head upstairs when it is off and start getting ready for the bath.
4. There's a cozy bath waiting upstairs, and the TV will be ready to turn off soon.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## humorous-homework — Humorous tone homework start

- Tone: Humorous
- Fewer Words: No
- Text: We need to start homework before it gets too late.
- Review focus: Humor reduces pressure; No sarcasm or ridicule; Still clearly understandable

### Before Trim — Gemini 2.5 Flash

- Duration: 1713 ms
- Usage: promptTokenCount: 881 | candidatesTokenCount: 175 | thoughtsTokenCount: n/a | totalTokenCount: 1056

1. Oh no, look at that clock! It's trying to sneak past our homework window like a ninja, isn't it?
2. The homework gremlins are probably wondering if we're ever going to open their books for an adventure. And soon it will be bedtime for them!
3. It seems like the evening is playing a trick on us, zooming by at light speed. We'll want to get those homework muscles warmed up before it disappears completely!
4. I wonder if our brains are ready for some homework fun. It's getting to the point where they might decide to switch off and dream of snacks instead!

### After Trim — Gemini 2.5 Flash

- Duration: 1436 ms
- Usage: promptTokenCount: 803 | candidatesTokenCount: 155 | thoughtsTokenCount: n/a | totalTokenCount: 958

1. The homework gremlins are probably wondering if we're going to play hide-and-seek with them tonight before the moon takes over the sky!
2. Looks like the homework is still waiting for its grand debut, and soon the day will be packing up its bags for the night.
3. I wonder if the pencils are getting sleepy, waiting for us to give them something to do before bedtime stories begin.
4. Soon the stars will be out, and then it'll be extra tricky for our brains to remember numbers and letters!

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## humorous-bedtime-multipart — Humorous tone bedtime sequence

- Tone: Humorous
- Fewer Words: No
- Text: Brush your teeth, put on pajamas, and get into bed.
- Review focus: Gentle playfulness; All tasks still present; No overstimulation

### Before Trim — Gemini 2.5 Flash

- Duration: 1922 ms
- Usage: promptTokenCount: 883 | candidatesTokenCount: 203 | thoughtsTokenCount: n/a | totalTokenCount: 1086

1. Oh, look at that! It seems the teeth-brushing adventure, the cozy pajama quest, and the comfy bed mission are all waiting for us right about now. What a trio of evening fun!
2. The bathroom light is still on, and I'm spotting pajamas on the bed, which often means teeth are ready for their sparkle scrub and bodies are ready for their soft, sleepy covers.
3. I see sleepy-time things are popping up! There's a toothbrush looking lonely, pajamas lying ready, and a bed just begging to be snuggled into.
4. It looks like the day is winding down, and the evening routine items are staging a little rally: the toothbrush is calling, the pajamas are waving, and the bed is sending out sleepy signals!

### After Trim — Gemini 2.5 Flash

- Duration: 1619 ms
- Usage: promptTokenCount: 805 | candidatesTokenCount: 159 | thoughtsTokenCount: n/a | totalTokenCount: 964

1. The toothbrush seems to be calling out, 'Who's ready for a foamy adventure?' And pajamas are patiently waiting, eager to join the cozy bed party.
2. It looks like the day's last mission involves a quick tooth scrub and then transforming into a snuggle-bug for bed.
3. Oh, look! The bedtime sequence is ready for launch: teeth sparkle, pajamas appear, and then a gentle landing in bed.
4. I wonder if our teeth are feeling sleepy and our pajamas are dreaming of a soft, warm bed right about now.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## equalizing-errand — Equalizing tone errand preparation

- Tone: Equalizing
- Fewer Words: No
- Text: Get your coat and help me check if we have everything for the car.
- Review focus: Leveling without incompetence theater; Warmth and dignity; Task clarity

### Before Trim — Gemini 2.5 Flash

- Duration: 1460 ms
- Usage: promptTokenCount: 915 | candidatesTokenCount: 162 | thoughtsTokenCount: n/a | totalTokenCount: 1077

1. The coat is by the door; we could also check if we have everything for the car.
2. The car looks like it's waiting for us; it would be so helpful to double-check our supplies and grab a coat if it's chilly out there.
3. It might be time to put a coat on for outside; I'm also wondering if we have everything for the car.
4. I'm not sure if we're all ready for the car. Sometimes I forget things, and I also notice coats are often helpful when we go out.

### After Trim — Gemini 2.5 Flash

- Duration: 1665 ms
- Usage: promptTokenCount: 809 | candidatesTokenCount: 182 | thoughtsTokenCount: n/a | totalTokenCount: 991

1. The car is almost ready for our things. Our coats are on the hook, and I could use a second set of eyes to double-check that we have everything we need.
2. It's time to head out to the car. We just need to grab our coats, and then we can look together to see what else might be missing.
3. Our coats are waiting for us. I wonder if you could help me do a quick scan to make sure we have all our items for the car.
4. Getting our coats on is a good next step. After that, we can team up to check if all our things are accounted for to take to the car.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## equalizing-fewer-words — Equalizing tone shorter prompt

- Tone: Equalizing
- Fewer Words: Yes
- Text: Come look at this and tell me if I missed a step for bedtime.
- Review focus: Collaborative framing; No pressure hidden in praise; Short but natural

### Before Trim — Gemini 2.5 Flash

- Duration: 1184 ms
- Usage: promptTokenCount: 941 | candidatesTokenCount: 121 | thoughtsTokenCount: n/a | totalTokenCount: 1062

1. The bedtime checklist is ready for a second pair of eyes.
2. There might be a missed step on the bedtime chart. I wonder if you see it.
3. Bedtime steps are all laid out. It would be super helpful to get your view on them.
4. I just went through the bedtime routine. Sometimes I miss things; a fresh perspective would be great.

### After Trim — Gemini 2.5 Flash

- Duration: 1402 ms
- Usage: promptTokenCount: 835 | candidatesTokenCount: 157 | thoughtsTokenCount: n/a | totalTokenCount: 992

1. The bedtime checklist is right here, and I'm wondering if I've remembered everything or if there's a step missing.
2. It's time to check the bedtime routine. Your sharp eyes are really good at spotting details.
3. Bedtime is coming up. Sometimes I get mixed up with the steps; maybe you could help me make sure we've got them all covered.
4. We're almost ready for bedtime. This list helps me remember, and sometimes it's helpful to get a second opinion on the steps.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## interest-based-minecraft — Interest Based with explicit interest

- Tone: Interest Based
- Fewer Words: No
- Interest: Minecraft
- Text: Please put your socks on and grab your backpack so we can leave for school.
- Review focus: Interest integration feels natural; No gimmicky overload; Full task coverage

### Before Trim — Gemini 2.5 Flash

- Duration: 1433 ms
- Usage: promptTokenCount: 919 | candidatesTokenCount: 158 | thoughtsTokenCount: n/a | totalTokenCount: 1077

1. Socks are waiting to be equipped for our adventure, and the backpack is ready to be loaded up with supplies. The portal to school will open soon.
2. Our school mission is about to begin. It's time for some armor and our inventory pack before we can teleport.
3. I wonder if we could get geared up with socks and the backpack for school, like preparing for a big building project.
4. The clock is ticking down to school departure. Those socks look like they're ready for action, and the backpack is looking quite empty.

### After Trim — Gemini 2.5 Flash

- Duration: 2009 ms
- Usage: promptTokenCount: 806 | candidatesTokenCount: 178 | thoughtsTokenCount: n/a | totalTokenCount: 984

1. The school day is starting soon. Socks and backpacks are part of getting ready for an adventure, kind of like gathering supplies before exploring a new Minecraft biome.
2. It looks like a good day for school. The socks are over here, and the backpack is ready for its items to be collected, like finding treasures in a chest.
3. Socks go on feet, and the backpack gets picked up when it's time to head out for school. I wonder what we'll build today.
4. Our leaving time for school is getting closer. The socks are ready for feet, and the backpack is waiting, just like tools are ready for crafting.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## interest-based-pokemon-fewer — Interest Based with fewer words

- Tone: Interest Based
- Fewer Words: Yes
- Interest: Pokemon
- Text: Wash your hands and come to the kitchen for lunch.
- Review focus: Compact but complete; Interest remains supportive; No hype that overwhelms meaning

### Before Trim — Gemini 2.5 Flash

- Duration: 1555 ms
- Usage: promptTokenCount: 940 | candidatesTokenCount: 165 | thoughtsTokenCount: n/a | totalTokenCount: 1105

1. Lunch is ready in the kitchen, and it looks like it's time to power up by washing our hands for a Pokémon trainer's feast!
2. The kitchen has lunch waiting, and hands could use a quick Potion to get them clean before we enjoy it.
3. I see the kitchen table is set for lunch, and it's a good time to make sure our hands are squeaky clean for our meal, just like a Pokémon getting ready for battle.
4. The scent of lunch is wafting from the kitchen, and clean hands help us enjoy all the delicious flavors.

### After Trim — Gemini 2.5 Flash

- Duration: 1656 ms
- Usage: promptTokenCount: 827 | candidatesTokenCount: 170 | thoughtsTokenCount: n/a | totalTokenCount: 997

1. The water is running for handwashing. Then it's lunchtime in the kitchen. I wonder what kind of Pokémon would enjoy this meal.
2. Handwashing first, then the kitchen for lunch. There's a spot waiting like a Poké Ball for a hungry trainer.
3. It looks like the kitchen table is set, and a lunch adventure is about to begin. It's often helpful to wash hands before gathering at the table.
4. Lunch is ready in the kitchen, and it’s usually nice to have clean hands for eating. I'm imagining a Snorlax ready for a good meal.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## generate-more-follow-up — Generate more follow-up case

- Tone: Default
- Fewer Words: No
- Text: Get your shoes on and come to the car.
- Existing translations in prompt: 4
- Review focus: Distinct follow-up ideas; No repeated wording; Still low-pressure

### Before Trim — Gemini 2.5 Flash

- Duration: 1262 ms
- Usage: promptTokenCount: 922 | candidatesTokenCount: 121 | thoughtsTokenCount: n/a | totalTokenCount: 1043

1. The shoes are right by the door, and the car will be ready for us when you are.
2. Our adventure to the store involves shoes and then joining me in the car.
3. The car door opens with a click, after shoes are on and we step outside.
4. It's time to put shoes on; then we can head to the car together.

### After Trim — Gemini 2.5 Flash

- Duration: 1240 ms
- Usage: promptTokenCount: 826 | candidatesTokenCount: 123 | thoughtsTokenCount: n/a | totalTokenCount: 949

1. The shoes are right by the door, and the car will be waiting when we're ready.
2. It's time for shoes, then we can head out to the car.
3. The car ride is next on the plan, and shoes help us get there.
4. We're almost ready for our adventure in the car; shoes are usually part of the routine.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

## generate-more-interest-follow-up — Generate more follow-up with interest

- Tone: Interest Based
- Fewer Words: No
- Interest: Dinosaurs
- Text: Please come to the bathroom, brush your teeth, and bring your dinosaur to bed.
- Existing translations in prompt: 4
- Review focus: Follow-up distinctness; Interest stays grounded; Multi-part fidelity

### Before Trim — Gemini 2.5 Flash

- Duration: 1358 ms
- Usage: promptTokenCount: 992 | candidatesTokenCount: 166 | thoughtsTokenCount: n/a | totalTokenCount: 1158

1. The water is running for tooth-brushing time, and then the dinosaur will be ready for its nightly journey to bed.
2. Toothpaste is on the counter for the nightly tooth scrub, and the dinosaur seems to be waiting for its ride to dreamland.
3. I notice the toothbrush is out, and the dinosaur looks like it's getting ready to find its cozy spot in bed when the teeth are all clean.
4. The bathroom lights are on, and the tooth-brushing adventure is about to begin, then it's off to bed for a deep sleep for the dinosaur.

### After Trim — Gemini 2.5 Flash

- Duration: 1190 ms
- Usage: promptTokenCount: 879 | candidatesTokenCount: 131 | thoughtsTokenCount: n/a | totalTokenCount: 1010

1. The bathroom light is on, and toothbrushes are waiting, then the dinosaur can go to bed.
2. It's time to get ready for bed. There are toothbrushes by the sink, and then the dinosaur can get tucked in too.
3. Toothbrushing happens next, and the dinosaur seems ready for bed after that.
4. I wonder if the dinosaur wants to help with brushing teeth before heading to bed.

### Human Review Notes

```txt
Prompt verdict:
- Before trim: 
- After trim: 

What improved after trim:
- 

What got worse after trim:
- 

Risks or regressions:
- 

Decision for this prompt:
- Keep trim / Partially restore wording / Revert trim
```

