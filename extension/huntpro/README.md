# EcomTool HuntPro (Chrome extension)

This extension opens eBay sold searches, scrapes hot products, and posts them to your EcomTool `/api/hunting/receive` endpoint.

## Install (unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `extension/huntpro`
5. Keep the extension **enabled**
6. Also install **Grabley** for listing `[history]` sold data

## How it works

1. EcomTool hunting page posts `HUNTPRO_RANDOM_HUNT` / `HUNTPRO_SEARCH`
2. Bridge content script relays to the background service worker
3. Background opens eBay sold-search tabs, scrapes results, closes tabs
4. Results POST to EcomTool → seller gets email with **View Products**

## Notes

- Chrome must stay open while hunting (laptop sleep/off will pause it)
- First run may need you signed into eBay.co.uk in Chrome
