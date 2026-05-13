import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UADictionaryEntry, UADictionaryEntry_Base } from "./ua_dictionary_entry";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SyntaxReferenceEntryType i=32439                            |
 * |isAbstract      |false                                                       |
 */
export interface UASyntaxReferenceEntry_Base extends UADictionaryEntry_Base {
    commonName: UAProperty<UAString, DataType.String>;
}
export interface UASyntaxReferenceEntry extends UADictionaryEntry, UASyntaxReferenceEntry_Base {}