# Clarion Demo Recording

Terminal demo recorded with [VHS](https://github.com/charmbracelet/vhs), the Charm terminal recorder.

## Prerequisites

1. Install VHS:

   ```sh
   brew install charmbracelet/tap/vhs
   ```

   VHS also requires `ffmpeg` and `ttyd`. The Homebrew formula installs both automatically.

2. Make sure Clarion's CLI tools are on your PATH:

   ```sh
   npm install -g .
   ```

3. Start the Clarion server:

   ```sh
   npm run server:start
   ```

## Recording

```sh
vhs demo/clarion-demo.tape
```

Produces `demo/clarion-demo.gif` (~45 seconds, three scenes):

1. **Setup** — `clarion-init` interactive voice picker
2. **One-shot** — pipe text through `clarion-speak --agent demo-agent`
3. **Live session** — `clarion-watch --agent demo-agent --verbose`

## Customizing

Edit `demo/clarion-demo.tape` to change timing, theme, or resolution. See the [VHS docs](https://github.com/charmbracelet/vhs#vhs) for syntax.
