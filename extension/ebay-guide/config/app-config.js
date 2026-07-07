/** @type {{ appOrigins: string[]; defaultGuideId: string }} */
export const APP_CONFIG = {
  // Origins where the EcomTool web app runs (bridge content script).
  appOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  defaultGuideId: "hunting-basics",
};

export function isEcomToolOrigin(origin) {
  if (!origin) return false;
  if (APP_CONFIG.appOrigins.includes(origin)) return true;
  // Allow deployed EcomTool hosts (customise for your production domain).
  try {
    const host = new URL(origin).hostname;
    return host.includes("ecomtool") || host.includes("vercel.app");
  } catch {
    return false;
  }
}
