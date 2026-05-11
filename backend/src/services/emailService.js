const nodemailer = require("nodemailer");

function emailsDisabled() {
  if (process.env.JEST_WORKER_ID) {
    return true;
  }

  return String(process.env.DISABLE_EMAILS || "").toLowerCase() === "true";
}

function emailLogsDisabled() {
  return String(process.env.DISABLE_EMAIL_LOGS || "").toLowerCase() === "true";
}

function getMailConfigSummary() {
  return {
    host: process.env.MAIL_HOST || null,
    port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : null,
    user: process.env.MAIL_USER || null,
    from: process.env.MAIL_FROM || "noreply@bet.pt",
    disabled: emailsDisabled(),
  };
}

function logEmail(event, payload) {
  if (!emailLogsDisabled()) {
    console.info(event, payload);
  }
}

function getTransporter() {
  if (!process.env.MAIL_HOST || !process.env.MAIL_PORT) {
    throw new Error("Configuracao SMTP incompleta.");
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465,
    auth:
      process.env.MAIL_USER && process.env.MAIL_PASS
        ? {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
          }
        : undefined,
  });
}

function formatExpiresAt(expiresAt) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(expiresAt));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function enviarConviteDefinirPassword({ to, nome, definirPasswordUrl, expiresAt }) {
  const subject = "A sua conta B&T esta pronta";
  const safeNome = escapeHtml(nome);
  const safeUrl = escapeHtml(definirPasswordUrl);
  const expiresAtLabel = escapeHtml(formatExpiresAt(expiresAt));
  const text = [
    `Bem-vindo ao B&T, ${nome}.`,
    "",
    "Foi criada uma conta de acesso ao backoffice para si.",
    "Por favor, aceda ao link abaixo para definir a sua palavra-passe:",
    "",
    definirPasswordUrl,
    "",
    `Este link expira em ${formatExpiresAt(expiresAt)}.`,
    "",
    "Se nao estava a espera deste email, pode ignora-lo.",
  ].join("\n");

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#102421;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          A sua conta de backoffice B&amp;T esta pronta. Defina a sua palavra-passe.
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2ddd3;">
                <tr>
                  <td style="background:#4f6659;padding:28px 32px;color:#ffffff;">
                    <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#dce8df;">Baths &amp; Trims</div>
                    <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">Bem-vindo ao B&amp;T</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Ola ${safeNome},</p>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                      Foi criada uma conta de acesso ao backoffice da B&amp;T para si.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
                      Para comecar, defina a sua palavra-passe atraves do botao abaixo.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="background:#4f6659;border-radius:8px;">
                          <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                            Definir palavra-passe
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#586863;">
                      Este link expira em <strong>${expiresAtLabel}</strong>.
                    </p>
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b7773;">
                      Se o botao nao funcionar, copie e cole este link no browser:
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
                      <a href="${safeUrl}" style="color:#4f6659;">${safeUrl}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 32px;background:#f8f6f1;color:#6b7773;font-size:12px;line-height:1.5;">
                    Se nao estava a espera deste email, pode ignora-lo.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  if (emailsDisabled()) {
    const result = {
      sent: false,
      skipped: true,
      reason: process.env.JEST_WORKER_ID ? "JEST_WORKER_ID" : "DISABLE_EMAILS=true",
      smtp: getMailConfigSummary(),
      debugVisible: !emailLogsDisabled(),
    };
    logEmail("[email:convite] skipped", result);
    return result;
  }

  const info = await getTransporter().sendMail({
    from: process.env.MAIL_FROM || "noreply@bet.pt",
    to,
    subject,
    text,
    html,
  });

  const result = {
    sent: true,
    skipped: false,
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    response: info.response || null,
    smtp: getMailConfigSummary(),
    debugVisible: !emailLogsDisabled(),
  };

  logEmail("[email:convite] sent", {
    to,
    subject,
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    response: result.response,
    smtp: result.smtp,
  });

  return result;
}

module.exports = {
  enviarConviteDefinirPassword,
};
