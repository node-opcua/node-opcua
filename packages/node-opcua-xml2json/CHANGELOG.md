# Changelog

## [Unreleased]

### Changed

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

