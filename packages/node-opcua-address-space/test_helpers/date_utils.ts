interface DateWithPicoseconds extends Date {
    picoseconds: number;
}

export function date_add(date: Date, options: { seconds: number }): Date {
    const date1 = new Date(date.getTime() + options.seconds * 1000) as DateWithPicoseconds;
    date1.picoseconds = 0;
    return date1;
}
