# Changelog

## [Unreleased]

### Changed

#### Cloning an array of strings or numbers copies the array, not each element

`Variant.clone` (and so `DataValue.clone`, `UAVariable.readValue` and `extractRange`) walked every element of a
plain array through the element cloner even for element types that are immutable and came back unchanged. A
variable holding a million strings cost 156ms per read; it now costs 3ms, the same copy of the array with the
same elements. Arrays of ByteString, DateTime, NodeId, ExpandedNodeId, LocalizedText, QualifiedName, Variant and
ExtensionObject are still copied element by element.
