import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * ResultFile provides a description of a file that
 * is part of a result of a program managers run.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultFileType i=1001                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAResultFile_Base {
    /**
     * mimeType
     * MimeType is the MIME type of the file.
     */
    mimeType: UAProperty<UAString, DataType.String>;
    /**
     * name
     * Name is the name that describes the file. The
     * name may be different from the filename on the
     * filesystem.
     */
    name: UAProperty<UAString, DataType.String>;
    /**
     * URL
     * URL is an URL from which the file can be
     * downloaded.
     */
    URL?: UAProperty<UAString, DataType.String>;
    /**
     * file
     * File is the OPC UA node of the file with the
     * method for downloading the file.
     */
    file?: UAFile;
}
export interface UAResultFile extends UAObject, UAResultFile_Base {}