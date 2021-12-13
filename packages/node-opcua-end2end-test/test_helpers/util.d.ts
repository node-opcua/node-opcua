declare function wait_until_condition(condition: () => boolean, timeout: number, message: string): Promise<void>;
declare function wait(duration: number): Promise<void>;
