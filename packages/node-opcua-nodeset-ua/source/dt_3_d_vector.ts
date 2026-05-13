import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTVector } from "./dt_vector";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |3DVector                                                    |
 * | isAbstract|false                                                       |
 */
export interface DT3DVector extends DTVector {
  x: number; // Double ns=0;i=11
  y: number; // Double ns=0;i=11
  z: number; // Double ns=0;i=11
}
export interface UDT3DVector extends ExtensionObject, DT3DVector {};