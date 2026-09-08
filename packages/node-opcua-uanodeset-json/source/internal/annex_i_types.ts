/**
 * The shapes OPC 10000-6 Annex I defines, as TypeScript.
 *
 * Annex I.1 says which document is in charge:
 *
 * > The JSON Schema released with this version of the standard can be found at
 * > `https://opcfoundation.org/schemas/json-nodeset/1.0.0/json-nodeset-schema.json`.
 * > The schema document is the formal definition. The description in this Annex discusses
 * > semantic details that cannot be captured in the schema document.
 *
 * So these types follow the schema for structure and the annex prose for meaning, and they are
 * deliberately permissive: every field optional, nothing narrowed beyond what the schema states.
 * A reader that refuses a document over a field it did not expect is worse than useless against a
 * schema whose own README says it will change.
 *
 * Field names are the annex's, capitalised, rather than being renamed to house style. Anything
 * else would make the codec unreadable next to the specification it implements.
 */

/** 1 Object, 2 Variable, 4 Method, 8 ObjectType, 16 VariableType, 32 ReferenceType, 64 DataType, 128 View */
export type AnnexINodeClass = 0 | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;

/**
 * a LocalizedText in the multi-language form Annex I.1 points at (OPC 10000-3).
 *
 * `t` holds `[locale, text]` pairs. `r` is a second such array whose meaning the annex leaves to
 * Part 3; this reader carries it through untouched rather than interpreting it.
 */
export interface AnnexILocalizedText {
    t?: string[][];
    r?: string[][];
}

export interface AnnexIRolePermission {
    RoleId?: string;
    Permissions?: number;
}

export interface AnnexIReference {
    ReferenceTypeId?: string;
    /** absent means forward: the annex writes the flag only to say "inverse" */
    IsForward?: boolean;
    TargetId?: string;
}

export interface AnnexIDataTypeField {
    Name?: string;
    SymbolicName?: string;
    DisplayName?: AnnexILocalizedText;
    Description?: AnnexILocalizedText;
    Value?: number;
    DataType?: string;
    ValueRank?: number;
    ArrayDimensions?: string;
    MaxStringLength?: number;
    IsOptional?: boolean;
    AllowSubTypes?: boolean;
}

export interface AnnexIDataTypeDefinition {
    SymbolicName?: string;
    IsUnion?: boolean;
    IsOptionSet?: boolean;
    Fields?: AnnexIDataTypeField[];
}

/** the three lists a Node may nest its children in; JSONL flattens them away */
export interface AnnexIChildList {
    Objects?: AnnexINode[];
    Variables?: AnnexINode[];
    Methods?: AnnexINode[];
}

/**
 * one Node. Annex I Table I.6 defines the common fields; the per-NodeClass fields follow in
 * I.12 to I.19 and are folded in here, because `NodeClass` is what tells them apart and a
 * reader dispatching on it wants one type, not eight.
 */
export interface AnnexINode {
    NodeId?: string;
    NodeClass?: AnnexINodeClass;
    BrowseName?: string;
    SymbolicName?: string;
    /**
     * the owner of the Node. Annex I.4 requires it on every Node that was nested in a ChildList,
     * because flattening is what took the nesting away.
     */
    ParentId?: string;
    /**
     * the TypeDefinition, for Objects and Variables. Stated here instead of as a reference: the
     * annex says "HasTypeDefinition References are not emitted for Objects and Variables".
     */
    TypeId?: string;
    /** likewise, and "HasModellingRule References are not emitted" */
    ModellingRuleId?: string;
    DisplayName?: AnnexILocalizedText;
    Description?: AnnexILocalizedText;
    ReleaseStatus?: "Released" | "Draft" | "Deprecated";
    Documentation?: string;
    IsAbstract?: boolean;
    WriteMask?: number;
    UserWriteMask?: number;
    RolePermissions?: AnnexIRolePermission[];
    AccessRestrictions?: number;
    HasNoPermissions?: boolean;
    DesignToolOnly?: boolean;
    ConformanceUnits?: string[];
    Children?: AnnexIChildList;
    References?: AnnexIReference[];

    // Objects and Views
    EventNotifier?: number;
    ContainsNoLoops?: boolean;

    // Variables and VariableTypes
    DataType?: string;
    ValueRank?: number;
    /** a space-separated list, as the XML attribute is, not a JSON array */
    ArrayDimensions?: string;
    Value?: AnnexIVariant;
    AccessLevel?: number;
    UserAccessLevel?: number;
    MinimumSamplingInterval?: number;
    Historizing?: boolean;

    // Methods
    MethodDeclarationId?: string;
    Executable?: boolean;
    UserExecutable?: boolean;

    // ReferenceTypes
    Symmetric?: boolean;
    InverseName?: AnnexILocalizedText;

    // DataTypes
    Purpose?: "Normal" | "ServicesOnly" | "CodeGenerator";
    Definition?: AnnexIDataTypeDefinition;
}

/** a Variant: the built-in type as a number, the value in the Part 6 JSON encoding */
export interface AnnexIVariant {
    UaType?: number;
    Value?: unknown;
    Dimensions?: number[];
}

export interface AnnexIModelReference {
    ModelUri?: string;
    ModelVersion?: string;
    PublicationDate?: string;
    Version?: string;
    XmlSchemaUri?: string;
}

export interface AnnexIModelDefinition extends AnnexIModelReference {
    IsPartial?: boolean;
    DefaultAccessRestrictions?: number;
    DefaultRolePermissions?: AnnexIRolePermission[];
    RequiredModels?: AnnexIModelReference[];
}

/** the licence, which XML keeps in comments and JSON has nowhere else to put */
export interface AnnexISpdxDeclaration {
    CopyrightText?: string;
    LicenceId?: string;
    LicenceRef?: string;
}

/** the eight typed arrays of I.7, in the order the annex defines them */
export interface AnnexINodeContainer {
    ReferenceTypes?: AnnexINode[];
    DataTypes?: AnnexINode[];
    VariableTypes?: AnnexINode[];
    ObjectTypes?: AnnexINode[];
    Variables?: AnnexINode[];
    Methods?: AnnexINode[];
    Objects?: AnnexINode[];
    Views?: AnnexINode[];
}

/**
 * the root object, and in JSONL the first line with `Nodes` left out.
 *
 * `Ordered` is an assertion, not a description: a reader that resolves ids as it goes rather than
 * indexing the whole document first is entitled to rely on it, so a document that happens to be
 * in order without saying so must not be treated as ordered.
 */
export interface AnnexIUANodeSet {
    SPDX?: AnnexISpdxDeclaration;
    Ordered?: boolean;
    HasManifest?: boolean;
    Models?: AnnexIModelDefinition[];
    ChangeSet?: boolean;
    Operation?: 0 | 1 | 2;
    /** bare stubs for the Nodes a recursive relationship would otherwise refer to too early */
    Declarations?: AnnexINode[];
    Nodes?: AnnexINodeContainer;
}

/** the order I.4 requires the eight containers to be written in */
export const ANNEX_I_CONTAINER_ORDER: Array<keyof AnnexINodeContainer> = [
    "ReferenceTypes",
    "DataTypes",
    "VariableTypes",
    "ObjectTypes",
    "Variables",
    "Methods",
    "Objects",
    "Views"
];

/** the order I.4 requires a ChildList to be written in */
export const ANNEX_I_CHILD_ORDER: Array<keyof AnnexIChildList> = ["Objects", "Variables", "Methods"];
