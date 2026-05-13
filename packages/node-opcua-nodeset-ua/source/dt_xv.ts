import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |XVType                                                      |
 * | isAbstract|false                                                       |
 */
export interface DTXV extends DTStructure {
  x: number; // Double ns=0;i=11
  value: number; // Float ns=0;i=10
}
export interface UDTXV extends ExtensionObject, DTXV {};