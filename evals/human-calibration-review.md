# Human Calibration Review

Label each set using the north-star rule: a set can pass when it gives the caregiver at least 1-2 genuinely usable or excellent options, as long as no option is bad enough that it should not be shown.

Use `hasHarmfulOption` only for should-not-show output: shaming, manipulative, dangerously misleading, unsafe, based on a false promise, or deeply counter to the product goals. Serious tone/filter mismatch belongs in the verdict and note, but should not be labeled harmful unless the option should not be shown.

Questions are allowed when they soften a demand or invite collaboration. Mark them down only when they become faux choices, question-demands, or an overused pattern across the set.

For each item, fill the matching entry in `evals/human-calibration-set.json`:

- `bestOptionCount`: `0`, `1`, `2`, or `3+`
- `hasExcellentOption`: `true` or `false`
- `hasHarmfulOption`: `true` or `false`
- `setVerdict`: `Pass`, `Borderline`, or `Fail`
- `why`: one short note

## Review Items

### 1. current-01-running-house-default-standard

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Default
- Fewer Words: Off
- Prior automated verdict: Fail, overall 2/5

1. The floor in here is for walking.
2. The running happens outside.
3. I wonder if we could try out our walking feet in here.
4. Movement is happening quickly in the house right now.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 2. current-02-running-house-default-fewer

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Default
- Fewer Words: On
- Prior automated verdict: Fail, overall 1/5

1. The floor in here is for walking.
2. Running is something we do outside.
3. Movement is slower inside the house.
4. I notice a lot of fast feet! This space is for walking feet.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 3. current-03-running-house-straightforward-standard

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Straightforward
- Fewer Words: Off
- Prior automated verdict: Pass, overall 4/5

1. Running is for outside spaces; inside we use walking speed.
2. The house is a walking zone.
3. Inside our house, feet move at a walking pace to keep everyone safe.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 4. current-04-running-house-straightforward-fewer

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Straightforward
- Fewer Words: On
- Prior automated verdict: Fail, overall 2/5

1. The house is a walking space.
2. Running happens outside.
3. We can walk inside.
4. Walking feet are needed for being inside the house.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 5. current-05-running-house-humorous-standard

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Humorous
- Fewer Words: Off
- Prior automated verdict: Fail, overall 1/5

1. The floor in here is for walking.
2. Running feet can zoom around outside.
3. Inside our house, feet go at walking speed.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 6. current-06-running-house-humorous-fewer

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Humorous
- Fewer Words: On
- Prior automated verdict: Fail, overall 2/5

1. Those are some fast feet! The floor is better for walking.
2. The house is a walking zone.
3. Running shoes can really fly outside.
4. I notice some speedy legs. Inside spaces are for walking.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 7. current-07-running-house-equalizing-standard

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Equalizing
- Fewer Words: Off
- Prior automated verdict: Pass, overall 3/5

1. The floor can be a bit slippery for running right here; the running place is outside.
2. I may need a speed checker for inside. There's a walking speed for inside, and a running speed for outside.
3. Sometimes I forget the house rules. Could you be the expert on inside movement, showing what's safe inside versus outside?
4. I wonder if we have a special running path outside, because the house path is usually for walking.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 8. current-08-running-house-equalizing-fewer

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Equalizing
- Fewer Words: On
- Prior automated verdict: Pass, overall 3/5

1. The house is a walking space, and outside is a running space.
2. I may need a speed-fit checker for the house. Walking inside, running outside.
3. Oh, my brain forgot for a moment if this was a running zone or a walking zone.
4. This feels like a spot for walking, and then there's a running area out there.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 9. current-09-running-house-interest-based-standard

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: Off
- Prior automated verdict: Fail, overall 2/5

1. The floor is a good place for walking inside, maybe like a Pokemon exploring a new path.
2. It can be tricky to move quickly in here; outside is usually the spot for big running energy.
3. Movement is happening in the house; sometimes a walking pace works best for our indoor spaces.
4. I notice a lot of fast steps! A walking speed keeps us steady, just like a cautious Pokemon in a new area.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 10. current-10-running-house-interest-based-fewer

- Source: latest-eval-current
- Input: Stop running in the house
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: On
- Prior automated verdict: Fail, overall 1/5

1. The house is a place for walking; outside is where running happens. Maybe like a speedy Pokemon needing open space!
2. It's a walking speed inside. Pokemon characters often have different speeds for different places.
3. Movement is for walking in here. The running happens outside.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 11. current-11-dinner-hands-default-standard

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Default
- Fewer Words: Off
- Prior automated verdict: Pass, overall 5/5

1. Dinner is ready on the table. There are warm bubbles in the sink for hands.
2. It is dinner time. The table is set and the handwashing station is open.
3. Dinner is cooking. I am noticing some hands that might be ready for a wash before we eat.
4. The family is gathering for dinner. Warm water and soap are available for handwashing.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 12. current-12-dinner-hands-default-fewer

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Default
- Fewer Words: On
- Prior automated verdict: Pass, overall 4/5

1. Dinner is ready on the table. Time for handwashing before we eat.
2. The table is set for dinner. Handwashing usually happens before we sit down for our meal.
3. It's dinner o'clock! Looks like everyone's coming downstairs and washing up.
4. Dinner is served! Hands are washed before we begin.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 13. current-13-dinner-hands-straightforward-standard

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Straightforward
- Fewer Words: Off
- Prior automated verdict: Fail, overall 3/5

1. Dinner is ready on the table. Time to wash hands.
2. Dinner is prepared. Handwashing happens, then eating.
3. The table is set for dinner. Handwashing usually comes before sitting down to eat.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 14. current-14-dinner-hands-straightforward-fewer

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Straightforward
- Fewer Words: On
- Prior automated verdict: Fail, overall 2/5

1. Dinner is ready. Handwashing happens downstairs before eating.
2. Dinner preparations are complete. Next is handwashing for dinner.
3. Food is on the table, and handwashing comes before dinner.
4. The food is waiting. Time to get downstairs, and handwashing is next.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 15. current-15-dinner-hands-humorous-standard

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Humorous
- Fewer Words: Off
- Prior automated verdict: Fail, overall 3/5

1. The dinner bell is ringing! And the handwashing station is ready for action. Your speedy feet might get you to the table in record time!
2. Dinner is almost on the table! The sink is all set for some bubbly fun. Then, it's straight to the food zone.
3. It's dinner time. The downstairs world is calling, and the water is running in the sink for hand-cleaning adventures before we eat.
4. Dinner is approaching, and there are some hands that need a quick rinse before the feast begins! The table is waiting.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 16. current-16-dinner-hands-humorous-fewer

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Humorous
- Fewer Words: On
- Prior automated verdict: Fail, overall 2/5

1. The dinner aroma is starting to fill the downstairs area. Hands often enjoy a quick splash before joining the meal.
2. Dinner preparations are happening. The handwashing station is ready for anyone heading to the table.
3. Heard some rumbling, must be dinner getting ready! The sink is open for a quick hand party before eating.
4. Dinner will be available soon. Downstairs is the way, and a clean-hands moment at the sink often happens before sitting.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 17. current-17-dinner-hands-equalizing-standard

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Equalizing
- Fewer Words: Off
- Prior automated verdict: Fail, overall 2/5

1. The dining table is set for dinner, and the water is running in the bathroom sink.
2. Dinner ingredients are ready for eating, and it looks like a good time to visit the downstairs sink for handwashing.
3. It is dinner time soon. I wonder if the downstairs handwashing station is open now, and when it might be a good time to head down.
4. The food is on the table! I'm not sure if the downstairs route is clear for getting hands clean before dinner.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 18. current-18-dinner-hands-equalizing-fewer

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Equalizing
- Fewer Words: On
- Prior automated verdict: Pass, overall 3/5

1. The dining room table is set for dinner, and there's warm water ready for hands downstairs.
2. Dinner is ready to start, I wonder if the handwashing station is prepared for a quick clean.
3. It is dinner time. We need to remember the handwashing step before heading to the table. I'm wondering if the downstairs route is clear.
4. Dinner is almost ready! I was just thinking about who might be the expert on getting downstairs for handwashing before dinner.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 19. current-19-dinner-hands-interest-based-standard

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: Off
- Prior automated verdict: Pass, overall 3/5

1. Dinner is ready! There is a delicious meal downstairs. It is time for clean hands before we eat.
2. The dinner bell rang, and it looks like a Pokemon might be joining us for dinner down in the kitchen. Handwashing is the next step before we can sit down.
3. Food is on the table, all set for dinner. Time to make our way downstairs and get hands sparkly clean, just like a freshly caught Pokemon card!
4. Downstairs is where dinner is waiting. A good hand wash is usually what happens before we eat.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 20. current-20-dinner-hands-interest-based-fewer

- Source: latest-eval-current
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: On
- Prior automated verdict: Pass, overall 3/5

1. Dinner is ready! Washing hands is next, and then coming down to the table.
2. It's time for dinner! Handwashing first, and then heading downstairs, like a quick Pikachu dash.
3. The dining room is ready for dinner. First, handwashing, and then making your way down.
4. I'm setting the table for dinner now. Handwashing is a good step before coming down, perhaps with your favorite Pokemon in mind.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 21. current-21-toys-upstairs-default-standard

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Default
- Fewer Words: Off
- Prior automated verdict: Pass, overall 4/5

1. These toys are ready to go upstairs to your room.
2. It's time for these toys to be picked up and put away in your room.
3. The toys are here, and your room upstairs is where they belong.
4. I notice the toys are ready to be put back in your room up the stairs.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 22. current-22-toys-upstairs-default-fewer

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Default
- Fewer Words: On
- Prior automated verdict: Pass, overall 4/5

1. The toys are on the floor. Their home is upstairs in your room.
2. Time for the toys to go back to their places. They like being in your room upstairs.
3. I wonder if the toys are ready for their trip upstairs to your room.
4. The toys are here, and your room upstairs is their cozy spot.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 23. current-23-toys-upstairs-straightforward-standard

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Straightforward
- Fewer Words: Off
- Prior automated verdict: Fail, overall 2/5

1. These toys are ready for their spot upstairs in the room.
2. The toys are here, and their home is upstairs in the room for safekeeping.
3. There's a gathering of toys on the floor, and the toy basket is waiting upstairs in your room for them.
4. Upstairs in the room is where the toys live; looks like it's time for them to make their journey back up there.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 24. current-24-toys-upstairs-straightforward-fewer

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Straightforward
- Fewer Words: On
- Prior automated verdict: Pass, overall 3/5

1. The toys are on the floor. Their home is upstairs in your room.
2. Time for the toys to go back to your room. They need to be picked up first.
3. The toys are ready to be gathered and then put away in your room upstairs.
4. I wonder if the toys want to go on an adventure to your room upstairs.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 25. current-25-toys-upstairs-humorous-standard

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Humorous
- Fewer Words: Off
- Prior automated verdict: Pass, overall 4/5

1. The toys are having a big floor party right now. Their home base is in your room upstairs.
2. These friends are ready for their ride upstairs to your room. They'll be cozy there.
3. Upstairs is where the toys live. They'll be ready for another adventure when they're back in your room.
4. I wonder if these toys are ready for their upstairs journey to your room?

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 26. current-26-toys-upstairs-humorous-fewer

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Humorous
- Fewer Words: On
- Prior automated verdict: Pass, overall 4/5

1. The toys are having an downstairs party, and the toy basket is ready for transport upstairs.
2. Toy mountain here, and the upstairs room is the toy home base.
3. The playroom is ready for speedy feet and hands to gather up the toys. Then it's time for an upstairs adventure to the bedroom.
4. I wonder if these toys are ready to go back to their spots in the bedroom upstairs.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 27. current-27-toys-upstairs-equalizing-standard

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Equalizing
- Fewer Words: Off
- Prior automated verdict: Pass, overall 4/5

1. The toys are on the floor; they can be put away in the room upstairs. I wonder if you remember the best way to get them there.
2. It is looking like the toys need to go all the way upstairs to your room. I might need a route planner to remember how to get there.
3. Upstairs is where the toys live in your room. I am not sure if all of these toys belong there, maybe you can be the destination checker.
4. I see all the toys are on the floor, and their home is your room upstairs. I think it would be helpful to have a room-reset boss for this job.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 28. current-28-toys-upstairs-equalizing-fewer

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Equalizing
- Fewer Words: On
- Prior automated verdict: Pass, overall 4/5

1. The toys are here, and their home is upstairs in your room.
2. I'm not sure if these toys go upstairs or downstairs. You're the expert on where they live.
3. It looks like the toys want to go on an adventure to their room upstairs. I wonder what order they like to travel in.
4. There's a job for the 'room-reset boss' when toys are ready to go back upstairs to their spot.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 29. current-29-toys-upstairs-interest-based-standard

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: Off
- Prior automated verdict: Fail, overall 1/5

1. These Pokemon friends are having a quiet moment, noticing that the toys are out and ready to go upstairs to your room.
2. The next thing is for the toys to be picked up and find their way to your room upstairs.
3. I wonder if these Pokemon characters could help us think about gathering the toys to go up to your room for bedtime.
4. It looks like the toys are waiting to be tidied up and moved to their spot in your room upstairs.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 30. current-30-toys-upstairs-interest-based-fewer

- Source: latest-eval-current
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: On
- Prior automated verdict: Fail, overall 1/5

1. These Pokemon friends look like they're ready to go upstairs. It's time for toys to go into the room now.
2. The upstairs room is waiting for the toys. Let's get these gathered for their journey.
3. I wonder if these toys want to go upstairs to the room. They can rest there.
4. The toys are on the floor. The room upstairs is their cozy spot.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 31. current-31-dinner-hands-interest-missing-standard

- Source: latest-eval-supplemental
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Interest Based
- Fewer Words: Off
- Prior automated verdict: Fail, overall 3/5

1. Dinner is ready! The kitchen is set, and it looks like a good time to wash hands before we eat.
2. The table is almost ready for dinner. First, a quick stop at the sink, and then down to the kitchen.
3. Dinner time is approaching. It seems like the perfect moment to come downstairs and get hands clean.
4. The dinner aroma is filling the house. Downstairs, a quick hand wash, then time to eat.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 32. anchor-good-safety-default

- Source: intentional-anchor
- Input: Stop running in the house
- Tone: Default
- Fewer Words: Off

1. Fast feet have more room outside.
2. Inside is feeling like a walking-speed place right now.
3. There is a better running spot once we are outside.
4. The house works better for slower feet.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 33. anchor-weak-safety-caption

- Source: intentional-anchor
- Input: Stop running in the house
- Tone: Default
- Fewer Words: On

1. The floor is for walking.
2. Movement is happening.
3. The house has floors.
4. Running exists outside.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 34. anchor-good-dinner-sequence

- Source: intentional-anchor
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Default
- Fewer Words: Off

1. Dinner is ready downstairs, and the sink is the stop before eating.
2. The table is set; clean hands come before dinner.
3. Food is ready downstairs after a quick handwash.
4. The dinner path has two parts: downstairs and hands first.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 35. anchor-weak-dinner-sequence-loss

- Source: intentional-anchor
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Straightforward
- Fewer Words: On

1. Dinner is ready.
2. The table is waiting.
3. Hands are a thing.
4. Food is downstairs.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 36. anchor-good-cleanup-destination

- Source: intentional-anchor
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Straightforward
- Fewer Words: Off

1. The toys go from here to their upstairs room spot.
2. Toy pickup has a clear finish: upstairs in your room.
3. These toys have a home upstairs in your room.
4. The room upstairs is the landing spot for these toys.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 37. anchor-weak-cleanup-destination-loss

- Source: intentional-anchor
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Default
- Fewer Words: On

1. The toys are everywhere.
2. Cleanup is happening.
3. This room has toys.
4. The floor is ready.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 38. anchor-good-equalizing

- Source: intentional-anchor
- Input: Pick up your toys and put them away upstairs in your room
- Tone: Equalizing
- Fewer Words: Off

1. I may need the upstairs route expert for where these toys land.
2. The room-reset boss probably knows which toys head upstairs.
3. My brain is missing the toy route from here to your room.
4. This looks like a job for someone who knows the upstairs toy spots.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 39. anchor-weak-interest-gimmick

- Source: intentional-anchor
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: Off

1. Pikachu needs you to wash your hands before the dinner battle begins.
2. The Pokemon dinner quest requires clean hands and a downstairs journey.
3. Your Pokemon cards are waiting at the sink before dinner.
4. A wild dinner appeared, so the trainer must wash hands.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:

### 40. anchor-good-interest-light

- Source: intentional-anchor
- Input: Please come down and wash your hands. It's dinner time.
- Tone: Interest Based
- Interest: Pokemon
- Fewer Words: Off

1. Dinner is ready downstairs, and hands get a quick sink stop first.
2. The kitchen is ready after handwashing; maybe a Pokemon can keep you company on the way down.
3. Clean hands before dinner feels like the next part of the route.
4. Food is ready downstairs, and the sink is the first stop.

Human labels:
- bestOptionCount:
- hasExcellentOption:
- hasHarmfulOption:
- setVerdict:
- why:
