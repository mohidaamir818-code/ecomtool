# EcomTool eBay Guide (Chrome Extension)

Manifest V3 extension that shows step-by-step overlays on **real eBay** (`ebay.co.uk` / `ebay.com`) for product research. It links to the EcomTool Learn eBay flow using the same postMessage + connect-page pattern as HuntPro.

## Features (v1)

- Connect EcomTool account via `/api/ebay-guide/connect`
- **Product hunting** guide (`hunting-basics`) with 5 steps
- Highlight + tooltip overlay on eBay (Next / Back / Skip)
- Progress saved in `chrome.storage.local` (optional sync to `POST /api/ebay-guide/progress`)
- Started from Learn eBay → **Start eBay guide (extension)**

## Load unpacked (development)

1. Run the EcomTool app: `npm run dev` (default `http://localhost:3000`)
2. Open Chrome → **Extensions** → enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `extension/ebay-guide`
5. Sign in to EcomTool, then open **Learn eBay** (`/dashboard/learn-ebay`)
6. If needed: extension popup → **Connect with EcomTool**, or use **Connect extension** on the Learn page
7. Click **Start eBay guide (extension)** — eBay opens with overlays

## Configuration

| File | Purpose |
|------|---------|
| `config/app-config.js` | EcomTool origins for the bridge script |
| `config/guide-steps.json` | Local fallback guide steps |
| `popup/popup.js` | Default app URL (`http://localhost:3000`) |

For production, set `appBaseUrl` in extension storage (or update defaults) to your deployed `APP_URL`.

## Message protocol

| Message | Direction | Purpose |
|---------|-----------|---------|
| `ECOMTOOL_EBAY_GUIDE_PING` | App → extension | Detect extension |
| `ECOMTOOL_EBAY_GUIDE_PONG` | Extension → app | Extension present |
| `ECOMTOOL_EBAY_GUIDE_CONNECT` | Connect page → extension | Save `userId` |
| `ECOMTOOL_EBAY_GUIDE_START` | App → extension | Start guide (`guideId`) |

## API routes (Next.js app)

- `GET /api/ebay-guide/connect` — connect page (reads `ecomtools_user_id`)
- `GET /api/ebay-guide/steps?guideId=hunting-basics` — guide steps JSON
- `POST /api/ebay-guide/progress` — optional progress sync

## Guide step format

```json
{
  "urlPattern": "ebay.co.uk",
  "selector": "input#gh-ac",
  "message": "Type your product keyword here",
  "position": "bottom"
}
```

## Permissions

Runs only on eBay domains for overlays. The EcomTool bridge content script listens on your app origin for `postMessage` events (same pattern as HuntPro).

## Chrome Web Store

Placeholder listing URL is used in the app until the extension is published.
