import chalk from "chalk";

export class BoxFormatter {
    private static readonly BOX_CHARS = {
        topLeft: "╔",
        topRight: "╗",
        bottomLeft: "╚",
        bottomRight: "╝",
        horizontal: "═",
        vertical: "║",
        leftT: "╠",
        rightT: "╣"
    };

    /**
     * Format data into a nice box
     * @param title The title of the box
     * @param data Object containing key-value pairs to display
     * @param width Minimum width of the box (default: 40)
     */
    static format(title: string, data: Record<string, string>, width: number = 40): string {
        const lines: string[] = [];
        const padding = 2;
        
        // Separate total time from other data
        const { "Total Time": totalTime, ...mainData } = data;
        
        // Calculate the maximum width needed
        const maxKeyLength = Math.max(
            ...Object.keys({ ...mainData, "Total Time": "" }).map(k => k.length)
        );
        const maxValueLength = Math.max(
            ...Object.values({ ...mainData, "Total Time": totalTime }).map(v => v.length)
        );
        const contentWidth = Math.max(
            title.length,
            maxKeyLength + maxValueLength + padding * 2,
            width
        );

        // Create the box
        const horizontalLine = this.BOX_CHARS.horizontal.repeat(contentWidth + 2);
        
        // Add title
        lines.push(chalk.cyan([
            this.BOX_CHARS.topLeft,
            horizontalLine,
            this.BOX_CHARS.topRight
        ].join("")));

        const centeredTitle = this.centerText(title, contentWidth);
        lines.push(chalk.cyan(`${this.BOX_CHARS.vertical} `) + 
                  chalk.yellow(centeredTitle) + 
                  chalk.cyan(` ${this.BOX_CHARS.vertical}`));

        // Add separator
        lines.push(chalk.cyan([
            this.BOX_CHARS.leftT,
            horizontalLine,
            this.BOX_CHARS.rightT
        ].join("")));

        // Add main data
        Object.entries(mainData).forEach(([key, value]) => {
            const line = this.formatDataLine(key, value, contentWidth);
            lines.push(chalk.cyan(`${this.BOX_CHARS.vertical} `) + 
                      line + 
                      chalk.cyan(` ${this.BOX_CHARS.vertical}`));
        });

        // Add separator and total time if it exists
        if (totalTime) {
            lines.push(chalk.cyan([
                this.BOX_CHARS.leftT,
                horizontalLine,
                this.BOX_CHARS.rightT
            ].join("")));

            const totalLine = this.formatDataLine("Total Time", totalTime, contentWidth);
            lines.push(chalk.cyan(`${this.BOX_CHARS.vertical} `) + 
                      chalk.bold(totalLine) + 
                      chalk.cyan(` ${this.BOX_CHARS.vertical}`));
        }

        // Add bottom
        lines.push(chalk.cyan([
            this.BOX_CHARS.bottomLeft,
            horizontalLine,
            this.BOX_CHARS.bottomRight
        ].join("")));

        return lines.join("\n");
    }

    private static centerText(text: string, width: number): string {
        const padding = width - text.length;
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return " ".repeat(leftPad) + text + " ".repeat(rightPad);
    }

    private static formatDataLine(key: string, value: string, width: number): string {
        const keyWidth = Math.floor(width * 0.6);  // 60% for key
        const valueWidth = width - keyWidth;       // Remaining for value
        
        const paddedKey = (key + ":").padEnd(keyWidth);
        const paddedValue = value.padStart(valueWidth);
        
        return chalk.white(paddedKey) + chalk.green(paddedValue);
    }
} 