# Equalizing Tone Override Before/After Output Review

Generated: 2026-05-03T12-33-06-029Z
Model: gemini-2.5-flash
Temperature: 0.2

## Prompt Variants

### Current live / before update

Use an "Equalizing" tone. Frame the situation as collaborative or as if the child has useful perspective. If the adult needs help or a second opinion, keep it warm and light, not mocking, helpless, or performatively foolish. Preserve dignity and felt safety.

### Equalizing-specific override candidate

Use an "Equalizing" tone: a status-leveling role or adult-uncertainty move is the main declarative frame, not extra flavor. Every suggestion should lower adult authority via child-as-expert/checker/leader, adult-as-unsure/silly/forgetful, or both. For multi-step requests, make the child the route/order/checklist expert. Name the child's role when natural: expert, checker, leader, order boss, or route planner. Use statements, not direct help questions. Keep dignity; avoid mocking, helplessness, sarcasm, praise-pressure, or performance.

## Review Notes

- Look for whether Equalizing becomes the main declarative frame rather than a flavor layer.
- Check whether multi-step routines use route/order/checklist authority instead of generic sequencing.
- Check whether named roles and adult uncertainty feel natural, not forced or repetitive.
- Also check whether suggestions stay declarative and avoid direct help questions.

## equalizing-errand — Errand preparation

Original request: Get your coat and help me check if we have everything for the car.
Fewer Words: No

### Current live / before update

Usage: prompt 809 | candidates 156 | total 965 | Duration: 1526 ms

1. The car is almost ready to go. It's time for coats, and then we can do a quick check for everything we need.
2. It's getting chilly outside, so coats will be good. We could also do a quick scan to make sure we have all our things for the car.
3. I'm wondering if we have everything for the car. A coat would be helpful, and then maybe we could look together.
4. The car is waiting. We could grab coats and then do a final check for our things.

### Equalizing-specific override candidate

Usage: prompt 882 | candidates 213 | total 1095 | Duration: 1722 ms

1. The car is almost ready to go. I wonder if we have everything we need for the trip. Maybe you could be the expert checker for our things, and then we could think about coats.
2. It's time to head out to the car. I'm not sure what the best order is for getting ready. Perhaps we could figure out what we need to bring to the car first, and then we could grab coats.
3. The car is waiting. I'm wondering if you could be the leader and help me make sure we have all our things before we put on our coats.
4. Our adventure is about to begin! I'm not sure if we have everything we need for the car. Maybe you could be the order boss and help me check our things, and then we could get our coats.

### Human Review

```txt
Which version better captures Equalizing?
- 
Where the override version improves things:
- 
Where it feels too forced, too adult-centered, too question-like, or too performative:
- 
Prompt adjustment needed:
- 
```

## equalizing-fewer-words — Short bedtime check

Original request: Come look at this and tell me if I missed a step for bedtime.
Fewer Words: Yes

### Current live / before update

Usage: prompt 835 | candidates 148 | total 983 | Duration: 1352 ms

1. Bedtime is coming up. I was just thinking about the steps and wondered if I missed anything.
2. The bedtime routine is next. I'm trying to remember all the parts and would love a second set of eyes on it.
3. It's almost time for bed. I was just reviewing the steps in my head and wondered if you had any thoughts on them.
4. Bedtime is on the horizon. I'm putting together the plan and was hoping for your input on the steps.

### Equalizing-specific override candidate

Usage: prompt 908 | candidates 158 | total 1066 | Duration: 1390 ms

1. Bedtime is happening. I wonder if you could be the expert checker for the steps tonight.
2. The bedtime routine is underway. It would be super helpful to have an order boss to make sure all the parts are there.
3. It's time for bed. I'm not sure if I've remembered everything on the list. A route planner would know for sure.
4. Bedtime is here. I'm trying to remember all the steps. I wonder if you could be the leader and make sure I don't miss anything.

### Human Review

```txt
Which version better captures Equalizing?
- 
Where the override version improves things:
- 
Where it feels too forced, too adult-centered, too question-like, or too performative:
- 
Prompt adjustment needed:
- 
```

## equalizing-bedtime-multipart — Multi-part bedtime routine

Original request: Please come to the bathroom, get your pajamas on, and bring your book to bed.
Fewer Words: No

### Current live / before update

Usage: prompt 812 | candidates 161 | total 973 | Duration: 1324 ms

1. The bathroom light is on, and pajamas are waiting. It will be time for books in bed soon.
2. Pajamas are laid out, and the book is on the nightstand. It looks like the next step is getting ready for bed.
3. I'm wondering if we're ready for pajamas and a book in bed, or if there's something else we need to do first.
4. It's almost time for bed. The pajamas are ready, and the book is waiting. What do you think is the best way to get there?

### Equalizing-specific override candidate

Usage: prompt 885 | candidates 163 | total 1048 | Duration: 1454 ms

1. The bathroom light is on, and the pajamas are out. I wonder if the book is ready for bed too.
2. It's almost time for bed. You're the expert on the best order for bathroom, pajamas, and book tonight.
3. Pajamas are waiting. I'm not sure if the book comes before or after the bathroom part of the bedtime routine. You're the order boss.
4. The day is winding down. I'm curious about the plan for getting ready for bed, including pajamas, the bathroom, and finding a book.

### Human Review

```txt
Which version better captures Equalizing?
- 
Where the override version improves things:
- 
Where it feels too forced, too adult-centered, too question-like, or too performative:
- 
Prompt adjustment needed:
- 
```

## equalizing-shoes-car — Shoes and car transition

Original request: Put your shoes on and get in the car.
Fewer Words: No

### Current live / before update

Usage: prompt 804 | candidates 107 | total 911 | Duration: 1013 ms

1. The shoes are by the door, and the car is ready to go.
2. It's time to head out, and the car is waiting.
3. I wonder if we're ready for shoes and the car now.
4. The car is all set, and the shoes are right here.

### Equalizing-specific override candidate

Usage: prompt 877 | candidates 180 | total 1057 | Duration: 1406 ms

1. The shoes are by the door, and the car is waiting outside. I wonder what the plan is for getting everything ready to go.
2. It's time to head out. The car is ready, and the shoes are right here. I'm not sure what the best order is for getting ourselves into the car.
3. The car is all set for us, and the shoes are waiting. You're the expert on getting ready to go; what's the first step?
4. The car is outside, and the shoes are here. I'm wondering if you could be the route planner for getting us out the door and into the car.

### Human Review

```txt
Which version better captures Equalizing?
- 
Where the override version improves things:
- 
Where it feels too forced, too adult-centered, too question-like, or too performative:
- 
Prompt adjustment needed:
- 
```

## equalizing-cleanup-snack — Cleanup and snack transition

Original request: Put the blocks away and come to the table for snack.
Fewer Words: No

### Current live / before update

Usage: prompt 806 | candidates 122 | total 928 | Duration: 1209 ms

1. The blocks are on the floor, and the snack is ready on the table.
2. Snack time is starting, and the blocks are still out.
3. I wonder if the blocks could find their home before we head over to the table for snack.
4. It looks like the blocks are waiting to be put away, and there's a snack waiting at the table.

### Equalizing-specific override candidate

Usage: prompt 879 | candidates 158 | total 1037 | Duration: 1283 ms

1. The blocks are on the floor, and the snack is on the table. I wonder which one happens first.
2. Snack time is coming up, and the blocks are still out. You're the expert on how we usually get ready for snack.
3. The table is set for snack, and the blocks are having a party on the rug. I'm not sure what the next step is for the blocks.
4. It's almost snack time, and the blocks are still out. You're the order boss for getting things ready.

### Human Review

```txt
Which version better captures Equalizing?
- 
Where the override version improves things:
- 
Where it feels too forced, too adult-centered, too question-like, or too performative:
- 
Prompt adjustment needed:
- 
```

