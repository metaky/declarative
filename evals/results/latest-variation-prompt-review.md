# Variation Prompt Review

Generated: 2026-04-19T14-19-33-227Z

This report reviews one-tap variation prompt quality using **Gemini 2.5 Flash**. It is designed for human review before shipping the feature.

## Review Guidance

- Use [variation-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/variation-quality-rubric.md) while reviewing.
- A variation only earns its place if it gives the user a meaningfully different and still usable line.
- Treat task loss, tonal drift, or near-duplicates as blockers.

## variation-default-dinner — Default tone dinner transition

- Tone: Default
- Fewer Words: No
- Text: Please come down and wash your hands. It's dinner time.
- Source translation: Dinner is almost ready. The sink is open for hands.
- Review focus: Stays grounded in the same moment; Warm changes do not become sweeter or more parent-centered; Shorter and playful versions still feel natural

### Shorter

- Duration: 1146 ms
- Usage: promptTokenCount: 882 | candidatesTokenCount: 45 | thoughtsTokenCount: n/a | totalTokenCount: 927 | cachedContentTokenCount: n/a
- Pair similarity: 0.09
- Same opening: No
- Exact duplicate pair: No

1. Dinner is nearly ready. Hand-washing time.
   - Word count delta vs source: -4
   - Opening key: dinner is nearly
   - Similarity to source: 0.25
   - Exact duplicate with source: No
2. Almost dinner. Hands can be washed.
   - Word count delta vs source: -4
   - Opening key: almost dinner hands
   - Similarity to source: 0.25
   - Exact duplicate with source: No

```txt
Variation kind verdict (Shorter): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Longer

- Duration: 1194 ms
- Usage: promptTokenCount: 885 | candidatesTokenCount: 81 | thoughtsTokenCount: n/a | totalTokenCount: 966 | cachedContentTokenCount: n/a
- Pair similarity: 0.22
- Same opening: No
- Exact duplicate pair: No

1. It looks like dinner will be on the table very soon. The sink is all clear if hands need a wash before eating.
   - Word count delta vs source: 13
   - Opening key: it looks like
   - Similarity to source: 0.19
   - Exact duplicate with source: No
2. Dinner is just about ready now. It's often helpful to wash hands before we sit down at the table, and the sink is available.
   - Word count delta vs source: 14
   - Opening key: dinner is just
   - Similarity to source: 0.24
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 936 ms
- Usage: promptTokenCount: 886 | candidatesTokenCount: 58 | thoughtsTokenCount: n/a | totalTokenCount: 944 | cachedContentTokenCount: n/a
- Pair similarity: 0.14
- Same opening: No
- Exact duplicate pair: No

1. Dinner is on the table, and the tap is running for hands.
   - Word count delta vs source: 2
   - Opening key: dinner is on
   - Similarity to source: 0.36
   - Exact duplicate with source: No
2. The food is waiting. It looks like it might be time to get hands washed.
   - Word count delta vs source: 5
   - Opening key: the food is
   - Similarity to source: 0.15
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 959 ms
- Usage: promptTokenCount: 886 | candidatesTokenCount: 48 | thoughtsTokenCount: n/a | totalTokenCount: 934 | cachedContentTokenCount: n/a
- Pair similarity: 0.31
- Same opening: No
- Exact duplicate pair: No

1. Dinner is ready. Time to wash hands.
   - Word count delta vs source: -3
   - Opening key: dinner is ready
   - Similarity to source: 0.33
   - Exact duplicate with source: No
2. Hands could use a wash. Dinner is on the table.
   - Word count delta vs source: 0
   - Opening key: hands could use
   - Similarity to source: 0.27
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 1006 ms
- Usage: promptTokenCount: 898 | candidatesTokenCount: 57 | thoughtsTokenCount: n/a | totalTokenCount: 955 | cachedContentTokenCount: n/a
- Pair similarity: 0.2
- Same opening: No
- Exact duplicate pair: No

1. Dinner magic is happening! Water's ready for hands at the sink.
   - Word count delta vs source: 1
   - Opening key: dinner magic is
   - Similarity to source: 0.54
   - Exact duplicate with source: No
2. The dinner bell is ringing soon. Hands might like a little splash first.
   - Word count delta vs source: 3
   - Opening key: the dinner bell
   - Similarity to source: 0.22
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

## variation-straightforward-school — Straightforward school transition

- Tone: Straightforward
- Fewer Words: No
- Text: Get your backpack and get your shoes on so we can get ready for school
- Source translation: Shoes and backpack are both part of getting out the door for school.
- Review focus: More straightforward does not become bossy; Shorter versions keep both tasks; Playful remains restrained

### Shorter

- Duration: 804 ms
- Usage: promptTokenCount: 968 | candidatesTokenCount: 49 | thoughtsTokenCount: n/a | totalTokenCount: 1017 | cachedContentTokenCount: n/a
- Pair similarity: 0.55
- Same opening: No
- Exact duplicate pair: No

1. Backpack and shoes are next for getting ready for school.
   - Word count delta vs source: -3
   - Opening key: backpack and shoes
   - Similarity to source: 0.47
   - Exact duplicate with source: No
2. Time for school. Backpack and shoes are waiting.
   - Word count delta vs source: -5
   - Opening key: time for school
   - Similarity to source: 0.4
   - Exact duplicate with source: No

```txt
Variation kind verdict (Shorter): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Longer

- Duration: 952 ms
- Usage: promptTokenCount: 971 | candidatesTokenCount: 61 | thoughtsTokenCount: n/a | totalTokenCount: 1032 | cachedContentTokenCount: n/a
- Pair similarity: 0.24
- Same opening: No
- Exact duplicate pair: No

1. It looks like gathering the backpack and putting on shoes both happen before we head out for school.
   - Word count delta vs source: 5
   - Opening key: it looks like
   - Similarity to source: 0.35
   - Exact duplicate with source: No
2. Getting ready for school involves the backpack and shoes, so those are next.
   - Word count delta vs source: 0
   - Opening key: getting ready for
   - Similarity to source: 0.44
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 1122 ms
- Usage: promptTokenCount: 972 | candidatesTokenCount: 69 | thoughtsTokenCount: n/a | totalTokenCount: 1041 | cachedContentTokenCount: n/a
- Pair similarity: 0.29
- Same opening: No
- Exact duplicate pair: No

1. Backpack and shoes are next for school. The door will be open when you're ready.
   - Word count delta vs source: 2
   - Opening key: backpack and shoes
   - Similarity to source: 0.4
   - Exact duplicate with source: No
2. It's time to gather the backpack and get shoes on for school. I'll be over here.
   - Word count delta vs source: 3
   - Opening key: its time to
   - Similarity to source: 0.26
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 1035 ms
- Usage: promptTokenCount: 972 | candidatesTokenCount: 63 | thoughtsTokenCount: n/a | totalTokenCount: 1035 | cachedContentTokenCount: n/a
- Pair similarity: 0.3
- Same opening: No
- Exact duplicate pair: No

1. School is coming up; there's a backpack and shoes that often go with that.
   - Word count delta vs source: 1
   - Opening key: school is coming
   - Similarity to source: 0.18
   - Exact duplicate with source: No
2. There's a backpack and shoes for school whenever you're ready to gather them.
   - Word count delta vs source: 0
   - Opening key: theres a backpack
   - Similarity to source: 0.24
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 963 ms
- Usage: promptTokenCount: 984 | candidatesTokenCount: 65 | thoughtsTokenCount: n/a | totalTokenCount: 1049 | cachedContentTokenCount: n/a
- Pair similarity: 0.14
- Same opening: No
- Exact duplicate pair: No

1. It's time to gather the backpack and pop on some shoes so we can head out for school.
   - Word count delta vs source: 5
   - Opening key: its time to
   - Similarity to source: 0.29
   - Exact duplicate with source: No
2. School is coming up, and getting shoes and a backpack ready helps us move along.
   - Word count delta vs source: 2
   - Opening key: school is coming
   - Similarity to source: 0.23
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

## variation-humorous-bedroom — Humorous bedtime cleanup

- Tone: Humorous
- Fewer Words: No
- Text: Please put your pajamas on and bring your book to bed.
- Source translation: Pajamas and a book seem to have made tonight's bedtime guest list.
- Review focus: Playful refinement does not tip into gimmick; Straightforward refinement stays in tone family; Coverage of both tasks remains intact

### Shorter

- Duration: 828 ms
- Usage: promptTokenCount: 924 | candidatesTokenCount: 55 | thoughtsTokenCount: n/a | totalTokenCount: 979 | cachedContentTokenCount: n/a
- Pair similarity: 0.21
- Same opening: No
- Exact duplicate pair: No

1. Looks like pajamas and a good book are waiting to join you in bed tonight.
   - Word count delta vs source: 3
   - Opening key: looks like pajamas
   - Similarity to source: 0.23
   - Exact duplicate with source: No
2. Tonight's agenda: pajamas and a book for bedtime.
   - Word count delta vs source: -4
   - Opening key: tonights agenda pajamas
   - Similarity to source: 0.43
   - Exact duplicate with source: No

```txt
Variation kind verdict (Shorter): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Longer

- Duration: 1108 ms
- Usage: promptTokenCount: 927 | candidatesTokenCount: 76 | thoughtsTokenCount: n/a | totalTokenCount: 1003 | cachedContentTokenCount: n/a
- Pair similarity: 0.18
- Same opening: No
- Exact duplicate pair: No

1. It looks like the cozy pajamas and a special bedtime book have been invited to join us for a snuggle adventure tonight.
   - Word count delta vs source: 10
   - Opening key: it looks like
   - Similarity to source: 0.27
   - Exact duplicate with source: No
2. Oh, what's this? Pajamas and a good story seem to be making their grand entrance for our bedtime routine!
   - Word count delta vs source: 7
   - Opening key: oh whats this
   - Similarity to source: 0.24
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 1051 ms
- Usage: promptTokenCount: 928 | candidatesTokenCount: 65 | thoughtsTokenCount: n/a | totalTokenCount: 993 | cachedContentTokenCount: n/a
- Pair similarity: 0.11
- Same opening: No
- Exact duplicate pair: No

1. Looks like pajamas and a good book are waiting for a very special bedtime journey tonight.
   - Word count delta vs source: 4
   - Opening key: looks like pajamas
   - Similarity to source: 0.23
   - Exact duplicate with source: No
2. Tonight's agenda includes a cozy pajama party and a captivating storybook for the big adventure to bed.
   - Word count delta vs source: 5
   - Opening key: tonights agenda includes
   - Similarity to source: 0.17
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 827 ms
- Usage: promptTokenCount: 928 | candidatesTokenCount: 55 | thoughtsTokenCount: n/a | totalTokenCount: 983 | cachedContentTokenCount: n/a
- Pair similarity: 0.47
- Same opening: No
- Exact duplicate pair: No

1. Looks like the pajamas and that book are ready for our bedtime adventure.
   - Word count delta vs source: 1
   - Opening key: looks like the
   - Similarity to source: 0.19
   - Exact duplicate with source: No
2. Our pajamas are waiting, and the book for bedtime is right here.
   - Word count delta vs source: 0
   - Opening key: our pajamas are
   - Similarity to source: 0.2
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 914 ms
- Usage: promptTokenCount: 940 | candidatesTokenCount: 63 | thoughtsTokenCount: n/a | totalTokenCount: 1003 | cachedContentTokenCount: n/a
- Pair similarity: 0.21
- Same opening: No
- Exact duplicate pair: No

1. Looks like pajamas and a good book are looking for their bedtime adventure buddy.
   - Word count delta vs source: 2
   - Opening key: looks like pajamas
   - Similarity to source: 0.24
   - Exact duplicate with source: No
2. Oh, it's time for pajamas to meet their favorite book, and off they go to bed!
   - Word count delta vs source: 4
   - Opening key: oh its time
   - Similarity to source: 0.17
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

## variation-equalizing-bathroom — Equalizing multi-part bedtime

- Tone: Equalizing
- Fewer Words: No
- Text: Please come to the bathroom, get your pajamas on, and bring your book to bed.
- Source translation: The bathroom, pajamas, and book all seem to be looking for a good bedtime order.
- Review focus: Equalizing stays natural and not performative; Multi-part coverage remains complete; Longer and warmer versions stay low-pressure

### Shorter

- Duration: 827 ms
- Usage: promptTokenCount: 933 | candidatesTokenCount: 60 | thoughtsTokenCount: n/a | totalTokenCount: 993 | cachedContentTokenCount: n/a
- Pair similarity: 0.3
- Same opening: No
- Exact duplicate pair: No

1. I wonder what order the bathroom, pajamas, and book want to go in tonight.
   - Word count delta vs source: -1
   - Opening key: i wonder what
   - Similarity to source: 0.32
   - Exact duplicate with source: No
2. The bathroom, pajamas, and book seem to be wondering about the bedtime plan.
   - Word count delta vs source: -2
   - Opening key: the bathroom pajamas
   - Similarity to source: 0.5
   - Exact duplicate with source: No

```txt
Variation kind verdict (Shorter): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Longer

- Duration: 1044 ms
- Usage: promptTokenCount: 936 | candidatesTokenCount: 84 | thoughtsTokenCount: n/a | totalTokenCount: 1020 | cachedContentTokenCount: n/a
- Pair similarity: 0.28
- Same opening: No
- Exact duplicate pair: No

1. I wonder if the bathroom, pajamas, and book are all waiting to see what order feels best for tonight's bedtime routine.
   - Word count delta vs source: 6
   - Opening key: i wonder if
   - Similarity to source: 0.38
   - Exact duplicate with source: No
2. There's a bathroom, pajamas, and a book all here, and I'm curious what the best next step is for getting ready for bed.
   - Word count delta vs source: 8
   - Opening key: theres a bathroom
   - Similarity to source: 0.3
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 924 ms
- Usage: promptTokenCount: 937 | candidatesTokenCount: 68 | thoughtsTokenCount: n/a | totalTokenCount: 1005 | cachedContentTokenCount: n/a
- Pair similarity: 0.29
- Same opening: No
- Exact duplicate pair: No

1. I wonder what order feels best for the bathroom, pajamas, and the book before bed.
   - Word count delta vs source: 0
   - Opening key: i wonder what
   - Similarity to source: 0.32
   - Exact duplicate with source: No
2. The bathroom is ready, pajamas are waiting, and the book is here. What feels like a good next step?
   - Word count delta vs source: 4
   - Opening key: the bathroom is
   - Similarity to source: 0.28
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 947 ms
- Usage: promptTokenCount: 937 | candidatesTokenCount: 65 | thoughtsTokenCount: n/a | totalTokenCount: 1002 | cachedContentTokenCount: n/a
- Pair similarity: 0.36
- Same opening: No
- Exact duplicate pair: No

1. It looks like the bathroom, pajamas, and book are all part of getting ready for bed.
   - Word count delta vs source: 1
   - Opening key: it looks like
   - Similarity to source: 0.29
   - Exact duplicate with source: No
2. The bathroom is ready, and it's time to find pajamas and a book for bed.
   - Word count delta vs source: 0
   - Opening key: the bathroom is
   - Similarity to source: 0.38
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 910 ms
- Usage: promptTokenCount: 949 | candidatesTokenCount: 79 | thoughtsTokenCount: n/a | totalTokenCount: 1028 | cachedContentTokenCount: n/a
- Pair similarity: 0.32
- Same opening: No
- Exact duplicate pair: No

1. I wonder if the bathroom, pajamas, and book would like to arrange themselves for bedtime. What do you think?
   - Word count delta vs source: 4
   - Opening key: i wonder if
   - Similarity to source: 0.31
   - Exact duplicate with source: No
2. There's a bathroom, pajamas, and a book all here. I wonder if there's a favorite order for those things at bedtime.
   - Word count delta vs source: 6
   - Opening key: theres a bathroom
   - Similarity to source: 0.38
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

## variation-interest-dinosaur — Interest-based bedtime with dinosaur

- Tone: Interest Based
- Fewer Words: No
- Interest: Dinosaurs
- Text: Please come to the bathroom, brush your teeth, and bring your dinosaur to bed.
- Source translation: The bathroom is the next dinosaur stop, and bedtime still has room for teeth plus a dinosaur companion.
- Review focus: Interest stays grounded and not gimmicky; All parts remain present; Warm and playful variants keep the dinosaur connection light

### Shorter

- Duration: 950 ms
- Usage: promptTokenCount: 931 | candidatesTokenCount: 63 | thoughtsTokenCount: n/a | totalTokenCount: 994 | cachedContentTokenCount: n/a
- Pair similarity: 0.38
- Same opening: No
- Exact duplicate pair: No

1. It looks like the bathroom is ready for teeth, and then the dinosaur can go to bed.
   - Word count delta vs source: -1
   - Opening key: it looks like
   - Similarity to source: 0.28
   - Exact duplicate with source: No
2. Brushing teeth happens in the bathroom, and the dinosaur can join us for bed.
   - Word count delta vs source: -4
   - Opening key: brushing teeth happens
   - Similarity to source: 0.26
   - Exact duplicate with source: No

```txt
Variation kind verdict (Shorter): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Longer

- Duration: 1130 ms
- Usage: promptTokenCount: 934 | candidatesTokenCount: 103 | thoughtsTokenCount: n/a | totalTokenCount: 1037 | cachedContentTokenCount: n/a
- Pair similarity: 0.28
- Same opening: No
- Exact duplicate pair: No

1. The bathroom is ready as the next dinosaur adventure stop, and after that, bedtime has a cozy spot waiting for teeth that are brushed and a dinosaur friend tucked in beside you.
   - Word count delta vs source: 14
   - Opening key: the bathroom is
   - Similarity to source: 0.39
   - Exact duplicate with source: No
2. It looks like the bathroom might be the perfect next place for our dinosaur friend to visit, and then after that, we can think about getting teeth brushed and making sure the dinosaur is all settled for bedtime.
   - Word count delta vs source: 20
   - Opening key: it looks like
   - Similarity to source: 0.23
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 922 ms
- Usage: promptTokenCount: 935 | candidatesTokenCount: 74 | thoughtsTokenCount: n/a | totalTokenCount: 1009 | cachedContentTokenCount: n/a
- Pair similarity: 0.23
- Same opening: No
- Exact duplicate pair: No

1. The bathroom is open for dinosaur explorers, and soon the teeth will be clean for bedtime, with a special dino friend ready too.
   - Word count delta vs source: 5
   - Opening key: the bathroom is
   - Similarity to source: 0.32
   - Exact duplicate with source: No
2. It's time for the bathroom adventure, where teeth get cleaned and a dinosaur buddy waits for bed.
   - Word count delta vs source: -1
   - Opening key: its time for
   - Similarity to source: 0.28
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 875 ms
- Usage: promptTokenCount: 935 | candidatesTokenCount: 69 | thoughtsTokenCount: n/a | totalTokenCount: 1004 | cachedContentTokenCount: n/a
- Pair similarity: 0.38
- Same opening: No
- Exact duplicate pair: No

1. It is time for teeth brushing, and the dinosaur can join you in the bathroom before you both head to bed.
   - Word count delta vs source: 3
   - Opening key: it is time
   - Similarity to source: 0.25
   - Exact duplicate with source: No
2. The bathroom is open for teeth brushing, and then the dinosaur friend is ready for bed too.
   - Word count delta vs source: -1
   - Opening key: the bathroom is
   - Similarity to source: 0.3
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 951 ms
- Usage: promptTokenCount: 947 | candidatesTokenCount: 77 | thoughtsTokenCount: n/a | totalTokenCount: 1024 | cachedContentTokenCount: n/a
- Pair similarity: 0.36
- Same opening: No
- Exact duplicate pair: No

1. Looks like the bathroom is ready for a dinosaur explorer, and then it's time for teeth and a special dino cuddle in bed.
   - Word count delta vs source: 5
   - Opening key: looks like the
   - Similarity to source: 0.29
   - Exact duplicate with source: No
2. A little bit later, the bathroom adventure begins for teeth, and the dinosaur friend is ready for bed right after.
   - Word count delta vs source: 2
   - Opening key: a little bit
   - Similarity to source: 0.31
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

## variation-fewer-words-lunch — Fewer Words lunch transition

- Tone: Straightforward
- Fewer Words: Yes
- Text: Wash your hands and come to the kitchen for lunch.
- Source translation: Hands first, then the kitchen for lunch.
- Review focus: Longer becomes a true expansion option; Compact tone still sounds human; No task loss

### Longer

- Duration: 904 ms
- Usage: promptTokenCount: 993 | candidatesTokenCount: 67 | thoughtsTokenCount: n/a | totalTokenCount: 1060 | cachedContentTokenCount: n/a
- Pair similarity: 0.32
- Same opening: No
- Exact duplicate pair: No

1. It looks like the next thing is washing hands, and then lunch is ready in the kitchen.
   - Word count delta vs source: 10
   - Opening key: it looks like
   - Similarity to source: 0.29
   - Exact duplicate with source: No
2. Washing hands and then going to the kitchen for lunch, that's what's happening now.
   - Word count delta vs source: 7
   - Opening key: washing hands and
   - Similarity to source: 0.4
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 908 ms
- Usage: promptTokenCount: 994 | candidatesTokenCount: 59 | thoughtsTokenCount: n/a | totalTokenCount: 1053 | cachedContentTokenCount: n/a
- Pair similarity: 0.44
- Same opening: No
- Exact duplicate pair: No

1. It's time to wash hands, and then lunch is ready in the kitchen.
   - Word count delta vs source: 6
   - Opening key: its time to
   - Similarity to source: 0.33
   - Exact duplicate with source: No
2. Hands could use a wash, and then the kitchen is calling for lunch.
   - Word count delta vs source: 6
   - Opening key: hands could use
   - Similarity to source: 0.43
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 767 ms
- Usage: promptTokenCount: 994 | candidatesTokenCount: 52 | thoughtsTokenCount: n/a | totalTokenCount: 1046 | cachedContentTokenCount: n/a
- Pair similarity: 0.36
- Same opening: No
- Exact duplicate pair: No

1. It's time to wash hands, then lunch in the kitchen.
   - Word count delta vs source: 3
   - Opening key: its time to
   - Similarity to source: 0.42
   - Exact duplicate with source: No
2. Hands need washing; lunch is ready in the kitchen.
   - Word count delta vs source: 2
   - Opening key: hands need washing
   - Similarity to source: 0.33
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 822 ms
- Usage: promptTokenCount: 1006 | candidatesTokenCount: 55 | thoughtsTokenCount: n/a | totalTokenCount: 1061 | cachedContentTokenCount: n/a
- Pair similarity: 0.17
- Same opening: No
- Exact duplicate pair: No

1. Hands need a wash, then lunch is ready in the kitchen.
   - Word count delta vs source: 4
   - Opening key: hands need a
   - Similarity to source: 0.38
   - Exact duplicate with source: No
2. Time for hands to get clean; the kitchen's waiting for lunch.
   - Word count delta vs source: 4
   - Opening key: time for hands
   - Similarity to source: 0.31
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

## variation-multipart-cleanup — Multi-part cleanup and transition

- Tone: Default
- Fewer Words: No
- Text: Please put your plate in the sink, wipe your hands, and come sit on the couch with me.
- Source translation: The sink, clean hands, and the couch are all part of where this moment is headed.
- Review focus: Three-part requests remain complete; Shorter does not collapse into abstraction; Warmer does not add pressure

### Shorter

- Duration: 916 ms
- Usage: promptTokenCount: 896 | candidatesTokenCount: 61 | thoughtsTokenCount: n/a | totalTokenCount: 957 | cachedContentTokenCount: n/a
- Pair similarity: 0.25
- Same opening: No
- Exact duplicate pair: No

1. The plate could go to the sink, then hands wiped, and the couch is ready for sitting.
   - Word count delta vs source: 1
   - Opening key: the plate could
   - Similarity to source: 0.25
   - Exact duplicate with source: No
2. Sink, clean hands, and the couch are next on the agenda.
   - Word count delta vs source: -5
   - Opening key: sink clean hands
   - Similarity to source: 0.39
   - Exact duplicate with source: No

```txt
Variation kind verdict (Shorter): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Longer

- Duration: 1308 ms
- Usage: promptTokenCount: 899 | candidatesTokenCount: 92 | thoughtsTokenCount: n/a | totalTokenCount: 991 | cachedContentTokenCount: n/a
- Pair similarity: 0.32
- Same opening: No
- Exact duplicate pair: No

1. Dinner plates often like to land in the sink when we're done, and it looks like clean hands and a cozy spot on the couch could be next.
   - Word count delta vs source: 12
   - Opening key: dinner plates often
   - Similarity to source: 0.18
   - Exact duplicate with source: No
2. It can be nice when the plate finds its way to the sink after eating, and then it's time to get hands clean before settling in on the couch.
   - Word count delta vs source: 13
   - Opening key: it can be
   - Similarity to source: 0.18
   - Exact duplicate with source: No

```txt
Variation kind verdict (Longer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### Warmer

- Duration: 1101 ms
- Usage: promptTokenCount: 900 | candidatesTokenCount: 80 | thoughtsTokenCount: n/a | totalTokenCount: 980 | cachedContentTokenCount: n/a
- Pair similarity: 0.29
- Same opening: No
- Exact duplicate pair: No

1. I'm thinking about the plate finding its way to the sink, hands getting a quick wipe, and then settling onto the couch.
   - Word count delta vs source: 6
   - Opening key: im thinking about
   - Similarity to source: 0.17
   - Exact duplicate with source: No
2. Looks like the next steps involve the plate heading to the sink, hands getting clean, and then some time together on the couch.
   - Word count delta vs source: 7
   - Opening key: looks like the
   - Similarity to source: 0.21
   - Exact duplicate with source: No

```txt
Variation kind verdict (Warmer): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More straightforward

- Duration: 982 ms
- Usage: promptTokenCount: 900 | candidatesTokenCount: 78 | thoughtsTokenCount: n/a | totalTokenCount: 978 | cachedContentTokenCount: n/a
- Pair similarity: 0.33
- Same opening: No
- Exact duplicate pair: No

1. Dinner plates often go to the sink when we're done, and then hands get wiped before moving to the couch.
   - Word count delta vs source: 4
   - Opening key: dinner plates often
   - Similarity to source: 0.18
   - Exact duplicate with source: No
2. The next steps are for the plate to find the sink, hands to get wiped, and then there's time on the couch.
   - Word count delta vs source: 6
   - Opening key: the next steps
   - Similarity to source: 0.22
   - Exact duplicate with source: No

```txt
Variation kind verdict (More straightforward): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

### More playful

- Duration: 987 ms
- Usage: promptTokenCount: 912 | candidatesTokenCount: 70 | thoughtsTokenCount: n/a | totalTokenCount: 982 | cachedContentTokenCount: n/a
- Pair similarity: 0.25
- Same opening: No
- Exact duplicate pair: No

1. I wonder what fun adventures the plate, clean hands, and the couch will get up to next.
   - Word count delta vs source: 1
   - Opening key: i wonder what
   - Similarity to source: 0.19
   - Exact duplicate with source: No
2. It looks like the plate, clean hands, and a cozy spot on the couch are all lined up for us.
   - Word count delta vs source: 4
   - Opening key: it looks like
   - Similarity to source: 0.26
   - Exact duplicate with source: No

```txt
Variation kind verdict (More playful): Pass / Borderline / Fail
What worked:
- 
What felt too close to the source:
- 
What drifted or felt risky:
- 
Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```

