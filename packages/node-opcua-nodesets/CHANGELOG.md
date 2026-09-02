# Changelog

## [Unreleased]

### Added

#### A precompiled image next to every NodeSet2 file of the catalog

`nodesets/<name>.ndjson.gz` sits beside each `nodesets/<name>.xml`: the records of the document as JSON Lines, gzip
compressed, with a trailer naming the SHA-256 of the XML it was built from (see the `node-opcua-address-space`
changelog). The Node.js `generateAddressSpace` replays it by itself when given the XML path, so a server built on
the catalog starts faster with nothing to configure. The images are committed and rebuilt by `pnpm run build:images`
(also in `prepublishOnly`); `pnpm run check:nodeset-images` at the repository root fails when an image no longer
matches its XML. `nodesetImages.<name>` maps each nodeset to its image path, for a deployment that ships or loads
the images alone. The package grows by about 0.8 MB.
