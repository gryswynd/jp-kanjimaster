# Story written (free-response) comprehension questions

Stories can carry **written** comprehension questions where the student types a
Japanese answer and is graded **leniently**. They live in the same
`comprehension.questions[]` block as MCQ items (a story may mix both) and render
on the end-of-story comprehension card.

## Schema

```jsonc
{
  "type": "written",                 // optional; inferred when `answer` is present and `options` is absent
  "q": "父のなまえは何ですか。",        // prompt (plain JP string)
  "q_en": "What is the father's name?",   // optional English gloss, shown under the prompt
  "answer": "たろうです",             // model answer, revealed after Check
  "accept": ["たろう"],               // optional extra acceptable cores/variants
  "explanation": "父のなまえはたろうです。",  // shown after Check
  "terms": ["v_chichi"]               // optional glossary ids flagged for review on a wrong answer
}
```

MCQ items are unchanged: `{ q, options[], correct, explanation }`.

## Lenient grading (hybrid)

`matchWritten` in `Stories.js`. With `ns = normAns(student)`, `na = normAns(answer)`
(NFKC fold, all whitespace stripped, trailing 。．、！？.!? trimmed; kana/kanji kept):

- accept if `ns === na`
- accept if `na` contains `ns` **or** `ns` contains `na` (a substring-direction hit
  requires `ns` to be 2+ chars or contain a kanji, so a lone particle like `な` fails)
- accept if `ns` contains any normalized `accept[]` entry

So model `とても綺麗な花` accepts `花`, `綺麗な花`, the full phrase, etc. Use `accept`
when the default is too strict (full-sentence model but a short core should pass) — it
only *adds* leniency. To make a question stricter, shorten `answer` itself.

Wrong/blank answers reveal the model answer + explanation, play the error cue, and flag
`terms[]`. Written answers fold into the same in-memory comprehension score and 60%-pass
"next story" CTA as MCQs (no separate persistence).

No audio is generated for these — prompts/answers are displayed and typed, not spoken.

## Progressive rollout schedule

Count ramps from 2 (first N5 story) to 10 (last N4 stories), across the
manifest-ordered stories (N5 = 10 stories, N4 = 19 stories).

| Stories (manifest order) | Written Qs |
|---|---|
| N5 #1–2   | 2  |
| N5 #3–5   | 3  |
| N5 #6–8   | 4  |
| N5 #9–10  | 5  |
| N4 #1–4   | 6  |
| N4 #5–9   | 7  |
| N4 #10–14 | 8  |
| N4 #15–17 | 9  |
| N4 #18–19 | 10 |

**Authored so far:** ✅ **Rollout complete — all 29 curriculum stories (N5 #1–#10 + N4 #1–#19),
181 written questions total.** N5 = 35 (ramp 2→5), N4 = 146 (ramp 6→10). Custom stories are
not part of the JLPT ramp and were intentionally left unquestioned.
