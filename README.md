# revoltjs-template
Simple Revolt.JS Template
## Steps

### Cloning the repo

I recommend using `degit` to clone the repo, but a regular `git clone` can do it.

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

Use the example `.env` file as a base

```env
TOKEN=my_cool_bot_token
```

Then run `pnpm start` or `npm run start` or `yarn start`
