# RePicoBrew

A PicoBrew server as an alternative to [chiefwigms/picobrew_pico](https://github.com/chiefwigms/picobrew_pico) written in TypeScript with an improved UX using Remix + Chakra UI.

**Completed Phases:**

- **Phase 1:** Pico C brew sessions with live progress tracking ✅
- **Phase 2:** Tilt Fermentation Monitoring with BLE support ✅

- [Project Plan](PLAN.md)
- [Remix Docs](https://remix.run/docs)
- [Raspberry Pi Deployment Guide](DEPLOY_PI.md)

## Features

### Phase 1: Brewing

- **Device Management:** Register and manage Pico C devices
- **Recipe CRUD:** Create, edit, and manage brew recipes with Pico-specific constraints
- **Live Brew Tracking:** Real-time brew progress with animated visualization
- **Session History:** Review past brews with temperature graphs and step timelines
- **Raspberry Pi AP Mode:** Run as a WiFi access point that spoofs `picobrew.com`

### Phase 2: Fermentation

- **Tilt Hydrometer Support:** All 8 Tilt colors (Red, Green, Black, Purple, Orange, Blue, Yellow, Pink)
- **BLE Scanning:** Built-in Bluetooth Low Energy scanning on Raspberry Pi
- **Live Fermentation Tracking:** Real-time gravity and temperature monitoring
- **Fermentation Sessions:** Start/stop tracking with complete history
- **Dual-Axis Charts:** Temperature and specific gravity over time
- **HTTP Fallback:** API endpoint for pytilt or testing without BLE

## Development

From your terminal:

```sh
pnpm install
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
pnpm build
```

Then run the app in production mode:

```sh
pnpm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `remix build`

- `build/`
- `public/build/`

### Using a Template

When you ran `pnpm create remix@latest` there were a few choices for hosting. You can run that again to create a new project, then copy over your `app/` folder to the new project that's pre-configured for your target server.

```sh
cd ..
# create a new project, and pick a pre-configured host
pnpm create remix@latest
cd my-new-remix-app
# remove the new project's app (not the old one!)
rm -rf app
# copy your app over
cp -R ../my-old-remix-app/app app
```
