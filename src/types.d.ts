interface Command {
    name: string,
    description: string,
    execute: callback<T> | Error,
    use?: string,
    cooldown?: number,
    arguments?: boolean,
}