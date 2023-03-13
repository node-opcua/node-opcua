import { Stats, PathLike, OpenMode, NoParamCallback, WriteFileOptions , ReadStream } from "fs";

export interface ReadStreamOptions {

}
export interface AbstractFs {
    stat(path: PathLike, callback: (err: NodeJS.ErrnoException | null, stats: Stats) => void): void;

    open(path: PathLike, flags: OpenMode, callback: (err: NodeJS.ErrnoException | null, fd: number) => void): void;

    write<TBuffer extends NodeJS.ArrayBufferView>(
        fd: number,
        buffer: TBuffer,
        offset: number | undefined | null,
        length: number | undefined | null,
        position: number | undefined | null,
        callback: (err: NodeJS.ErrnoException | null, bytesWritten: number, buffer: TBuffer) => void
    ): void;

    read<TBuffer extends NodeJS.ArrayBufferView>(
        fd: number,
        buffer: TBuffer,
        offset: number,
        length: number,
        position: number | null,
        callback: (err: NodeJS.ErrnoException | null, bytesRead: number, buffer: TBuffer) => void
    ): void;

    close(fd: number, callback: NoParamCallback): void;

    writeFile(
        path: PathLike | number,
        data: string | NodeJS.ArrayBufferView,
        options: WriteFileOptions,
        callback: NoParamCallback
    ): void;

    readFile(
        path: PathLike | number,
        options: { encoding: BufferEncoding; flag?: string } | string,
        callback: (err: NodeJS.ErrnoException | null, data: string) => void
    ): void;
    // readFile(path: PathLike | number, options: { encoding?: null; flag?: string; } | undefined | null, callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void): void;

    existsSync(filename: string): boolean;

 }
