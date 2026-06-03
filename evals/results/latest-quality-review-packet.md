# Kyle Translator Quality Review Packet

Generated: 2026-06-03T01:59:21.496Z

Use this packet for the manual checkpoints before production selection. The goal is not to approve every output; it is to decide whether the current direction gives caregivers at least 1-2 genuinely usable options per set without should-not-show output.

## Decisions Needed

- Do the remaining Borderline examples feel acceptable for production, given the product goal of 1-2 strong usable options per set?
- Do the multi-interest examples generalize well enough beyond Pokemon?
- Is the current improvement large enough for final side-by-side approval before commit/deploy?

## Current Scoring Principle

Pass: at least 2 usable options, tone/filter mostly works, and no should-not-show output.

Borderline: 1-2 usable options but tone/filter is inconsistent. One excellent option should prevent an automatic fail unless tone/filter mostly misses, Fewer Words materially misses, coverage is unsafe, or a should-not-show output exists.

Fail: no usable options, selected tone/filter mostly misses, safety/task coverage is unsafe, or any should-not-show output exists.

`hasHarmfulOption` is reserved for should-not-show output only, not ordinary weakness or wrong-tone output.

## Full 40-Case Flash Evidence

- Latest full Flash run: Pass 36, Borderline 3, Fail 0; avg usable 2.79; avg excellent 0.74; should-not-show 0; tokens 39997 in / 3561 out; cost $0.0209
- Guardrail rows excluded from aggregate: 1.
- Variance run A after latest Interest Based changes: Pass 32, Borderline 4, Fail 3; prompt tokens 37,024; output tokens 3,565; estimated generation cost $0.020017.
- Variance run B after latest Interest Based changes: Pass 35, Borderline 4, Fail 0; prompt tokens 37,024; output tokens 3,625; estimated generation cost $0.020167.
- Prior full Flash baseline before Fewer Words/Interest Based tightening: Pass 21, Borderline 4, Fail 15; prompt tokens 27,098; output tokens 4,540; estimated generation cost $0.019481.
- Current read: quality improved meaningfully. Production generation cost rose slightly in the latest full run, driven by longer prompt instructions, while output tokens are lower than the older baseline.

## Full-Set Remaining Non-Pass Examples

### current-06-running-house-humorous-fewer / Borderline

- Evaluator recommendation: This set is Borderline. While it provides two usable, humorous, and concise options for the caregiver, the consistency of the 'Humorous' tone across all options is lacking. The set would be stronger with more consistent playful language across all suggestions. The two stronger options ('Inside feet? Slow-mo.' and 'Zoom needs the yard.') are good, but the others are more straightforward and don't quite hit the humorous mark.

1. Inside feet? Slow-mo.
2. Zoom needs the yard.
3. Walking speed, inside.
4. Runner feet go outside.

### current-24-toys-upstairs-straightforward-fewer / Borderline

- Evaluator recommendation: The set has one strong usable option (Option 4) and one other usable option (Option 1). However, one option misses a key task element and another is awkwardly phrased. While no options are harmful, the overall consistency in meeting the 'straightforward' tone and full task coverage is mixed, leading to a Borderline verdict. The tool should aim for more consistent task coverage and natural phrasing within the 'straightforward' tone for all options when 'fewer words' is active.

1. Toys go upstairs now.
2. These toys go in your room.
3. Upstairs, for your room, these toys.
4. Toys in your room, upstairs.

### current-26-toys-upstairs-humorous-fewer / Borderline

- Evaluator recommendation: The set is Borderline. While all options are usable and concise, only one option truly hits the 'Humorous' tone. The tool should aim for more consistent tone fidelity across all options when a specific tone is selected. Option 2 is a strong example for future generations.

1. Toy reset, upstairs in your room?
2. That toy parade could go upstairs.
3. Upstairs room for the toys now.

## Guardrail-Only Rows Excluded From Aggregates

These rows are kept for traceability but are not counted as output-quality failures because production blocks Interest Based requests without an entered interest before a model call.

### current-31-dinner-hands-interest-missing-standard / Fail

- Gate reasons: Interest Based selected without an interest value in calibration case

1. Dinner's just about ready downstairs. Time to come down and wash up.
2. I'm heading down to get dinner ready. You can come down and get your hands washed.
3. Dinner's almost on the table. Are you ready to come down and get your hands clean?
4. Looks like dinner is ready. Coming down to wash hands?

## Interest Generalization Check

This check tests whether Interest Based works beyond Pokemon. Kyle reviewed Minecraft, trains, and Disney examples as generally good to go.

- Runs: 9
- Interests: Minecraft, trains, Disney
- Tokens: 10624 in / 1018 out

### Minecraft / running-house

Original: Stop running in the house

1. Inside, we go with walking steps, like when you're carefully exploring a Minecraft cave. Running speed fits best outside.
2. I wonder if we could try walking in here, like a careful Minecraft character. We can save the sprinting for outside.
3. Minecraft players walk inside their builds. We can move like that in the house, and use bigger speeds outside.

### Minecraft / dinner-hands

Original: Please come down and wash your hands. It's dinner time.

1. Ready for some dinner soon, like gathering supplies in Minecraft. The path to the table usually includes washing up downstairs first.
2. Time to transition soon, like moving between biomes. We'll head downstairs and wash up before dinner.
3. Thinking about dinner, a bit like setting up a new base. We've got downstairs and handwashing on the way.

### Minecraft / toys-upstairs

Original: Pick up your toys and put them away upstairs in your room

1. I'm thinking about a Minecraft-style journey for these toys, all the way upstairs to your room.
2. Wondering how to get these toys from here to your room upstairs? Like finding the right Minecraft path.
3. Looks like these toys are ready for their next step: an upstairs path to your room, maybe a bit like a Minecraft portal.

### trains / running-house

Original: Stop running in the house

1. Inside here, it's more of a walking pace, like a train moving slowly into the station. Faster speeds fit outside.
2. Hmm, inside this house is a good place for walking, kind of like trains on a switch track. Running speed is great for outside.
3. Inside feels like walking speed, like a careful train moving along its route. Running really fits outside instead.

### trains / dinner-hands

Original: Please come down and wash your hands. It's dinner time.

1. Dinner is getting ready downstairs. When you're ready to come down, you can make a stop at the hand wash station, like a train preparing for its next journey.
2. Looks like the dinner train is pulling into the station soon. You can head downstairs and get your hands clean for it when you're ready.
3. It's almost time for the dinner run. If you're heading downstairs, there's a hand wash stop before the meal.

### trains / toys-upstairs

Original: Pick up your toys and put them away upstairs in your room

1. Looks like these toys could take a train-like journey all the way upstairs to your room.
2. Ready to map out a path for these toys, like a train route, heading upstairs to your room?
3. I'm wondering if we could get these toys on a schedule, like a train, to go upstairs to your room.

### Disney / running-house

Original: Stop running in the house

1. Inside speed can be like those slow, majestic Disney parade steps. Running speed wants to be outside.
2. Maybe we can practice our slower Disney character walk inside? The running speed can be ready for outside, like when the characters wave from a float.
3. This house space is more for walking, like the gentle pace on 'it's a small world'. Running fits best outside.

### Disney / dinner-hands

Original: Please come down and wash your hands. It's dinner time.

1. Dinner’s almost ready, like a feast in a Disney castle. Thinking about heading downstairs for a quick hand wash before that happens?
2. We could make our way down and do a quick hand wash, like getting ready for a Disney parade. Then dinner is all set.
3. I’m wondering if it's time to journey downstairs and wash up, like getting neat for a Disney character meeting. Dinner is coming up soon!

### Disney / toys-upstairs

Original: Pick up your toys and put them away upstairs in your room

1. I wonder if we can get these toys upstairs to your room, like a Disney parade route.
2. Time to get these toys put away in your room upstairs, like finding the castle at the end of a Disney journey.
3. These toys need to go upstairs to your room; we could make it a Disney-style cleanup mission.

## Hard-Case Model Comparison

This earlier focused run targeted rows where the prompt/model struggled before the latest Interest Based generalization work. Keep it as model/cost context only; the current production candidate should be judged primarily by the latest full 40-case Flash run and the multi-interest generalization check.

| Candidate | Runs | Verdicts | Avg Usable | Avg Excellent | Avg Latency ms | Estimated Cost | Errors |
|---|---:|---|---:|---:|---:|---:|---:|
| gemini-3.5-flash | 10 | Pass 5, Borderline 4, Fail 1 | 1.9 | 0.4 | 1507 | 0.01134 | 0 |
| gemini-3.1-flash-lite | 10 | Pass 3, Borderline 6, Fail 1 | 1.2 | 0.4 | 1115 | 0.003985 | 0 |
| gemini-2.5-flash-baseline | 10 | Pass 1, Borderline 5, Fail 4 | 1.1 | 0.2 | 1179 | 0.004945 | 0 |
| gemini-2.5-flash-thinking-256 | 10 | Pass 2, Borderline 5, Fail 3 | 1.3 | 0.2 | 2238 | 0.005048 | 0 |
| gemini-2.5-pro | 10 | Pass 3, Borderline 7, Fail 0 | 1.6 | 0.7 | 23357 | 0.021311 | 0 |
| gemini-3-flash-preview | 10 | Pass 3, Borderline 4, Fail 3 | 1.8 | 0.2 | 1463 | 0.006462 | 0 |
| gemini-2.5-flash-lite | 10 | Pass 3, Borderline 2, Fail 5 | 1 | 0.2 | 907 | 0.001182 | 0 |

### Hard-Case Examples To Review

#### current-10-running-house-interest-based-fewer

##### gemini-3.5-flash / Borderline

- Latency: 1101 ms
- Estimated cost: $0.000854
- Gate reasons: Interest Based serious mismatch count 2

1. Walking inside, running outside.
2. Fast feet fit outside on the grass.
3. Pikachu speed is for the backyard.

##### gemini-3.1-flash-lite / Borderline

- Latency: 1072 ms
- Estimated cost: $0.000372
- Gate reasons: Interest Based serious mismatch count 2

1. Walking speed inside. Running fits out in the yard.
2. Fast feet outside. We move calmly in here.
3. Switching to walking speed, like a Snorlax, before we go outside.
4. Moving like a stealthy Pokemon now; save the sprinting for outside.

##### gemini-2.5-flash-baseline / Fail

- Latency: 867 ms
- Estimated cost: $0.000443
- Gate reasons: Interest Based serious mismatch count 3

1. Inside, we walk.
2. Running is for outside.
3. Inside walking speed.
4. Slow like a Snorlax inside?

##### gemini-2.5-flash-thinking-256 / Fail

- Latency: 1836 ms
- Estimated cost: $0.000458

1. Walking speed inside. Running fits outside.
2. Pokemon moves are for walking inside.
3. Ready for outside running?
4. Can we try walking feet inside here?

##### gemini-2.5-pro / Borderline

- Latency: 16486 ms
- Estimated cost: $0.001936

1. Snorlax-walking in the house.
2. Fast feet fit better outside.
3. Let's save our Rapidash-speed for the yard.
4. Walk inside. Run outside.

##### gemini-3-flash-preview / Fail

- Latency: 1042 ms
- Estimated cost: $0.000579
- Gate reasons: Interest Based serious mismatch count 3

1. Fast feet fit on the grass outside.
2. Pikachu speed is for the yard.
3. Inside is for walking; running is for outdoors.
4. Walking inside keeps things from falling.

##### gemini-2.5-flash-lite / Fail

- Latency: 770 ms
- Estimated cost: $0.000113
- Gate reasons: Interest Based serious mismatch count 4

1. Fast feet fit outside. Walking inside.
2. Walking feet inside. Running feet outside.
3. Can the fast feet be outside?
4. Let's try walking feet inside. Running is for outside.

#### current-30-toys-upstairs-interest-based-fewer

##### gemini-3.5-flash / Borderline

- Latency: 1364 ms
- Estimated cost: $0.001069
- Gate reasons: Interest Based serious mismatch count 3

1. These toys belong upstairs in your room.
2. I'm heading up to your room with these Pokemon cards.
3. Let's carry this pile up to your bedroom.
4. Do these toys go in your upstairs Pokemon basket?

##### gemini-3.1-flash-lite / Borderline

- Latency: 755 ms
- Estimated cost: $0.000352

1. These toys go back to your room.
2. Time for the room-bound toys to head upstairs.
3. These Pokemon-sized toys need their upstairs home.
4. Like Pokemon returning to base, these go upstairs.

##### gemini-2.5-flash-baseline / Fail

- Latency: 1179 ms
- Estimated cost: $0.00041
- Gate reasons: Interest Based serious mismatch count 2

1. Toys go upstairs to your room.
2. Pokemon toys upstairs to your room?
3. Let's get these upstairs.

##### gemini-2.5-flash-thinking-256 / Fail

- Latency: 2551 ms
- Estimated cost: $0.000448
- Gate reasons: Interest Based serious mismatch count 3

1. Toys go upstairs to your room.
2. Pokemon toys travel upstairs?
3. Ready for toys to reset upstairs.
4. Collect these toys upstairs.

##### gemini-2.5-pro / Borderline

- Latency: 32522 ms
- Estimated cost: $0.002084
- Gate reasons: Interest Based serious mismatch count 2

1. This Snorlax-pile of toys goes upstairs to your room.
2. Time for a Machoke-carry, upstairs to your room.
3. Toys are ready for your room upstairs.
4. I'm starting a toy pile that goes upstairs to your room.

##### gemini-3-flash-preview / Fail

- Latency: 1634 ms
- Estimated cost: $0.00071
- Gate reasons: Interest Based serious mismatch count 3

1. These toys are headed upstairs to your room.
2. Wondering how many Pokemon could fit upstairs right now?
3. Let's see if your room needs a toy reset.
4. Toys are ready for a quick trip upstairs.

##### gemini-2.5-flash-lite / Borderline

- Latency: 671 ms
- Estimated cost: $0.00011

1. Toys upstairs in your room?
2. Let's get these toys upstairs.
3. Pokemon gym leaders tidy up, right?
4. Time for toys to go upstairs.

#### anchor-good-interest-light

##### gemini-3.5-flash / Borderline

- Latency: 1615 ms
- Estimated cost: $0.001269

1. I'm heading to the sink to wash up for dinner, and then I'll be at the table. You're welcome to join me whenever you're ready to head downstairs.
2. Dinner is ready on the table. I'm going to do a quick hand wash first, kind of like a water-type Pokemon getting ready for a big meal.
3. The food is on the table downstairs. I'm washing my hands now so I can eat while it's still warm.
4. It's time for dinner downstairs. My hands are dirty from the day, so I'm stopping by the sink first to clear off any status conditions before we eat.

##### gemini-3.1-flash-lite / Borderline

- Latency: 1286 ms
- Estimated cost: $0.000455

1. The food is on the table downstairs whenever you're ready, and there is a clear spot at the sink for handwashing before we start.
2. I'm heading down to get dinner ready; I'll leave the bathroom light on so it's easy to wash up whenever you come down.
3. Dinner is about to be served, and I've got the hand soap ready at the sink, just like how you organize your Pokedex entries before starting a new region.
4. I notice you're focused upstairs, but dinner is arriving downstairs soon; we can get our hands washed up quickly before sitting down, just like a quick recharge before a big battle.

##### gemini-2.5-flash-baseline / Borderline

- Latency: 1244 ms
- Estimated cost: $0.000551

1. I'm heading downstairs for dinner; it's almost time to wash up.
2. Dinner's just about ready, and it's time to get hands clean. Wonder if any Pokemon are ready for their dinner too.
3. Coming downstairs? It's time to get hands washed for dinner.
4. Thinking about dinner, and hands need a wash first. It's like charging up a Pokemon before a big journey.

##### gemini-2.5-flash-thinking-256 / Borderline

- Latency: 2212 ms
- Estimated cost: $0.000574

1. Dinner's just about ready; you can come down when you're thinking about washing up.
2. I'm heading downstairs to get dinner on the table; hands can be washed on the way.
3. It's time for dinner! You can make your way down and get those hands clean, like a quick Pokeball catch.
4. Dinner is waiting downstairs. When you're ready to come down, we can get your hands washed like a quick water attack.

##### gemini-2.5-pro / Borderline

- Latency: 33993 ms
- Estimated cost: $0.002
- Gate reasons: Interest Based serious mismatch count 2

1. I'm heading downstairs to wash my hands. The dinner is on the table.
2. Dinner is ready downstairs. I'm thinking it's time for a slow Snorlax walk over to the sink for a hand wash.
3. I'm going to head down and wash up for dinner. I was just wondering if a Pikachu prefers ketchup on everything.

##### gemini-3-flash-preview / Borderline

- Latency: 3127 ms
- Estimated cost: $0.000591

1. Dinner is ready on the table and I'm headed to the sink to wash up like a Squirtle using water gun.
2. I'm wondering if you'll be as fast as Rapidash getting down here for hand washing and dinner.
3. The food is served and the soap is ready for whoever is coming down to eat.

##### gemini-2.5-flash-lite / Borderline

- Latency: 863 ms
- Estimated cost: $0.000119
- Gate reasons: Interest Based serious mismatch count 3

1. Dinner is ready downstairs.  It's time to wash hands.
2. Hey, dinner's on the table.  Let's go wash up first.
3. I'm heading downstairs for dinner. Wanna race to the sink to wash hands?
4. Dinner smells amazing downstairs!  Let's get our hands sparkly clean before we eat.

## Prompt Layer Review

### Master Prompt

```txt
You are an AI assistant named "Declarative," designed as a co-regulation tool for parents and caregivers of children with a Pathological Demand Avoidance (PDA) profile. Your primary job is to turn caregiver demands into real, sayable, low-pressure language.

Quality order:
1. **Real caregiver speech:** Every suggestion should sound like something a calm adult could actually say to a child in the moment. Avoid captions, slogans, therapy-speak, stiff rules, and awkward AI phrasing.
2. **Felt safety and autonomy:** Reduce pressure without manipulating, shaming, cornering, bargaining, praise-pressuring, or hiding a command inside a fake observation.
3. **Full practical meaning:** Keep the action, safety concern, location, sequence, and destination when they matter.
4. **Tone behavior:** Match the selected tone as a strategy, not as decorative flavor.
5. **Brevity:** Short is good only when it stays complete and usable.

Declarative strategies you may use:
- Situation or task observation: what is ready, happening, changing, waiting, or available.
- Shared wondering, questions, or problem-solving: a genuine collaborative thought that softens the demand, not a disguised question-demand or fake choice.
- Self-narration: what the adult is doing next, when it is authentic and not guilt-based.
- Concrete redirection: a low-pressure statement of where/when the action fits better.

Questions are allowed when they feel natural and useful. Use them as one strategy in the mix; avoid turning every option into a question or using questions to sneak in a command. The main exception is Equalizing + Fewer Words, where compact questions can be the clearest way to let the child be the checker, expert, or leader.

Avoid overusing environment-first phrasing. "The floor is for walking" style captions often sound like rules. Use environment observations only when they feel natural and useful.

Hard requirements:
- Multi-step requests must keep the important steps together.
- Safety or speed prompts must keep a concrete safer alternative, such as walking inside or running outside, without threat language.
- Cleanup or put-away prompts must keep the destination.
- Interest Based outputs with an entered interest must use that interest or a recognizable element from it in every returned suggestion; no plain non-interest fallback suggestion is allowed for that tone.
- Interest Based outputs must use the interest meaningfully and factually. The interest element needs to do real work in the logic of the sentence; do not use arbitrary references, false labels, or invented themed objects just to satisfy the tone.
- Before returning, privately reject weak candidates that are vague, gimmicky, command-like, emotionally loaded, or not sayable.

Your output must be a valid JSON array of objects.
```

### Tone Prompts

- Default: Use "Default": natural, warm, and easy to say out loud. Prefer grounded conversational wording over perfect declarative theory.
- Straightforward: Use "Straightforward": clear, practical, and calm. Get to the point without orders, faux choices, clipped bossiness, jokes, or emotional pressure. A plain helpful statement is better than a clever declarative frame.
- Humorous: Use "Humorous": add a little lift through rhythm or one small playful image. Keep it usable, short, and anchored to the task. Avoid sarcasm, teasing, shame, injury warnings, overstimulation, big story worlds, and forced jokes.
- Equalizing: Use "Equalizing": make status-leveling the real move. Let the child be the checker, expert, leader, route planner, or destination boss, or let the adult be gently unsure/forgetful. Keep dignity; no mocking, helplessness, sarcasm, or performance. Vary the frame so it does not sound templated.
- Interest Based with Pokemon: Use "Interest Based": every returned suggestion must meaningfully incorporate "Pokemon" or a recognizable element from "Pokemon". Prefer returning exactly 3 strong suggestions over adding a fourth weak filler suggestion. A plain non-interest option is a miss for this tone. A bare name-drop is also a miss; the interest element must do real work in the logic of the sentence by connecting to the task through a relevant action, tool, place, character trait, route, checkpoint, comparison, or relationship. Keep the interest as a grounded connection unless the original request says the interest is physically present. Do not borrow vocabulary from a different interest; for example, do not use Pokemon, Trainer, Poke-stop, Gym, Squirtle, Pikachu, or Pokemon route language unless the entered interest is Pokemon. For Pokemon, favor concrete elements that naturally map to the moment: Squirtle/water/sink, Poke-stop/transition stop, Trainer/route, Pikachu/speed, and careful Pokemon steps. "The sink is like Squirtle, helping with water" and "the sink is our next Poke-stop before dinner" are integrated; "Pokemon quick stop: hands, then dinner" is just a name-drop. Avoid generic game-ish words like team, checkpoint, evolve, challenge, map challenge, or move names unless they are paired with a recognizable Pokemon element and clearly explain the real task. Do not use vague move-language like "rapid-fire attack" for handwashing. Do not use generic "pickup challenge" wording for cleanup unless it includes a Pokemon-specific frame. Do not invent Pokemon objects/cards/TV/plates/props, story worlds, battles, quests, or character actions. Do not rename real objects as Pokemon items unless the caregiver did. Do not put Pokemon directly in front of real task nouns like toys, hands, hand wash, dinner, sink, room, floor, house, cleanup, storage, or things. The real task stays primary.
- Interest Based with no interest: Use "Interest Based" with no entered interest: do not pretend there is an interest. Fall back to natural, warm, low-pressure Default wording.

### Generated Prompt Samples

### Safety redirection, Default, Fewer Words

- Tone: Default
- Fewer Words: On

```txt
Rewrite into 3-4 declarative alternatives that preserve full meaning while reducing pressure: "Stop running in the house". Address all parts. Safety case: avoid threat/harm warnings; keep a low-pressure alternative like walking speed inside or running outside. Tone: Use "Default": natural, warm, and easy to say out loud. Prefer grounded conversational wording over perfect declarative theory. CRITICAL: Fewer Words is a hard filter: make every option materially shorter than standard mode, usually 4-9 words for simple moments and 6-12 words for multi-step moments. Cut filler such as "it looks like", "seems", "part of", "right now", and long setup phrases unless a word is doing real work. Compact questions are allowed when they soften the demand. Do not use fake choices or question-demands. Outside Equalizing, vary sentence shape so questions are not the only strategy. Keep the important safety, sequence, location, and destination details even when phrasing is clipped. Safety shapes: "Walking inside. Running outside." / "Fast feet fit outside."

Privately draft more candidates than you need, then return only the best 3-4. Keep the winners varied. A winning set should include at least 1-2 options a real caregiver could use immediately. Reject candidates that sound like rules, vague captions, hidden commands, gimmicks, emotional pressure, generic AI phrasing, or tone-mismatched filler. If the tone is Interest Based and an interest was entered, reject every candidate that does not use the interest or a recognizable element from it in a way that logically connects to the task, and reject candidates that incorporate the interest by falsely renaming the real task objects. Return only the JSON array.
```

### Dinner sequence, Equalizing, Fewer Words

- Tone: Equalizing
- Fewer Words: On

```txt
Rewrite into 3-4 declarative alternatives that preserve full meaning while reducing pressure: "Please come down and wash your hands. It's dinner time.". Address all parts. Meal sequence: keep coming down/downstairs when present, handwashing, and meal timing in each option. If the request says come down and wash hands, preserve that order: down, hands, dinner. Do not reverse it into hands first, then down. Tone: Use "Equalizing": make status-leveling the real move. Let the child be the checker, expert, leader, route planner, or destination boss, or let the adult be gently unsure/forgetful. Keep dignity; no mocking, helplessness, sarcasm, or performance. Vary the frame so it does not sound templated. CRITICAL: Fewer Words is a hard filter: make every option materially shorter than standard mode, usually 4-9 words for simple moments and 6-12 words for multi-step moments. Cut filler such as "it looks like", "seems", "part of", "right now", and long setup phrases unless a word is doing real work. Compact questions are allowed when they soften the demand. Do not use fake choices or question-demands. Outside Equalizing, vary sentence shape so questions are not the only strategy. Keep the important safety, sequence, location, and destination details even when phrasing is clipped. Meal shapes: "Dinner is ready. Hands first." / "Downstairs, hands, dinner?" If the request says come down and wash hands, preserve that order: down, hands, dinner. Do not reverse it into hands first, then down. For Equalizing, every compact option still needs an obvious status move: adult unsure/stuck/forgetful, or child as checker/expert/leader. Good shapes: "Wait, do toys go upstairs?" / "I am stuck. Toy route?" / "You know the toy spots." / "Can you check the dinner order?" Plain captions like "Toys upstairs?" do not count as Equalizing.

Privately draft more candidates than you need, then return only the best 3-4. Keep the winners varied. A winning set should include at least 1-2 options a real caregiver could use immediately. Reject candidates that sound like rules, vague captions, hidden commands, gimmicks, emotional pressure, generic AI phrasing, or tone-mismatched filler. If the tone is Interest Based and an interest was entered, reject every candidate that does not use the interest or a recognizable element from it in a way that logically connects to the task, and reject candidates that incorporate the interest by falsely renaming the real task objects. Return only the JSON array.
```

### Cleanup destination, Interest Based, Fewer Words

- Tone: Interest Based
- Fewer Words: On
- Interest: Pokemon

```txt
Rewrite into 3-4 declarative alternatives that preserve full meaning while reducing pressure: "Pick up your toys and put them away upstairs in your room". Address all parts. Cleanup destination: keep both picking up/putting away and the destination. Interest Based cleanup: use "Pokemon" or a recognizable Pokemon element as a route, map, or trainer path while keeping the facts unchanged. Good shapes: "Pokemon-style route for these toys: upstairs to your room." / "Trainer route for these toys: upstairs to your room." Bad shapes: "Pokemon toys," "Pokemon things," any Poke-stop wording for cleanup, "Toy Poke-stop," "upstairs room Poke-stop," "Poke-stop for these," generic "toy team/checkpoint/evolve/pickup challenge/map challenge" language without Pokemon logic, "Pokemon gym challenge" for cleanup, "Pokemon storage," "Toys to the Poke-stop upstairs," or sending toys to a pretend Pokemon place. Tone: Use "Interest Based": every returned suggestion must meaningfully incorporate "Pokemon" or a recognizable element from "Pokemon". Prefer returning exactly 3 strong suggestions over adding a fourth weak filler suggestion. A plain non-interest option is a miss for this tone. A bare name-drop is also a miss; the interest element must do real work in the logic of the sentence by connecting to the task through a relevant action, tool, place, character trait, route, checkpoint, comparison, or relationship. Keep the interest as a grounded connection unless the original request says the interest is physically present. Do not borrow vocabulary from a different interest; for example, do not use Pokemon, Trainer, Poke-stop, Gym, Squirtle, Pikachu, or Pokemon route language unless the entered interest is Pokemon. For Pokemon, favor concrete elements that naturally map to the moment: Squirtle/water/sink, Poke-stop/transition stop, Trainer/route, Pikachu/speed, and careful Pokemon steps. "The sink is like Squirtle, helping with water" and "the sink is our next Poke-stop before dinner" are integrated; "Pokemon quick stop: hands, then dinner" is just a name-drop. Avoid generic game-ish words like team, checkpoint, evolve, challenge, map challenge, or move names unless they are paired with a recognizable Pokemon element and clearly explain the real task. Do not use vague move-language like "rapid-fire attack" for handwashing. Do not use generic "pickup challenge" wording for cleanup unless it includes a Pokemon-specific frame. Do not invent Pokemon objects/cards/TV/plates/props, story worlds, battles, quests, or character actions. Do not rename real objects as Pokemon items unless the caregiver did. Do not put Pokemon directly in front of real task nouns like toys, hands, hand wash, dinner, sink, room, floor, house, cleanup, storage, or things. The real task stays primary. CRITICAL: Fewer Words is a hard filter: make every option materially shorter than standard mode, usually 4-9 words for simple moments and 6-12 words for multi-step moments. Cut filler such as "it looks like", "seems", "part of", "right now", and long setup phrases unless a word is doing real work. Compact questions are allowed when they soften the demand. Do not use fake choices or question-demands. Outside Equalizing, vary sentence shape so questions are not the only strategy. Keep the important safety, sequence, location, and destination details even when phrasing is clipped. Cleanup shapes: "Toys upstairs in your room?" / "Toy reset goes upstairs." For Interest Based, every compact option must still include "Pokemon" or a recognizable element from it, and that element must connect logically to the task. Keep real nouns factual: "Toys up the Pokemon route?" is better than "Pokemon toys upstairs" unless the caregiver said the toys are Pokemon. For Pokemon cleanup, do not use Poke-stop. Use compact Pokemon route or Trainer path language instead.

Privately draft more candidates than you need, then return only the best 3-4. Keep the winners varied. A winning set should include at least 1-2 options a real caregiver could use immediately. Reject candidates that sound like rules, vague captions, hidden commands, gimmicks, emotional pressure, generic AI phrasing, or tone-mismatched filler. If the tone is Interest Based and an interest was entered, reject every candidate that does not use the interest or a recognizable element from it in a way that logically connects to the task, and reject candidates that incorporate the interest by falsely renaming the real task objects. Return only the JSON array.
```

## Historical Comparison Summary

| Prompt Variant | Runs | Verdicts | Avg Usable | Avg Excellent | Prompt Tokens | Output Tokens |
|---|---:|---|---:|---:|---:|---:|
| working-tree-latest-attempt | 40 | Pass 19, Borderline 10, Fail 11 | 1.82 | 0.53 | 27098 | 4706 |
| main-current-production-candidate | 40 | Pass 16, Borderline 9, Fail 15 | 2.33 | 0.33 | 33043 | 5544 |
| conversational-pre-token-reduction-candidate | 40 | Pass 16, Borderline 2, Fail 22 | 1.8 | 0.45 | 40753 | 5413 |

## Evaluator Calibration Status

- Latest calibrated evaluator JSON summary was not found.
- Current recommendation: keep using hybrid evaluation, not raw automated scoring alone.

Evaluator disagreement packet exists at `evals/results/evaluator-calibration-packet.md`.

## Review Questions

1. Which non-pass examples above are actually acceptable because they include one strong caregiver option?
2. Which Interest Based examples feel genuinely connected instead of name-dropped or gimmicky?
3. Do Minecraft, trains, and Disney show enough generalization beyond Pokemon?
4. Are the compact Fewer Words examples too clipped, or are they appropriately low-auditory-load?
5. Are any outputs should-not-show, using the stricter meaning of harmful?
