> [!WARNING]
> This repository has been **deprecated**, as I have moved it to git.gay. To contribute, please visit [repository from git.gay](https://git.gay/bloomdevelop/Silk).

# Silk

> Derived from stationbot which is no longer exist

The multi-purpose revolt.js bot created using typescript.

## Steps

### Cloning the repo

I recommend using `degit` to clone the repo. Although if you want updates,
you can use `git clone`.

```bash
# git
git clone https://github.com/bloomdevelop/Silk.git

# npx
npx degit bloomdevelop/Silk

# pnpm
pnpm dlx degit bloomdevelop/Silk

# bun
bun x degit bloomdevelop/Silk
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

# bun
bun i
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

# bun
bun build
```

### Running

Use the example `.env` file as a base or provide your bot's token through
environment options by running this command
```bash
cp .env.example .env
```

> To get the bot's token, go to app.revolt.chat and log on your account, then go to Settings > Your Bots.
> Create a new bot and copy paste your copied bot token into .env file

```env
TOKEN=my_cool_bot_token
```

Then run `pnpm start` or `npm run start` or `yarn start` or `bun start`

> ### For development
> Please run in the following command:
> ```bash
> # npm
> npm run dev
> # pnpm
> pnpm dev
> # yarn
> yarn dev
> # bun
> bun dev
> ```

### Environment Options

These are options that change the bot's settings.

The bot's settings are managed through a `.env` file or through environment
variables.

Below are the available settings and their usage.


| Option           | Description                                      | Usage                              |
|------------------|--------------------------------------------------|------------------------------------|
| TOKEN            | Bot's Token                                      | TOKEN=token                        |
| PREFIX           | Bot's Prefix                                     | PREFIX=prefix                      |
| DISABLED_PLUGINS | Disabled Plugins                                 | DISABLED_PLUGINS=plugin,plugin,... |
| GEMINI_API_KEY   | Gemini API Key (Required for generate changelog) | GEMINI_API_KEY=api_key             |
| WEATHERAPI_KEY   | WeatherAPI Key (Required for weather command)    | WEATHERAPI_KEY=api_key             |
