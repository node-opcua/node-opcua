import { readFileSync } from "node:fs";
import type { ISessionContext } from "node-opcua-address-space-base";
import { WellKnownRoles } from "node-opcua-constants";
import { AccessLevelFlag, AccessRestrictionsFlag, AttributeIds, NodeClass, PermissionFlag } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, RolePermissionType } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";
import { StoreAddressSpace } from "../dist/impl/store_views/store_address_space.js";
import type { StoreVariableView } from "../dist/impl/store_views/store_variable_view.js";

const anonymous = resolveNodeId(WellKnownRoles.Anonymous);
const securityAdmin = resolveNodeId(WellKnownRoles.SecurityAdmin);
const operator = resolveNodeId(WellKnownRoles.Operator);

/** a session context reduced to what the store checks: the channel's mode and the roles */
function session(securityMode: MessageSecurityMode, roles: NodeId[]): ISessionContext {
    return {
        session: { channel: { securityMode } },
        getCurrentUserRoles: () => roles
    } as unknown as ISessionContext;
}

// a second document: a namespace of its own, with a NamespaceMetadata object under
// Server/Namespaces and two variables declaring their own policy
const extraNodeset = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris><Uri>urn:store:permissions</Uri></NamespaceUris>
  <Models><Model ModelUri="urn:store:permissions" Version="1.0.0" PublicationDate="2026-01-01T00:00:00Z">
    <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.03"/></Model></Models>
  <UAObject NodeId="ns=1;i=1" BrowseName="1:urn:store:permissions" ParentNodeId="i=11715">
    <DisplayName>urn:store:permissions</DisplayName>
    <References>
      <Reference ReferenceType="HasComponent" IsForward="false">i=11715</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=11616</Reference>
    </References>
  </UAObject>
  <UAVariable NodeId="ns=1;i=2" BrowseName="DefaultRolePermissions" DataType="i=96" ValueRank="1" ParentNodeId="ns=1;i=1">
    <DisplayName>DefaultRolePermissions</DisplayName>
    <References>
      <Reference ReferenceType="HasProperty" IsForward="false">ns=1;i=1</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
    </References>
  </UAVariable>
  <UAVariable NodeId="ns=1;i=10" BrowseName="1:Inherits" DataType="Double" AccessLevel="3" ParentNodeId="i=85">
    <DisplayName>Inherits</DisplayName>
    <References>
      <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
    </References>
  </UAVariable>
  <UAVariable NodeId="ns=1;i=11" BrowseName="1:Declares" DataType="Double" AccessLevel="3" AccessRestrictions="2" ParentNodeId="i=85">
    <DisplayName>Declares</DisplayName>
    <References>
      <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
    </References>
    <RolePermissions>
      <RolePermission Permissions="1">i=15644</RolePermission>
      <RolePermission Permissions="33">i=15704</RolePermission>
    </RolePermissions>
  </UAVariable>
  <UAVariable NodeId="ns=1;i=12" BrowseName="1:Nobody" DataType="Double" AccessLevel="3" HasNoPermissions="true" ParentNodeId="i=85">
    <DisplayName>Nobody</DisplayName>
    <References>
      <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
    </References>
  </UAVariable>
  <UAVariable NodeId="ns=1;i=13" BrowseName="1:WriteOnly" DataType="Double" AccessLevel="2" ParentNodeId="i=85">
    <DisplayName>WriteOnly</DisplayName>
    <References>
      <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
    </References>
  </UAVariable>
</UANodeSet>`;

describe("store permissions: access restrictions and role permissions on the store read path", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let inherits: StoreVariableView;
    let declares: StoreVariableView;
    let nobody: StoreVariableView;

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192, accessRestrictions: "apply" });
        const consumer = space.recordConsumer();
        for (const document of [readFileSync(nodesets.standard, "utf8"), extraNodeset]) {
            for await (const record of xmlNodesetRecords([document])) {
                consumer.apply(record);
            }
        }
        should(space.finishLoad().unresolved).eql(0);
        const variable = (id: string) => {
            const view = space.findNode(id) as StoreVariableView;
            should(view).not.eql(null);
            view.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));
            return view;
        };
        inherits = variable("ns=1;i=10");
        declares = variable("ns=1;i=11");
        nobody = variable("ns=1;i=12");
    });

    it("keeps what the document declares", () => {
        const nodes = space.store.nodes;
        should(nodes.accessRestrictions(inherits.index)).eql(undefined);
        should(nodes.rolePermissions(inherits.index)).eql(null);
        should(nodes.accessRestrictions(declares.index)).eql(AccessRestrictionsFlag.EncryptionRequired);
        const entries = nodes.rolePermissions(declares.index) ?? [];
        should(entries.map((e) => `${e.roleId.toString()}:${e.permissions}`)).eql(["ns=0;i=15644:1", "ns=0;i=15704:33"]);
        should(nodes.rolePermissions(nobody.index)).eql([], "HasNoPermissions is an empty list, not an absent one");
    });

    it("grants an in-process caller everything", () => {
        should(declares.readValue().statusCode).eql(StatusCodes.Good);
        should(declares.readValue(null).statusCode).eql(StatusCodes.Good);
        should(nobody.readValue().statusCode).eql(StatusCodes.Good);
        should(space.permissions.permissions(null, declares.index)).eql(0x1ffff);
    });

    it("denies a value its access restrictions reserve to an encrypted channel", () => {
        const plain = declares.readValue(session(MessageSecurityMode.None, [securityAdmin]));
        should(plain.statusCode).eql(StatusCodes.BadSecurityModeInsufficient);
        should(plain.value.dataType).eql(DataType.Null, "the value stays undisclosed");
        should(plain.sourceTimestamp).be.instanceOf(Date, "the denial carries the time of the denial");
        should(declares.readValue(session(MessageSecurityMode.Sign, [securityAdmin])).statusCode).eql(
            StatusCodes.BadSecurityModeInsufficient
        );
        should(declares.readValue(session(MessageSecurityMode.SignAndEncrypt, [securityAdmin])).statusCode).eql(StatusCodes.Good);
    });

    it("matches the session's roles against the node's role permissions", () => {
        const encrypted = (roles: NodeId[]) => declares.readValue(session(MessageSecurityMode.SignAndEncrypt, roles)).statusCode;
        should(encrypted([securityAdmin])).eql(StatusCodes.Good, "SecurityAdmin has Browse and Read");
        should(encrypted([operator])).eql(
            StatusCodes.BadUserAccessDenied,
            "Operator falls back on the Anonymous floor: Browse only"
        );
        should(encrypted([anonymous])).eql(StatusCodes.BadUserAccessDenied);
        should(encrypted([operator, securityAdmin])).eql(StatusCodes.Good, "the roles' permissions add up");
        should(declares.readAttribute(session(MessageSecurityMode.SignAndEncrypt, [operator]), AttributeIds.Value).statusCode).eql(
            StatusCodes.BadUserAccessDenied,
            "readAttribute(Value) goes through the same gates"
        );
        should(declares.readAttribute(session(MessageSecurityMode.None, [operator]), AttributeIds.DisplayName).statusCode).eql(
            StatusCodes.Good,
            "the other attributes are not gated here, as in the node objects"
        );
    });

    it("grants nothing on a node with HasNoPermissions", () => {
        should(nobody.readValue(session(MessageSecurityMode.None, [securityAdmin])).statusCode).eql(
            StatusCodes.BadUserAccessDenied
        );
    });

    it("applies the unresolved permission policy to a session without roles", () => {
        should(declares.readValue(session(MessageSecurityMode.SignAndEncrypt, [])).statusCode).eql(StatusCodes.Good);
        space.permissions.unresolvedPermissionPolicy = "deny";
        should(declares.readValue(session(MessageSecurityMode.SignAndEncrypt, [])).statusCode).eql(StatusCodes.BadUserAccessDenied);
        should(inherits.readValue(session(MessageSecurityMode.None, [operator])).statusCode).eql(
            StatusCodes.BadUserAccessDenied,
            "no policy on the node nor on its namespace: the unresolved policy decides, whatever the roles"
        );
        space.permissions.unresolvedPermissionPolicy = "allow";
        should(inherits.readValue(session(MessageSecurityMode.None, [operator])).statusCode).eql(StatusCodes.Good);
    });

    it("falls back on the namespace defaults the application sets", () => {
        const ns = space.namespaceIndexOf("urn:store:permissions");
        should(ns).eql(1);
        space.permissions.setNamespaceDefaults(ns, {
            accessRestrictions: AccessRestrictionsFlag.SigningRequired,
            rolePermissions: [{ roleId: operator, permissions: PermissionFlag.Browse | PermissionFlag.Read }]
        });
        should(inherits.readValue(session(MessageSecurityMode.None, [operator])).statusCode).eql(
            StatusCodes.BadSecurityModeInsufficient
        );
        should(inherits.readValue(session(MessageSecurityMode.Sign, [operator])).statusCode).eql(StatusCodes.Good);
        should(inherits.readValue(session(MessageSecurityMode.Sign, [securityAdmin])).statusCode).eql(
            StatusCodes.BadUserAccessDenied
        );
        // the node's own policy still wins over the namespace's
        should(declares.readValue(session(MessageSecurityMode.SignAndEncrypt, [operator])).statusCode).eql(
            StatusCodes.BadUserAccessDenied
        );
        space.permissions.setNamespaceDefaults(ns, null);
        should(inherits.readValue(session(MessageSecurityMode.None, [securityAdmin])).statusCode).eql(StatusCodes.Good);
    });

    it("reads the namespace defaults from the NamespaceMetadata object when there is one", () => {
        const defaults = space.findNode("ns=1;i=2") as StoreVariableView;
        should(defaults).not.eql(null);
        should(space.permissions.namespaceDefaults(1).rolePermissions).eql(null, "no value yet");
        defaults.setValueFromSource(
            new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [new RolePermissionType({ roleId: securityAdmin, permissions: PermissionFlag.Browse | PermissionFlag.Read })]
            })
        );
        space.permissions.invalidate();
        should(space.permissions.namespaceDefaults(1).rolePermissions?.length).eql(1);
        should(inherits.readValue(session(MessageSecurityMode.None, [securityAdmin])).statusCode).eql(StatusCodes.Good);
        should(inherits.readValue(session(MessageSecurityMode.None, [operator])).statusCode).eql(StatusCodes.BadUserAccessDenied);
        // a new value is seen without an invalidation: the value version moved
        defaults.setValueFromSource(
            new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [new RolePermissionType({ roleId: operator, permissions: PermissionFlag.Browse | PermissionFlag.Read })]
            })
        );
        should(inherits.readValue(session(MessageSecurityMode.None, [operator])).statusCode).eql(StatusCodes.Good);
        should(space.permissions.namespaceDefaults(0).rolePermissions).eql(null, "the UA namespace declares no metadata object");
        // the metadata value wins over what the application set; the application's setting is the fallback
        space.permissions.setNamespaceDefaults(1, {
            accessRestrictions: AccessRestrictionsFlag.SigningRequired,
            rolePermissions: [{ roleId: securityAdmin, permissions: PermissionFlag.Browse | PermissionFlag.Read }]
        });
        should(inherits.readValue(session(MessageSecurityMode.Sign, [operator])).statusCode).eql(
            StatusCodes.Good,
            "operator from the metadata"
        );
        should(inherits.readValue(session(MessageSecurityMode.Sign, [securityAdmin])).statusCode).eql(
            StatusCodes.BadUserAccessDenied
        );
        should(inherits.readValue(session(MessageSecurityMode.None, [operator])).statusCode).eql(
            StatusCodes.BadSecurityModeInsufficient,
            "DefaultAccessRestrictions has no value: the application's setting applies"
        );
        space.permissions.setNamespaceDefaults(1, null);
    });

    it("denies a value its access level does not expose, whoever asks", () => {
        const writeOnly = space.findNode("ns=1;i=13") as StoreVariableView;
        should(writeOnly.accessLevel & AccessLevelFlag.CurrentRead).eql(0);
        writeOnly.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));
        should(writeOnly.readValue().statusCode).eql(StatusCodes.BadNotReadable);
        should(writeOnly.readValue(session(MessageSecurityMode.SignAndEncrypt, [securityAdmin])).statusCode).eql(
            StatusCodes.BadNotReadable
        );
        should(space.store.nodes.nodeClass(writeOnly.index)).eql(NodeClass.Variable);
    });
});
