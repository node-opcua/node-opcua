# code_gen — generated artifacts pipeline

**Never hand-edit a generated artifact.** Everything under this directory feeds a
generator whose output is committed. If a NodeId, a StatusCode or a DataType is
missing, it is missing *upstream* — refresh the source material and regenerate.
Hand-patching the output makes the next regeneration silently revert the fix.

## Source of truth

All identifiers come from the OPC Foundation `UA-Nodeset` repository, branch
`latest`:

<https://github.com/OPCFoundation/UA-Nodeset>

`fetch.mjs` downloads it into `code_gen/latest/` (gitignored — it is a scratch
download, not an input you edit).

## Workflow

```bash
node code_gen/fetch.mjs
```

Then propagate, from the repository root:

| Committed artifact | Regenerate with | Source |
|---|---|---|
| `code_gen/NodeIds.csv` | `cp code_gen/latest/NodeIds.csv code_gen/NodeIds.csv` | upstream snapshot, kept for review diffs |
| `packages/node-opcua-constants/source/opcua_node_ids.ts` | `node code_gen/generate_node_ids.mjs` | `code_gen/latest/NodeIds.csv` |
| `packages/node-opcua-status-code/source/_generated_status_codes.ts` | `node code_gen/generate_status_code.mjs` | `code_gen/latest/StatusCode.csv` |
| `packages/node-opcua-types/xmlschemas/Opc.Ua.Types.bsd` | `cp code_gen/latest/Opc.Ua.Types.bsd packages/node-opcua-types/xmlschemas/` | upstream |
| `packages/node-opcua-types/source/_generated_opcua_types.ts` | `pnpm run generate:types` | the `.bsd` above |
| `packages/node-opcua-nodesets/nodesets/*.xml` | `cp code_gen/latest/<file>.xml packages/node-opcua-nodesets/nodesets/` | upstream |
| `packages/node-opcua-nodeset-*/source/**` | `pnpm run generate:nodesets` | the nodeset XML above |

Then `npx tsc -b packages` and run the test suites.

## Ordering constraint

`node-opcua-types` generation resolves each DataType's `dataTypeNodeId` and its
three encoding NodeIds by **name lookup into `node-opcua-constants`**
(`DataTypeIds[name]`, `ObjectIds[name + "_Encoding_DefaultBinary"]`, …). A type
present in the `.bsd` but absent from `opcua_node_ids.ts` silently generates with
NodeId `0`. So always regenerate in this order:

1. `generate_node_ids.mjs` → `opcua_node_ids.ts`
2. `tsc -b packages/node-opcua-constants`
3. `pnpm run generate:types`

## Generation is not part of the build

`pnpm run build` and `pnpm run build:all` never regenerate the nodeset packages.
Their output is committed, so regeneration is a deliberate developer action —
run `pnpm run generate:nodesets` when a nodeset XML or the convert tool changed,
and commit the result. `build:all` only adds `generate:types`, because
`_generated_opcua_types.ts` is gitignored and has to be produced at build time.

## Versions of generated packages

The convert tool never re-stamps a `node-opcua-nodeset-*` package with the
monorepo release version: it keeps whatever version the package already carries,
and only a package that does not exist yet is seeded from
`node-opcua-address-space`. Version bumping belongs to `lerna version`, which
bumps only what changed — restamping every regenerated package would move
packages lerna left behind and break `pnpm run consistency` for the dependants
still pinning the older version.

## Notes

- `packages/node-opcua-types/source/_generated_opcua_types.ts` is **gitignored**;
  it is produced at build time from the committed `.bsd`. The `.bsd` is the
  reviewable artifact.
- Refreshing from `latest` sweeps in every type that has landed upstream since
  the previous refresh, not just the one you came for. Land that as its own
  commit, separate from the feature that motivated it.
- A refresh can surface constructs the generator does not yet handle (an array of
  an enumeration did, in the 1.05.07 refresh). Extend the generator rather than
  trimming the upstream file.
