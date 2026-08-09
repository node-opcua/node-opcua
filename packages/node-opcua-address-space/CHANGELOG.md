# Changelog

## [Unreleased]

### Security

#### Per-node `RolePermissions` and `AccessRestrictions` are no longer dropped when loading a NodeSet2 file

The loader had no reference to `RolePermissions` at all and read `AccessRestrictions` only on `<Model>`,
never per node, so a nodeset declaring a per-node access policy loaded fail-open: the policy simply
vanished. The exporter dropped the same two, so a load / dump round trip silently widened access.

- **Import** — the `AccessRestrictions` and `HasNoPermissions` attributes and the `<RolePermissions>`
  element are now read on every node class and installed through `setAccessRestrictions()` /
  `setRolePermissions()`. `HasNoPermissions="true"` becomes an empty permission list, which is distinct
  from an absent `<RolePermissions>`: the former grants nothing, the latter inherits the namespace default.
- **Export** — `namespace.toNodeset2XML()` emits `AccessRestrictions`, `HasNoPermissions` and a
  `<RolePermissions>` element, placed after `<References>` as `UANodeSet.xsd` requires.
- **Compatibility switch** — `NodeSetLoaderOptions.permissions: "apply" | "ignore"`, defaulting to
  `"apply"`. Set it to `"ignore"` to restore the previous fail-open behaviour if an existing deployment
  would otherwise lock itself out.

**Impact:** the declared policy now takes effect. `Opc.Ua.NodeSet2.xml` alone carries 854 `RolePermission`
entries and 359 `AccessRestrictions`; the restrictions sit on management surfaces — the RoleSet internals,
`ServerConfiguration`, the file transfer methods — which now require a signed, and often signed and
encrypted, channel to reach.

#### The `Anonymous` Role is the baseline every Session stands on

`Opc.Ua.NodeSet2.xml` names five Roles across its `RolePermission` entries — `Anonymous`, `SecurityAdmin`,
`ConfigureAdmin` and the two `SecurityKeyServer` ones — and never `AuthenticatedUser`, `Observer`,
`Operator`, `Engineer` or `Supervisor`. Its 195 `Anonymous` entries are therefore the floor granted to
everyone, not a privilege of unauthenticated Sessions. Read literally they left an authenticated user
unable to browse the `RoleSet` or call `ChangePassword` on itself (OPC 10000-18 §5.2.8), with strictly
less access than an anonymous one.

Permission evaluation now adds the `Anonymous` Role to the Session's own. This can only widen a permission
set, and only to what an unauthenticated Session already has, so it grants nothing an attacker could not
obtain by not authenticating. `getCurrentUserRoles()` is unchanged: the identity a Session reports stays
truthful, only the permission evaluation gains the baseline.

#### Permissions that cannot be resolved for a Session can now fail closed

`SessionContext.getPermissions()` treated "no Role resolved" as "grant everything", which conflated a
context with no Session at all — `SessionContext.defaultContext`, a `PseudoSession`, both in-process
callers that node-opcua relies on being permissive — with a remote Session whose identity resolved to
nothing.

The two are now distinct. A context with no Session is always granted every permission, by design. A
Session that resolved to no Role, or a node whose namespace declares no `RolePermissions` at all, follows
the new `IServerBase.unresolvedPermissionPolicy`, which defaults to `"allow"` — unchanged behaviour — and
can be set to `"deny"` by products that drive access entirely from declared policy.

### Fixed

#### The `UserAccessLevel` attribute of a `UAVariable` is no longer lost by the NodeSet2 serialisation layer ([#1552](https://github.com/node-opcua/node-opcua/issues/1552))

Sibling of [#1550](https://github.com/node-opcua/node-opcua/issues/1550), in the same two files.
`UserAccessLevel` was dropped in both directions: the loader forced `userAccessLevel = accessLevel` with
the parsing commented out, and the exporter had no logic for the attribute at all.

- **Import** — an explicit `<UAVariable UserAccessLevel="1">` is now honoured. When the attribute is
  absent, `userAccessLevel` still falls back on `accessLevel` rather than on the XSD default of `1`:
  a nodeset that raises `AccessLevel` and stays silent on `UserAccessLevel` means "the user may do
  whatever the node allows", and taking the XSD default literally would make most nodesets read-only.
- **Export** — `UserAccessLevel` is emitted only when it restricts `AccessLevel`, and never on a
  `<UAVariableType>` element, which `UANodeSet.xsd` does not allow it on.

**Impact:** consumers that used to observe `userAccessLevel === accessLevel` on every variable loaded from
a NodeSet2 file will now see the restriction the file actually declares.

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
