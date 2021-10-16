import { LineFile1 } from "./line_file";

export interface WriteFunc {
    (...args: string[]): void;
    indent(): void;
    pop(): void;
}

export const makeWrite = (f: LineFile1): WriteFunc => {
    const _f: WriteFunc = (...args: string[]) => f.write(...args);
    _f.indent = () => {
        /** */
    };
    _f.pop = () => {
        /** */
    };
    return _f;
};
