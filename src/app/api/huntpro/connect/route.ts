import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CONNECT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect HuntPro — EcomTool</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #F9FAFB;
      color: #111827;
    }
    .card {
      width: 100%;
      max-width: 420px;
      margin: 16px;
      background: #fff;
      border: 1px solid #F3F4F6;
      border-radius: 20px;
      box-shadow: 0 12px 40px rgba(17, 24, 39, 0.08);
      padding: 32px 28px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #5842F4;
      background: #EEF0FF;
      border: 1px solid #DDD6FE;
      border-radius: 999px;
      padding: 6px 12px;
    }
    h1 { font-size: 20px; margin: 18px 0 6px; }
    p { font-size: 14px; line-height: 1.5; color: #6B7280; margin: 0; }
    .id {
      margin-top: 16px;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      word-break: break-all;
      background: #F9FAFB;
      border: 1px solid #F3F4F6;
      border-radius: 10px;
      padding: 10px 12px;
      display: none;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      background: #5842F4;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 12px;
    }
    .ok { color: #059669; }
    .err { color: #DC2626; }
    .spinner {
      width: 28px; height: 28px;
      margin: 4px auto 0;
      border: 3px solid #E5E7EB;
      border-top-color: #5842F4;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">HuntPro · EcomTool</span>
    <h1 id="title">Connecting…</h1>
    <div class="spinner" id="spinner"></div>
    <p id="status">Checking your EcomTool session.</p>
    <div class="id" id="userId"></div>
    <div id="actions"></div>
  </div>

  <script>
    (function () {
      var titleEl = document.getElementById("title");
      var statusEl = document.getElementById("status");
      var spinnerEl = document.getElementById("spinner");
      var idEl = document.getElementById("userId");
      var actionsEl = document.getElementById("actions");

      var userId = null;
      try {
        userId = localStorage.getItem("ecomtools_user_id") || sessionStorage.getItem("ecomtools_user_id");
      } catch (e) {}

      if (spinnerEl) spinnerEl.style.display = "none";

      if (userId) {
        // Expose the id for the HuntPro extension's content script.
        document.documentElement.setAttribute("data-ecomtool-user-id", userId);

        var message = { type: "ECOMTOOL_HUNTPRO_CONNECT", source: "ecomtool", userId: userId };
        try { window.postMessage(message, "*"); } catch (e) {}
        try { if (window.opener) window.opener.postMessage(message, "*"); } catch (e) {}

        titleEl.textContent = "Connected";
        titleEl.className = "ok";
        statusEl.textContent = "Your EcomTool account is linked. You can return to the HuntPro extension and close this tab.";
        idEl.textContent = userId;
        idEl.style.display = "block";
      } else {
        titleEl.textContent = "Not signed in";
        titleEl.className = "err";
        statusEl.textContent = "Sign in to EcomTool first, then click \\"Connect with EcomTool\\" again.";
        actionsEl.innerHTML = '<a class="btn" href="/sign-in">Sign in to EcomTool</a>';
      }
    })();
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(CONNECT_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
