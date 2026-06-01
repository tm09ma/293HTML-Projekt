const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = __dirname;
loadEnvFile(path.join(rootDir, ".env"));

const contactEmail = "timon.messmer@edu.gbssg.ch";
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/contact") {
      await handleContactRequest(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Methode nicht erlaubt." });
      return;
    }

    serveStaticFile(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    sendJson(response, 500, { error: "Serverfehler." });
  }
});

server.listen(port, () => {
  console.log(`Portfolio server running at http://localhost:${port}/`);
});

async function handleContactRequest(request, response) {
  const body = await readJsonBody(request);
  const validationError = validateContactPayload(body);

  if (validationError) {
    sendJson(response, 400, { error: validationError });
    return;
  }

  try {
    await sendContactEmail(body);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error(error);
    sendJson(response, 502, {
      error: "Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.",
    });
  }
}

function validateContactPayload(payload) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!payload || typeof payload !== "object") {
    return "Ungültige Anfrage.";
  }

  if (!payload.name || !payload.email || !payload.message) {
    return "Bitte fülle alle Felder aus.";
  }

  if (typeof payload.name !== "string" || payload.name.trim().length > 120) {
    return "Bitte gib einen gültigen Namen ein.";
  }

  if (typeof payload.email !== "string" || !emailPattern.test(payload.email.trim())) {
    return "Bitte gib eine gültige E-Mail-Adresse ein.";
  }

  if (typeof payload.message !== "string" || payload.message.trim().length > 4000) {
    return "Bitte gib eine gültige Nachricht ein.";
  }

  return "";
}

async function sendContactEmail({ name, email, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("Missing RESEND_API_KEY or CONTACT_FROM_EMAIL.");
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safeMessage = message.trim();
  const subject = `Portfolio Kontakt: ${safeName}`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: contactEmail,
      reply_to: safeEmail,
      subject,
      text: [
        `Name: ${safeName}`,
        `E-Mail: ${safeEmail}`,
        "",
        safeMessage,
      ].join("\n"),
      html: `
        <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
        <p><strong>E-Mail:</strong> ${escapeHtml(safeEmail)}</p>
        <p><strong>Nachricht:</strong></p>
        <p>${escapeHtml(safeMessage).replaceAll("\n", "<br>")}</p>
      `,
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    throw new Error(`Resend failed with ${resendResponse.status}: ${errorText}`);
  }
}

function serveStaticFile(urlPath, response, headOnly) {
  const pathname = urlPath === "/" ? "/html/index.html" : urlPath;
  const filePath = path.normalize(path.join(rootDir, decodeURIComponent(pathname)));

  if (!filePath.startsWith(rootDir) || path.basename(filePath).startsWith(".")) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Nicht gefunden");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });

    if (!headOnly) {
      response.end(content);
      return;
    }

    response.end();
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 20_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const entries = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const entry of entries) {
    const trimmed = entry.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed
      .slice(equalsIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
