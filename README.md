# StationBot (Revolt)

The [stationbot](https://github.com/stationarystation/stationbot) port to Revolt.JS that nobody asked for

## Steps

### Cloning the repo

I recommend using `degit` to clone the repo. Although if you want updates,
you can use `git clone`.

```bash
git clone https://github.com/stationarystation/revoltjs-template.git my-cool-bot

# or
npx degit stationarystation/revoltjs-template my-cool-bot
```

### Installing packages

Install packages using your package manager of choise

```bash
 # pnpm
 pnpm i
 
 # yarn
 yarn
 
 # npm
 npm i
```

### Building

Build the code using `tsc`

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build
```

### Running

Use the example `.env` file as a base or provide your bot's token through
environment options.

```env
TOKEN=my_cool_bot_token
```

Then run `pnpm start` or `npm run start` or `yarn start`

### Environment Options

These are options that change the bot's settings.

A database driven options menu for stationbot will come soon. But for now
the bot's settings are managed through a `.env` file or through environment
variables.

Below are the available settings and their usage.


| Option           | Description      | Usage                              |
| ---------------- | ---------------- | ---------------------------------- |
| TOKEN            | Bot's Token      | TOKEN=token                        |
| PREFIX           | Bot's Prefix     | PREFIX=prefix                      |
| DISABLED_PLUGINS | Disabled Plugins | DISABLED_PLUGINS=plugin,plugin,... |
