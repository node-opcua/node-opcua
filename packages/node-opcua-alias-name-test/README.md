# node-opcua-alias-name-test

Cross-package integration tests and a standalone sample server for OPC UA **AliasNames**
(OPC 10000-17).

These packages let a Server publish **its own** AliasNames and let a Client resolve them.
They do **not** aggregate AliasNames collected from other Servers: Annex B (aggregating
Server) and Annex C (GDS) of OPC 10000-17, and the Annex D PubSub change notification,
are out of scope. Anything that requires knowing about more than one Server is not
implemented here.

Private package — not published.

see http://node-opcua.github.io/

## What it is for

The unit suites in `node-opcua-alias-name-server` and `node-opcua-alias-name-client` drive
`method.execute()` and a `PseudoSession` **in process**, which cannot show four things:
**encoding**, **chunking on a large result**, **permissions under a real session**, and
**session lifetime**. Everything here goes over a real TCP transport to close exactly
those.

[SCENARIOS.md](./SCENARIOS.md) says what each scenario proves and why it cannot be proved
anywhere else, and lists the known gaps.

## The sample server

```bash
npm run sample-server --workspace node-opcua-alias-name-test
```

A real `OPCUAServer` publishing a small ISA-5.1 style tag tree over explicitly modelled
Nodes — which is the bridge the feature exists for:

```text
Aliases                                 (i=23470)
 +- TagVariables                        (i=23479)
     +- TI101      -> Plant/Unit100/Reactor/TemperatureIndicator
     +- FIT-101    -> Plant/Unit100/Reactor/FlowIndicatorTransmitter
     +- Unit200                         (a vendor subcategory)
         +- LSH-201 -> Plant/Unit200/Tank/LevelSwitchHigh
```

`LSH-201` is nested on purpose: finding it from the `Aliases` root is what proves the
search is recursive (clause 6.3.1), and `FindAliasVerbose` must report `Unit200` rather
than the category the call was made on (clause 6.3.3).

| Flag | Meaning |
|---|---|
| `--port <n>` | TCP port (default 48557) |
| `--bulk <n>` | add `n` extra aliases under a `Bulk` category, for a large result |
| `--no-anonymous` | require authentication |
| `--pki <folder>` | PKI root (default: a temp folder) |

Two demo users: `engineer` / `engineer-pw1` sees everything; `contractor` /
`contractor-pw1` is denied the `Unit200` category, which makes the per-category read gate
observable from a Client.

The server advertises the **`ALIAS`** capability (OPC 10000-12 Annex D Table D.1). This is
required, not optional: a Server that omits it is never discovered by anything looking for
alias-capable Servers, and nothing reports the failure.

### For UACTT

Start it, point the tool at the printed endpoint, and exercise `FindAlias` on `Aliases`
(`i=23470`). The relevant conformance units are *AliasName Base*, *AliasName Hierarchy*,
*AliasName Category Tags*, *AliasName Category Topics*, and *AliasName FindAliasVerbose*
(CU 5869). *AliasName Configuration Support* (CU 5874) will not pass — the configuration
Methods are not implemented in this release.

## Running the tests

```bash
npm test --workspace node-opcua-alias-name-test
```

They start real servers on ports 48561–48563, so they are slower than the unit suites and
need those ports free.

## License

MIT — see [LICENSE](./LICENSE).
