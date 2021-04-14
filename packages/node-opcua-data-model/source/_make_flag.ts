export function _make_flag(str: string | number | null, noneValue: number, T: any): number {
    if (typeof str === "number") {
        const value = str as number;
        if (value === 0) {
            return noneValue;
        }
        return value;
    }

    let accessFlag: number = 0;

    if (str === "" || str === null) {
        accessFlag = noneValue;
    } else {
        const flags = str.split(" | ");
        accessFlag = 0;
        for (const flag of flags) {
            accessFlag |= (T as any)[flag];
        }
    }
    return accessFlag;
}

