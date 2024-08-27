import { ICommand } from "@/types";
import { PuppeteerController } from "../../lib/browser";
import { AutumnService } from "../../lib/autumn";
import { commandLog } from "../../utils";

const browserManager = new PuppeteerController();

const browser: ICommand = {
    name: "browser",
    description: "Navigates through the web... \nInside revolt.chat!\n> Also it was ported from [browserbot by Amy](https://github.com/amycatgirl/revolt-browserbot)",
    usage: "browser <create|navigate|goto|listtab|click|write|screenshot>\n",
    wip: true,
    aliases: ["chromium", "firefox", "chrome", "edge", "www"],
    async execute(msg, args) {
        if (!args)
            return msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: "Please specify a command.",
                        colour: "#00FF00",
                    },
                ],
            });

        if (args[0] === "create") {
          await browserManager.createInstance(
                msg.server?.id as string,
            );
            return msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: `Created a new instance!`,
                        colour: "#00FF00",
                    },
                ],
            });
        }

        if (args[0] === "newtab") {
            const instance = browserManager.getInstance(
                msg.server?.id as string,
            );
            const tab = await instance?.newTab(msg.authorId);
            await tab?.navigateTo("https://google.com");
            const screenshot = await tab?.takeScreenshot();
            const fileID = await AutumnService.uploadFile(
                "attachments",
                screenshot as Blob,
            );

            return await msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: `Created a new instance!`,
                        colour: "#00FF00",
                    },
                ],
                attachments: [fileID],
            });
        }

        if (args[0] === "goto") {
            if (!args[1])
                return msg.reply({
                    embeds: [
                        {
                            title: "Browser",
                            description: "Please specify a url.",
                            colour: "#00FF00",
                        },
                    ],
                });

            const instace = browserManager.getInstance(
                msg.server?.id as string,
            );
            const tab = instace?.getTab(msg.authorId);
            await tab?.navigateTo(args[1]);

            const screenshot = await tab?.takeScreenshot();
            const fileID = await AutumnService.uploadFile(
                "attachments",
                screenshot as Blob,
            );

            return await msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: `Navigated to ${args[1]}`,
                        colour: "#00FF00",
                    },
                ],
                attachments: [fileID],
            });
        }

        if (args[0] === "screenshot") {
          const instance = browserManager.getInstance(
            msg.server?.id as string,   
            );
            const tab = instance?.getTab(msg.authorId);
            const screenshot = await tab?.takeScreenshot();
            const fileID = await AutumnService.uploadFile(
                "attachments",
                screenshot as Blob,
            );

            msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: `Screenshot taken!`,
                        colour: "#00FF00",
                    },
                ],
                attachments: [fileID],
            }); 
        }

        if (args[0] === "listtab") {
            const instance = browserManager.getInstance(
                msg.server?.id as string,
            );

            const tabs = instance?.tabs;

            let tabListTemplate = "|Tab Owner|Title|\n|---|---|\n";
            
            for (const tab of tabs?? []) {
              const title = await tab._page.evaluate(() => document.title);
              commandLog.debug(`Tab: ${tab.owner} ${title}`);
              tabListTemplate += `|${tab.owner}|${title}|\n`;
            }

            msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: tabs ? `# Tab List\n${tabListTemplate}` : "No tabs found!",
                        colour: tabs ? "#00FF00" : "#FF0000",
                    },
                ],
            });
        };
        if (args[0] === "click") {
            if (!args[1])
                return msg.reply({
                    embeds: [
                        {
                            title: "Browser",
                            description: "Please specify a selector.",
                            colour: "#FF0000",
                        },
                    ],
                });

            const instance = browserManager.getInstance(msg.server?.id as string);
            const tab = instance?.getTab(msg.authorId as string);

            if (!tab) return msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: "No tab found!",
                        colour: "#FF0000",
                    },
                ],
            });
            commandLog.debug(`Try clicking on ${args[1]}`);
            const element = await tab?._page.$(args[1] as string);

            if (!element) return msg.reply({
                embeds: [
                    {
                        title: "Browser",
                        description: "Element not found!",
                        colour: "#00FF00",
                    },
                ],
            });

            try {
                await Promise.all([
                    tab._page.waitForSelector('html'),
                    element.click()
                ]).catch((err) => {throw new Error(err)})
                const screenshot = await tab?.takeScreenshot();
                const fileID = await AutumnService.uploadFile(
                    "attachments",
                    screenshot as Blob,
                );

                msg.reply({
                    embeds: [
                        {
                            title: "Browser",
                            description: `Clicked on ${args[1]}`,
                            colour: "#00FF00",
                        },
                    ],
                    attachments: [fileID],
                });
            } catch(err) {
                msg.reply({
                    embeds: [
                        {
                            title: "Browser",
                            description: `# Something went wrong!\n\`\`\`ts\n${err}\n\`\`\``,
                            colour: "#FF0000",
                        },
                    ],
                });
            }
        }
    },
};

module.exports = browser;
