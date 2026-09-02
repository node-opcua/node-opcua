# check-construction-cast

An implementation class is published as itself, not through a constructor cast.

```bash
node tools/check-construction-cast.mjs
node tools/check-construction-cast.mjs --package node-opcua-address-space
```

## The rule

Reject an `as` conversion whose target is a constructor type:

```ts
export type UAConditionImpl = UAConditionImplBase & UAConditionEx;
export const UAConditionImpl = UAConditionImplBase as unknown as new () => UAConditionImpl;
```

Ordinary narrowing (`node as UAConditionEx`) is not the rule's business, and a
constructor type in a normal position (`function f(ctor: new () => Foo)`) is fine. Only the
conversion is rejected.

## Why

The cast appears when a class cannot state that it implements its own published interface,
usually because the address space installs its child nodes at run time and the class never
declares them. It asserts something the compiler cannot check, so the class and the
interface it claims are then free to drift apart.

They did. `node-opcua-address-space` carried fifteen of these, and behind them:

- a class whose declared base was wrong - a Transition typed as a bare `BaseNode` rather
  than the `UAObject` it actually is
- an alarm requiring a `setpointNodeNode` its own shared interface declared optional
- a `getValueAsString` returning a wider type than the interface promised

Each was invisible while the cast stood between the class and its interface. Removing the
casts is what surfaced them.

## The fix

`declare` the child nodes the address space installs, then say `implements` and export the
class itself:

```ts
export class UAConditionImplBase extends UABaseEventImplBase implements UAConditionEx {
    declare public readonly branchId: UAProperty<NodeId, DataType.NodeId>;
    // ...
}
export type UAConditionImpl = UAConditionImplBase;
export const UAConditionImpl = UAConditionImplBase;
```

`declare` matters beyond types: with `useDefineForClassFields` - the default from target
es2022, which this repository uses - a plain field would define the property as `undefined`
in the constructor and clobber the real child node. `declare` emits nothing.

## Opting out

Some classes genuinely cannot satisfy one interface. `UAMultiStateValueDiscreteImplBase`
serves both `UAMultiStateValueDiscreteEx` (scalar) and `UAMultiStateValueDiscreteArrayEx`
(array), which disagree on purpose - `getValueAsString` returns `string` for one and
`string[]` for the other - so `implements` on either would be a false claim about the other
half. Keep the cast and give it a reason:

```ts
// check-construction-cast: ok - serves both the scalar and the array interface
```

Exemptions are counted in the report rather than hidden, so the list stays visible.

## Scope

Shipped source only, taken from each package's `files` array via
`tools/shared/shipped_dirs.mjs` rather than a hardcoded `source`/`src`. Test trees are not
scanned: this is about what the published API claims.
