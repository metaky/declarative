# Gemini Model Comparison Report

Generated: 2026-04-18T12-02-46-754Z

This report is designed for human review. Use it alongside `evals/gemini-quality-rubric.md` and be critical of any output that becomes less authentic, less complete, less safe, or less useful even if it is cheaper.

Review instructions:
- Read each prompt pair side by side before deciding.
- Check the blocking criteria in the rubric first.
- Treat any regression in safety, authenticity, or multi-part coverage as a blocker.
- Add your own notes directly under each prompt section or in a copied review document.

## default-short-transition — Default tone short transition

- Tone: Default
- Fewer Words: No
- Text: Put your shoes on.
- Review focus: Low-pressure phrasing; No disguised command language; Natural everyday wording

### Gemini 2.5 Flash

- Duration: 1378 ms
- Usage: promptTokenCount: 758 | candidatesTokenCount: 88 | thoughtsTokenCount: n/a | totalTokenCount: 846 | cachedContentTokenCount: n/a

1. It looks like the shoes are ready by the door.
2. The shoes are right here, waiting.
3. I wonder if shoes would be helpful now.
4. Walking outside sometimes feels nice with shoes on.

### Gemini 2.5 Flash-Lite

- Duration: 1496 ms
- Usage: promptTokenCount: 758 | candidatesTokenCount: 100 | thoughtsTokenCount: n/a | totalTokenCount: 858 | cachedContentTokenCount: n/a

1. The shoes are by the door, ready for putting on.
2. It looks like it's time to put on our shoes.
3. I wonder if putting on shoes is the next step before going out.
4. The shoes are right here, waiting for feet.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## default-multipart-dinner — Default tone multi-part dinner flow

- Tone: Default
- Fewer Words: No
- Text: Please come downstairs, wash your hands, and sit at the table for dinner.
- Review focus: Full task coverage; Environment-first framing; Authenticity without pressure

### Gemini 2.5 Flash

- Duration: 1520 ms
- Usage: promptTokenCount: 769 | candidatesTokenCount: 139 | thoughtsTokenCount: n/a | totalTokenCount: 908 | cachedContentTokenCount: n/a

1. Dinner is ready on the table and there's warm water in the sink for hand washing. We can all sit down when everyone is ready.
2. The table is set for dinner. Hands usually get washed before we eat.
3. It's dinner time. The food is getting a bit cooler and the hand washing station is free.
4. I notice the kitchen table is ready. The sink is open for hand washing, then we can enjoy dinner together.

### Gemini 2.5 Flash-Lite

- Duration: 1104 ms
- Usage: promptTokenCount: 769 | candidatesTokenCount: 140 | thoughtsTokenCount: n/a | totalTokenCount: 909 | cachedContentTokenCount: n/a

1. The kitchen is ready for dinner, with plates and food on the table. Downstairs is quiet, and the sink is ready for handwashing.
2. Dinner is on the table. I wonder if it's time to wash hands and join everyone.
3. The table is set and the meal is waiting downstairs. There's soap and water by the sink when you're ready.
4. Dinner is served downstairs. We can wash hands first if that works.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## straightforward-cleanup — Straightforward tone cleanup

- Tone: Straightforward
- Fewer Words: No
- Text: Pick up your backpack and put your lunchbox in the kitchen.
- Review focus: Plainspoken clarity; Concise but not clipped; Multi-part completeness

### Gemini 2.5 Flash

- Duration: 1164 ms
- Usage: promptTokenCount: 848 | candidatesTokenCount: 128 | thoughtsTokenCount: n/a | totalTokenCount: 976 | cachedContentTokenCount: n/a

1. The backpack is by the door. The lunchbox goes in the kitchen.
2. I see the lunchbox. The kitchen is ready for it. The backpack is also right there.
3. The lunchbox can find its way to the kitchen when it's ready. The backpack also needs a spot.
4. The kitchen counter is clear for the lunchbox. The backpack could go in its usual spot.

### Gemini 2.5 Flash-Lite

- Duration: 1234 ms
- Usage: promptTokenCount: 848 | candidatesTokenCount: 137 | thoughtsTokenCount: n/a | totalTokenCount: 985 | cachedContentTokenCount: n/a

1. The backpack is by the door. The kitchen is waiting for the lunchbox.
2. There's a backpack ready to be picked up. And the lunchbox can find its place in the kitchen.
3. Backpacks and lunchboxes are part of our routine before leaving. I wonder if the backpack can be gathered and the lunchbox can be placed in the kitchen.
4. The backpack is here. The lunchbox has a destination in the kitchen.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## straightforward-fewer-words — Straightforward tone with fewer words

- Tone: Straightforward
- Fewer Words: Yes
- Text: Turn off the TV and head upstairs for bath time.
- Review focus: Brevity without losing both tasks; Low emotional temperature; No bossy shortcuts

### Gemini 2.5 Flash

- Duration: 1266 ms
- Usage: promptTokenCount: 872 | candidatesTokenCount: 124 | thoughtsTokenCount: n/a | totalTokenCount: 996 | cachedContentTokenCount: n/a

1. The TV is still on. Bath time is coming up soon upstairs.
2. The bath water can get ready upstairs when the TV is off.
3. It is almost time to switch off the TV. We can head upstairs when it is off and start getting ready for the bath.
4. There's a cozy bath waiting upstairs, and the TV will be ready to turn off soon.

### Gemini 2.5 Flash-Lite

- Duration: 977 ms
- Usage: promptTokenCount: 872 | candidatesTokenCount: 119 | thoughtsTokenCount: n/a | totalTokenCount: 991 | cachedContentTokenCount: n/a

1. The TV is on, and the bath is ready upstairs.
2. It looks like the TV has been on for a while, and the water for the bath is running.
3. The screen is showing moving pictures, and the bathroom upstairs is set up for bath time.
4. This time of evening often involves turning off the screen and heading upstairs for a bath.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## humorous-homework — Humorous tone homework start

- Tone: Humorous
- Fewer Words: No
- Text: We need to start homework before it gets too late.
- Review focus: Humor reduces pressure; No sarcasm or ridicule; Still clearly understandable

### Gemini 2.5 Flash

- Duration: 1436 ms
- Usage: promptTokenCount: 803 | candidatesTokenCount: 155 | thoughtsTokenCount: n/a | totalTokenCount: 958 | cachedContentTokenCount: n/a

1. The homework gremlins are probably wondering if we're going to play hide-and-seek with them tonight before the moon takes over the sky!
2. Looks like the homework is still waiting for its grand debut, and soon the day will be packing up its bags for the night.
3. I wonder if the pencils are getting sleepy, waiting for us to give them something to do before bedtime stories begin.
4. Soon the stars will be out, and then it'll be extra tricky for our brains to remember numbers and letters!

### Gemini 2.5 Flash-Lite

- Duration: 1317 ms
- Usage: promptTokenCount: 803 | candidatesTokenCount: 194 | thoughtsTokenCount: n/a | totalTokenCount: 997 | cachedContentTokenCount: n/a

1. The clock hands are doing a little race, and homework is on the starting line, waiting for some brain power to zoom through it.
2. Look at this! The homework papers seem to be practicing their 'stay still' skills. I wonder if we can coax them into showing us what they know before the sun decides to go on strike for the night.
3. This pile of books looks like it's about to sprout legs and walk away if we don't give it some attention soon. Let's see if we can outsmart it before bedtime declares victory.
4. The homework dragon is stirring! If we feed it some knowledge now, maybe it won't breathe fire later. We could sneak up on it together.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## humorous-bedtime-multipart — Humorous tone bedtime sequence

- Tone: Humorous
- Fewer Words: No
- Text: Brush your teeth, put on pajamas, and get into bed.
- Review focus: Gentle playfulness; All tasks still present; No overstimulation

### Gemini 2.5 Flash

- Duration: 1619 ms
- Usage: promptTokenCount: 805 | candidatesTokenCount: 159 | thoughtsTokenCount: n/a | totalTokenCount: 964 | cachedContentTokenCount: n/a

1. The toothbrush seems to be calling out, 'Who's ready for a foamy adventure?' And pajamas are patiently waiting, eager to join the cozy bed party.
2. It looks like the day's last mission involves a quick tooth scrub and then transforming into a snuggle-bug for bed.
3. Oh, look! The bedtime sequence is ready for launch: teeth sparkle, pajamas appear, and then a gentle landing in bed.
4. I wonder if our teeth are feeling sleepy and our pajamas are dreaming of a soft, warm bed right about now.

### Gemini 2.5 Flash-Lite

- Duration: 1359 ms
- Usage: promptTokenCount: 805 | candidatesTokenCount: 208 | thoughtsTokenCount: n/a | totalTokenCount: 1013 | cachedContentTokenCount: n/a

1. The toothbrushes are lined up, like sleepy little soldiers ready for their nightly patrol! And over here, the pajama portal is open, beckoning us towards dreamland. The bed is a fluffy cloud waiting for its next passenger.
2. A great tooth-brushing adventure awaits! After that, we can unlock the secret level of putting on pajamas, and then, the final boss: climbing into the cozy bed.
3. I notice the moon is doing its nighttime glow thing outside. Inside, the toothbrushes are calling for a bubbly clean-up, the pajamas are folded neatly, and the bed looks like a perfectly soft landing zone.
4. Prepare for a three-part mission: Operation Sparkle Teeth, followed by the Great Pajama Transformation, and concluding with Mission: Cozy Bed Snuggle.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## equalizing-errand — Equalizing tone errand preparation

- Tone: Equalizing
- Fewer Words: No
- Text: Get your coat and help me check if we have everything for the car.
- Review focus: Leveling without incompetence theater; Warmth and dignity; Task clarity

### Gemini 2.5 Flash

- Duration: 1665 ms
- Usage: promptTokenCount: 809 | candidatesTokenCount: 182 | thoughtsTokenCount: n/a | totalTokenCount: 991 | cachedContentTokenCount: n/a

1. The car is almost ready for our things. Our coats are on the hook, and I could use a second set of eyes to double-check that we have everything we need.
2. It's time to head out to the car. We just need to grab our coats, and then we can look together to see what else might be missing.
3. Our coats are waiting for us. I wonder if you could help me do a quick scan to make sure we have all our items for the car.
4. Getting our coats on is a good next step. After that, we can team up to check if all our things are accounted for to take to the car.

### Gemini 2.5 Flash-Lite

- Duration: 1088 ms
- Usage: promptTokenCount: 809 | candidatesTokenCount: 112 | thoughtsTokenCount: n/a | totalTokenCount: 921 | cachedContentTokenCount: n/a

1. The coats are by the door, and the car is waiting.
2. It looks like we're getting ready to head out in the car.
3. I'm wondering if we've got all our things together for the car trip.
4. The weather outside looks like it calls for a coat for our car ride.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## equalizing-fewer-words — Equalizing tone shorter prompt

- Tone: Equalizing
- Fewer Words: Yes
- Text: Come look at this and tell me if I missed a step for bedtime.
- Review focus: Collaborative framing; No pressure hidden in praise; Short but natural

### Gemini 2.5 Flash

- Duration: 1402 ms
- Usage: promptTokenCount: 835 | candidatesTokenCount: 157 | thoughtsTokenCount: n/a | totalTokenCount: 992 | cachedContentTokenCount: n/a

1. The bedtime checklist is right here, and I'm wondering if I've remembered everything or if there's a step missing.
2. It's time to check the bedtime routine. Your sharp eyes are really good at spotting details.
3. Bedtime is coming up. Sometimes I get mixed up with the steps; maybe you could help me make sure we've got them all covered.
4. We're almost ready for bedtime. This list helps me remember, and sometimes it's helpful to get a second opinion on the steps.

### Gemini 2.5 Flash-Lite

- Duration: 1401 ms
- Usage: promptTokenCount: 835 | candidatesTokenCount: 153 | thoughtsTokenCount: n/a | totalTokenCount: 988 | cachedContentTokenCount: n/a

1. The bedtime routine is getting underway. I'm wondering if we've covered all the steps together.
2. This is the last part of the bedtime routine. Could you take a look and see if anything seems to be missing?
3. It looks like we're at the end of the bedtime steps. Can you help me double-check that we didn't miss anything?
4. The bedtime sequence is laid out here. I'm curious to get your eyes on it to see if it matches what we usually do.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## interest-based-minecraft — Interest Based with explicit interest

- Tone: Interest Based
- Fewer Words: No
- Interest: Minecraft
- Text: Please put your socks on and grab your backpack so we can leave for school.
- Review focus: Interest integration feels natural; No gimmicky overload; Full task coverage

### Gemini 2.5 Flash

- Duration: 2009 ms
- Usage: promptTokenCount: 806 | candidatesTokenCount: 178 | thoughtsTokenCount: n/a | totalTokenCount: 984 | cachedContentTokenCount: n/a

1. The school day is starting soon. Socks and backpacks are part of getting ready for an adventure, kind of like gathering supplies before exploring a new Minecraft biome.
2. It looks like a good day for school. The socks are over here, and the backpack is ready for its items to be collected, like finding treasures in a chest.
3. Socks go on feet, and the backpack gets picked up when it's time to head out for school. I wonder what we'll build today.
4. Our leaving time for school is getting closer. The socks are ready for feet, and the backpack is waiting, just like tools are ready for crafting.

### Gemini 2.5 Flash-Lite

- Duration: 2055 ms
- Usage: promptTokenCount: 806 | candidatesTokenCount: 223 | thoughtsTokenCount: n/a | totalTokenCount: 1029 | cachedContentTokenCount: n/a

1. The sun is starting to peek over the Minecraft mountains, and it looks like a good morning to get ready for school. The backpack is waiting by the door, ready for adventure, and the socks are here too. I wonder if the socks are like the ones from the 'Cozy Caves' update.
2. It's almost time for the school day adventure to begin! We have socks here and the backpack is packed and ready to go, like a chest full of supplies for exploring.
3. The school day is calling! The socks are on the floor, and the backpack is waiting by the door, perhaps filled with maps for new biomes to discover.
4. I notice the backpack is ready for school, and the socks are nearby. It might be a good moment to get those on so we're all set for the journey, like setting off on a quest.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## interest-based-pokemon-fewer — Interest Based with fewer words

- Tone: Interest Based
- Fewer Words: Yes
- Interest: Pokemon
- Text: Wash your hands and come to the kitchen for lunch.
- Review focus: Compact but complete; Interest remains supportive; No hype that overwhelms meaning

### Gemini 2.5 Flash

- Duration: 1656 ms
- Usage: promptTokenCount: 827 | candidatesTokenCount: 170 | thoughtsTokenCount: n/a | totalTokenCount: 997 | cachedContentTokenCount: n/a

1. The water is running for handwashing. Then it's lunchtime in the kitchen. I wonder what kind of Pokémon would enjoy this meal.
2. Handwashing first, then the kitchen for lunch. There's a spot waiting like a Poké Ball for a hungry trainer.
3. It looks like the kitchen table is set, and a lunch adventure is about to begin. It's often helpful to wash hands before gathering at the table.
4. Lunch is ready in the kitchen, and it’s usually nice to have clean hands for eating. I'm imagining a Snorlax ready for a good meal.

### Gemini 2.5 Flash-Lite

- Duration: 1313 ms
- Usage: promptTokenCount: 827 | candidatesTokenCount: 161 | thoughtsTokenCount: n/a | totalTokenCount: 988 | cachedContentTokenCount: n/a

1. The sink is ready for washing, and lunch is waiting in the kitchen, just like preparing for a new Pokemon adventure.
2. The water is running for handwashing, and the kitchen smells like a delicious meal is ready, almost like a trainer preparing their Pokemon for battle.
3. Hands can be washed, and then the kitchen is the next stop for lunch, a bit like heading to the Pokemon Center after a journey.
4. I wonder if washing hands could be a quick training session before we head to the kitchen for lunch, maybe we can spot some kitchen Pokemon there!

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## generate-more-follow-up — Generate more follow-up case

- Tone: Default
- Fewer Words: No
- Text: Get your shoes on and come to the car.
- Existing translations in prompt: 4
- Review focus: Distinct follow-up ideas; No repeated wording; Still low-pressure

### Gemini 2.5 Flash

- Duration: 1240 ms
- Usage: promptTokenCount: 826 | candidatesTokenCount: 123 | thoughtsTokenCount: n/a | totalTokenCount: 949 | cachedContentTokenCount: n/a

1. The shoes are right by the door, and the car will be waiting when we're ready.
2. It's time for shoes, then we can head out to the car.
3. The car ride is next on the plan, and shoes help us get there.
4. We're almost ready for our adventure in the car; shoes are usually part of the routine.

### Gemini 2.5 Flash-Lite

- Duration: 2437 ms
- Usage: promptTokenCount: 826 | candidatesTokenCount: 123 | thoughtsTokenCount: n/a | totalTokenCount: 949 | cachedContentTokenCount: n/a

1. The shoes are by the door, and the car is outside when we're ready to head out.
2. There's a trip to the car waiting for us, and shoes are part of that journey.
3. It looks like shoes are the next step before we transition to the car.
4. The door is open, and the car is waiting for us to join it.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

## generate-more-interest-follow-up — Generate more follow-up with interest

- Tone: Interest Based
- Fewer Words: No
- Interest: Dinosaurs
- Text: Please come to the bathroom, brush your teeth, and bring your dinosaur to bed.
- Existing translations in prompt: 4
- Review focus: Follow-up distinctness; Interest stays grounded; Multi-part fidelity

### Gemini 2.5 Flash

- Duration: 1190 ms
- Usage: promptTokenCount: 879 | candidatesTokenCount: 131 | thoughtsTokenCount: n/a | totalTokenCount: 1010 | cachedContentTokenCount: n/a

1. The bathroom light is on, and toothbrushes are waiting, then the dinosaur can go to bed.
2. It's time to get ready for bed. There are toothbrushes by the sink, and then the dinosaur can get tucked in too.
3. Toothbrushing happens next, and the dinosaur seems ready for bed after that.
4. I wonder if the dinosaur wants to help with brushing teeth before heading to bed.

### Gemini 2.5 Flash-Lite

- Duration: 4183 ms
- Usage: promptTokenCount: 879 | candidatesTokenCount: 151 | thoughtsTokenCount: n/a | totalTokenCount: 1030 | cachedContentTokenCount: n/a

1. The bathroom sink is ready for some teeth brushing. I wonder if your dinosaur friend is ready for bed too?
2. The toothbrush is right here by the sink. That dinosaur looks like he's ready for some sleep after teeth are all clean.
3. It seems like a good time for brushing teeth in the bathroom. Maybe the dinosaur can join you for a cozy bedtime story afterward.
4. The bathroom is all set for teeth cleaning. I'm curious about what adventures your dinosaur might have on the way to bed.

### Human Review Notes

```txt
Prompt verdict:
- Flash: 
- Flash-Lite: 

What Flash did better:
- 

What Flash-Lite did better:
- 

Risks or regressions:
- 

Decision for this prompt:
- 
```

