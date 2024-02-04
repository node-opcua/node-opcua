// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UADictionaryEntry, UADictionaryEntry_Base } from "./ua_dictionary_entry"
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
export interface UASyntaxReferenceEntry extends UADictionaryEntry, UASyntaxReferenceEntry_Base {
}