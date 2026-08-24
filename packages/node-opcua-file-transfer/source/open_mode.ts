/**
 * @module node-opcua-file-transfer-server
 */
export enum OpenFileModeMask {
    ReadBit = 0x01,
    WriteBit = 0x02,
    EraseExistingBit = 0x04,
    AppendBit = 0x08
}

export enum OpenFileMode {
    /**
     *       Read         bit 0   The file is opened for reading. If this bit is not
     *                            set the Read Method cannot be executed.
     */
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits; must stay a real numeric enum for the OpenFileMode[mode] reverse lookup used in error messages
    Read = OpenFileModeMask.ReadBit,
    /**
     *      Write         bit 1   The file is opened for writing. If this bit is not
     *                            set the Write Method cannot be executed.
     *
     */
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits, see above
    Write = OpenFileModeMask.WriteBit,
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits, see above
    ReadWrite = OpenFileModeMask.ReadBit + OpenFileModeMask.WriteBit,

    /**
     *
     *  WriteEraseExisting
     *      EraseExisting 2   This bit can only be set if the file is opened for writing
     *                        (Write bit is set). The existing content of the file is
     *                        erased and an empty file is provided.
     */
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits, see above
    WriteEraseExisting = OpenFileModeMask.EraseExistingBit + OpenFileModeMask.WriteBit,
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits, see above
    ReadWriteEraseExisting = OpenFileModeMask.EraseExistingBit + OpenFileModeMask.WriteBit + OpenFileModeMask.ReadBit,
    /**
     *      Append        3   When the Append bit is set the file is opened at end
     *                        of the file, otherwise at begin of the file.
     *                        The SetPosition Method can be used to change the position.
     */
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits, see above
    WriteAppend = OpenFileModeMask.AppendBit + OpenFileModeMask.WriteBit,
    // biome-ignore lint/style/useLiteralEnumMembers: composed from OpenFileModeMask bits, see above
    ReadWriteAppend = OpenFileModeMask.AppendBit + OpenFileModeMask.WriteBit + OpenFileModeMask.ReadBit
}
