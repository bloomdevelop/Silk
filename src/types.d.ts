interface Command {
    name: string,
    description: string,
    execute: callback,
    use?: string,
    cooldown?: number,
    arguments?: boolean,
}