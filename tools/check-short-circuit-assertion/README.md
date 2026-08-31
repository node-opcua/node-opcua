# check-short-circuit-assertion

An assertion must take its subject as an argument, not reach it through `?.` or `!`.

```bash
node tools/check-short-circuit-assertion.mjs          # report, exit 1 on a violation
node tools/check-short-circuit-assertion.mjs --fix    # rewrite, then report what is left
pnpm run check:shortcircuit                           # same, via the root script
```

## Why

```ts
alarm.shelvingState?.getCurrentState().should.eql("Unshelved");
```

`?.` short-circuits the **whole chain**, not just the link it is written on. If
`shelvingState` is undefined the expression evaluates to `undefined` and stops there. The
`.should` is never reached, no assertion runs, and the test passes.

So the check is switched off in exactly the case it was written for: the object is missing.
A test like this cannot fail, and it reads as though it had checked something.

There were **1441** of them, across 14 packages.

## The fix

Wrap the subject instead of reaching through it:

```ts
should(alarm.shelvingState?.getCurrentState()).eql("Unshelved");
```

`should(x)` takes the value as an **argument**, so `undefined` reaches the assertion instead
of skipping it, and the failure says what was expected:

```
AssertionError: expected undefined to equal 'Unshelved'
```

## Why not `!`

`alarm.shelvingState!.getCurrentState()` also makes the test fail, so it looks like a fix.
It is a worse one:

- the failure is a bare `TypeError: Cannot read properties of undefined`, which names
  neither the expected value nor the assertion
- `!` is a claim that the value cannot be null, written in the one place where the whole
  point is that it might be
- biome's `noNonNullAssertion` has to be switched off for `test/**` in `biome.json` to
  allow it at all

`--fix` therefore rewrites `!` on the subject chain back into the `?.` it was standing in
for, and lifts the result into `should(...)`.

## What `--fix` gets right that a regex does not

- **Only the chain that reaches the subject counts.** `foo(a?.b).should.eql(1)` is fine:
  `foo` is still called and still returns something, so the assertion runs. A `!` inside an
  argument is load-bearing too, since it decides the type that argument is checked against.
  Parentheses end a chain rather than continuing it - `(a?.b).c` throws instead of
  short-circuiting - so the rule does not look through them either.

- **A chain that wraps.** The `!` can sit at the end of a line with the `.` on the next one.
  Replacing just the `!` leaves `?` and `.` split by a newline, which is the conditional
  operator: `error TS1109: Expression expected`. The dot is absorbed instead.

  ```ts
  store.getUsers().find((u) => u.userName === "joe")!
      .description.should.equal("new");
  ```

- **Calls and index access.** `f!()` becomes `f?.()` and `a![0]` becomes `a?.[0]`; there is
  no dot to reuse in either.

- **The import.** `should(x)` needs the value, and a test that only ever wrote `x.should`
  may have imported the module for its side effect alone. `import "should"` is promoted to
  `import should from "should"`, and a file with no import at all gets one.

- **A file that binds `should` to something else**, or imports it as a namespace (which is
  not callable), is reported rather than rewritten.

- **Template literals.** This repo generates TypeScript, and the generator tests assert on
  the generated text. A `?.` inside a template literal is data, not code. The rule walks the
  TypeScript AST, so it never sees those.

## What it cannot know

TypeScript narrows a variable assigned only inside a callback, because it cannot see the
callback run. `!` defeated that narrowing as a side effect; `?.` does not, so three sites in
`node-opcua-client` needed the declared type named at the point of use:

```ts
should((err as Error | null)?.message).match(/Invalid Channel BadConnectionClosed/);
```

The rewrite is mechanical and has no type checker behind it, so `check:testtypes` is what
catches this. It found 3 of 1441.

## Opting out

```ts
a?.b.should.eql(1); // check-short-circuit-assertion: ok - reason
```

Rarely the right answer: `should(a?.b)` states the same thing and still fails when the value
is wrong.

## What enabling them found

Four assertions had never run even once:

- `node-opcua-secure-channel`, the corrupted-OpenSecureChannel helper expected an error
  message from `init`'s callback. Its only callers are FUZZ4-6, and the callback reports no
  error for any of them - the abort arrives on the `"abort"` event, which is what the
  sibling FUZZ7 asserts against the same helper.
- `node-opcua-modeler` asserted an empty continuation point on three results whose status is
  `BadNoContinuationPoints`, where there is no continuation point at all.
- `node-opcua-address-space` asserted an exhausted iterator with
  `iterator.current?.should.eql(null)`, which is unreachable precisely when `current` is
  null. The last test in the same file already used `should(iterator.current).eql(null)`.
- `node-opcua-end2end-test` had `_capturedError?.message.should.match(...)` directly below
  `should.not.exist(_capturedError)`. It could only have run if the line above it had
  already failed.
