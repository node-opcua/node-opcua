# code_gen — generated artifacts pipeline

**Never hand-edit a generated artifact.** Everything under this directory feeds a
generator whose output is committed. If a NodeId, a StatusCode or a DataType is
missing, it is missing *upstream* — refresh the source material and regenerate.
Hand-patching the output makes the next regeneration silently revert the fix.

## Source of truth

All identifiers come from the OPC Foundation `UA-Nodeset` repository, branch
`latest`:

<https://github.com/OPCFoundation/UA-Nodeset>

`fetch.js` downloads it into `code_gen/latest/` (gitignored — it is a scratch
download, not an input you edit).

## Workflow

```bash
node code_gen/fetch.js
```

Then propagate, from the repository root:

| Committed artifact | Regenerate with | Source |
|---|---|---|
| `code_gen/NodeIds.csv` | `cp code_gen/latest/NodeIds.csv code_gen/NodeIds.csv` | upstream snapshot, kept for review diffs |
| `packages/node-opcua-constants/source/opcua_node_ids.ts` | `node code_gen/generate_node_ids.js` | `code_gen/latest/NodeIds.csv` |
| `packages/node-opcua-status-code/source/_generated_status_codes.ts` | `node code_gen/generate_status_code.js` | `code_gen/latest/StatusCode.csv` |
| `packages/node-opcua-types/xmlschemas/Opc.Ua.Types.bsd` | `cp code_gen/latest/Opc.Ua.Types.bsd packages/node-opcua-types/xmlschemas/` | upstream |
| `packages/node-opcua-types/source/_generated_opcua_types.ts` | `pnpm --filter node-opcua-types run generate` | the `.bsd` above |
| `packages/node-opcua-nodesets/nodesets/*.xml` | `cp code_gen/latest/<file>.xml packages/node-opcua-nodesets/nodesets/` | upstream |
| `packages/node-opcua-nodeset-*/source/**` | `pnpm --filter node-opcua-nodeset-<x> run generate` | the nodeset XML above |

Then `npx tsc -b packages` and run the test suites.

## Ordering constraint

`node-opcua-types` generation resolves each DataType's `dataTypeNodeId` and its
three encoding NodeIds by **name lookup into `node-opcua-constants`**
(`DataTypeIds[name]`, `ObjectIds[name + "_Encoding_DefaultBinary"]`, …). A type
present in the `.bsd` but absent from `opcua_node_ids.ts` silently generates with
NodeId `0`. So always regenerate in this order:

1. `generate_node_ids.js` → `opcua_node_ids.ts`
2. `tsc -b packages/node-opcua-constants`
3. `pnpm --filter node-opcua-types run generate`

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
