# Changelog

## [Unreleased]

### Changed

#### The parser calls its reader directly

`SaxLtx` accepts handlers (`onStartElement`, `onEndElement`, `onText`) called without the EventEmitter
machinery, and `Xml2Json` uses them; the events are still emitted when no handler is given. A text run made
of white space only, the indentation between two tags, is dropped before it is unescaped, and the element
name split on its namespace prefix is computed once per distinct name. Parsing `Opc.Ua.NodeSet2.xml` is
about 8% faster; no behaviour changes.

