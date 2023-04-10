import chroma from "chroma-js";

// Code stolen from Lea's Selfbot :trol:
const gradient = (start: string, end: string, lenght: number) => {
    const colours: string[] = [];

    for (let i = 1; i <= lenght; i++) {
        colours.push(chroma.mix(start, end, i / lenght).hex("rgb"));
    }

    return colours;
};

const defaultEscapes = new Map([
    ["{", "\\{"],
    ["}", "\\}"],
    ["\\", "\\textbackslash"],
    ["#", "\\#"],
    ["$", "\\textdollar"],
    ["%", "\\%"],
    ["&", "\\&"],
    ["^", "\\textasciicircum"],
    ["_", "\\_"],
    ["~", "\\textasciitilde"],
]);

const lescape = (c: string) => defaultEscapes.get(c) ?? c;

const trans = async (s: string) => {
    const colors = ["3ae", "e7b", "fff"];
    const segments = Math.floor(s.length / 4);
    const g = [
        chroma(colors[0]).hex("rgb"),
        ...gradient(colors[0], colors[1], segments),
        ...gradient(colors[1], colors[2], segments),
        ...gradient(colors[2], colors[1], segments),
        ...gradient(
            colors[1],
            colors[0],
            s.length - segments * 3 - 1
        ),
    ];

    return s
        .split("\n")
        .map(
            (s) =>
                `\$\\textsf{${Array.from(s)
                    .map(lescape)
                    .map((c, i) => `\\color{${g[i]}}${c}`)
                    .join("")}}\$`
        )
        .join("\n");
};

// ok this is mine :3
const clamp = (options: {
    num: number;
    min: number;
    max: number;
}): number =>
    Math.min(Math.max(options.num, options.min), options.max);

export { gradient, trans, lescape, clamp };
