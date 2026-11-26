# Experimental and unstable parts of node-opcua

`node-opcua` is released continuously. Some parts of it ship before they are complete. There are two kinds, and they ask different things of you.

| Kind | Is it on? | Does it warn? | What can change |
| --- | --- | --- | --- |
| **Experimental feature** | no, you turn it on | yes, one warning for each process | the feature and its API |
| **Unstable API** | yes, when you use it | no | the shape of the API |

Read this page before you use either.

## Experimental features

A feature is Experimental when all of these are true:

- Its API documentation carries the `experimental` tag.
- It is off by default. You turn it on with an explicit option or class.
- The server writes a warning to its log one time for each process when you turn it on.

| Feature | How you turn it on |
| --- | --- |
| Compact address space | the `compactAddressSpace` option of `OPCUAServer` |
| Front-thread engine (front threads and session workers) | the `FrontThreadEngine` class |

## Unstable APIs

An Unstable API is already on when you use it. There is no switch, and the server writes no warning. Its shape can change in any release, a patch release included.

Its API documentation carries the `unstable` tag.

| Feature | How you turn it on |
| --- | --- |
| A server's own AliasNames store | implement the `IAliasStore` interface |

## How to find these from the code

```bash
pnpm run check:experimental:list     # every entry, with its file and line
pnpm run check:experimental          # the tables, the doc blocks and the warnings agree
```

The tag in the source is the record. This page, the doc blocks and the start-up warnings agree with it, because `pnpm run check:experimental` fails when they do not, and it runs in `lint:ci`.

## What you get, and what you do not get

You get:

- the feature, with its tests;
- a fix for a defect that you report, with a regression test;
- the same support channels as any other part of `node-opcua`.

You do not get:

- a stable API. The names, the options and the shapes can change in any release, including a patch release.
- a migration guide for such a change. The release notes tell you what changed.
- a recommendation to use the feature in production. Do not use an Experimental feature in production where security matters.

## How a feature stops being Experimental

The release notes of one release say that the status changed. From that release, the full policy applies to the feature, and these four change together:

1. the table above;
2. the API documentation of the feature, which loses the `experimental` tag;
3. the start-up warning in the code, which goes away;
4. the release notes, which say that the status changed.

## A weakness in an Experimental feature

`SECURITY.md` says how we handle a report about an Experimental feature. The short form: report it in the same way as any other weakness, and we fix it with the same targets, but it does not get a security advisory or a CVE. Read the Experimental Features section of [SECURITY.md](SECURITY.md) for the full rules.

## See also

- [SECURITY.md](SECURITY.md) for how to report a weakness.
- [supported_features.md](supported_features.md) for the OPC UA features that `node-opcua` supports.
- [RELEASE_NOTES.md](RELEASE_NOTES.md) for what changed in each release.
