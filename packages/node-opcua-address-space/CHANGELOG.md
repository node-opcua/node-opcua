# Changelog

## [Unreleased]

### Fixed

#### The `Historizing` attribute of a `UAVariable` is no longer lost by the NodeSet2 serialisation layer ([#1550](https://github.com/node-opcua/node-opcua/issues/1550))

`Historizing` is a first class attribute of `UAVariable` in `UANodeSet.xsd`, but it used to be dropped in
both directions: the exporter never wrote it, and the loader hardcoded `historizing: false`.

- **Export** — `namespace.toNodeset2XML()` now emits `Historizing="true"` on a `<UAVariable>` element whose
  variable has `historizing === true`. As for `AccessLevel` and `MinimumSamplingInterval`, the XSD default is
  not written: a variable with `historizing === false` produces no `Historizing` attribute. The attribute is
  never emitted on `<UAVariableType>` elements, which `UANodeSet.xsd` does not allow it on.
- **Import** — a `<UAVariable Historizing="true">` element now yields a `UAVariable` with
  `historizing === true`. A missing attribute still yields `false`, as per the XSD default.

**Impact:** consumers that used to observe a constant `historizing === false` on variables loaded from a
NodeSet2 file will now see `true` for the variables that the file actually declares as historized — for
instance the two `LocalCoordinate` variables of `Opc.Ua.AutoID.NodeSet2.xml`. This only restores the fidelity
of the attribute: no historian is installed and no historical data is collected as a result.
