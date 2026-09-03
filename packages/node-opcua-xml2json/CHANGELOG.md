# Changelog

## [Unreleased]

### Fixed

- A parser definition handed to several `Xml2Json` instances (the nodeset loader's `Definition` reader is one) was
  rewritten in place into reader states that every instance then shared; two documents parsed at the same time
  mixed their elements. Each parser now builds its own reader states, and a definition stays a plain object.

### Changed

#### `Xml2Json` parses a document delivered in pieces

`parseStream(chunks)` takes an async iterable (or an iterable) of strings or UTF-8 bytes, and `begin()` / `write(chunk)` /
`end()` let a caller drive the pieces itself. Bytes go through a streaming `TextDecoder`, so a multi-byte character or
the byte-order mark may straddle two chunks; a byte-order mark given as text is dropped too. `parseString` is
unchanged.

#### A chunk no longer costs the square of its unread tail

When a chunk ended inside a text run, an attribute value or a name, the parser searched for the end of that record
again from every remaining character, each search scanning to the end of the chunk. A 4 MB text run delivered in
64 KB pieces took 6 seconds; the standard nodeset in 256 KB pieces took 1.2 seconds where the whole string takes
60 ms. The parser now skips to the end of the chunk at once and carries the partial record into the next one.

#### Chunked input is now safe whatever the chunk size, and CDATA sections are read

- The start and the end of a CDATA section were tested against the wrong slice of the input, so a section was
  skipped like a comment and its content lost; nodesets carry none, which is why it went unnoticed. Both checks are
  fixed and covered by a test.
- The end of a comment, of a processing instruction or of a skipped CDATA is recognised by looking back at the
  characters before the `>`; a terminator straddling two `write()` calls was missed. The parser now keeps the last two
  characters between calls, and a test feeds the same document in chunks of 1 to 64 bytes.

#### The reader-state machine and the character loop do less per element

- The parser table of a reader state has no prototype and is probed once per element instead of twice;
  the scratch `data` object of a reader state is allocated on first use rather than for every element; the state
  stack is two parallel arrays rather than a record per element, and the activation count lives on the state.
- Tag names and attribute names are located with one regular-expression step rather than character by character.

#### The parser calls its reader directly

`SaxLtx` accepts handlers (`onStartElement`, `onEndElement`, `onText`) called without the EventEmitter
machinery, and `Xml2Json` uses them; the events are still emitted when no handler is given. A text run made
of white space only, the indentation between two tags, is dropped before it is unescaped, and the element
name split on its namespace prefix is computed once per distinct name. Parsing `Opc.Ua.NodeSet2.xml` is
about 8% faster; no behaviour changes.

