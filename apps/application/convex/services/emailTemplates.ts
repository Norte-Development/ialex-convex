export function caseUpdateTemplate(
  caseName: string,
  newStatus: string,
  userName: string,
): string {
  const statusConfig = {
    pendiente: { text: "Pendiente", color: "#F59E0B", emoji: "⏳" },
    "en progreso": { text: "En Progreso", color: "#3B82F6", emoji: "🔄" },
    completado: { text: "Completado", color: "#10B981", emoji: "✅" },
    archivado: { text: "Archivado", color: "#6B7280", emoji: "📦" },
    cancelado: { text: "Cancelado", color: "#EF4444", emoji: "❌" },
  };

  const status = statusConfig[newStatus as keyof typeof statusConfig] || {
    text: newStatus,
    color: "#6B7280",
    emoji: "📋",
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Actualización de Caso - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header { 
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
      letter-spacing: -0.5px;
    }
    .header p { 
      margin: 8px 0 0 0; 
      opacity: 0.9; 
      font-size: 14px; 
    }
    .content { 
      padding: 40px 32px; 
    }
    .greeting { 
      font-size: 18px; 
      color: #1f2937; 
      margin-bottom: 24px; 
      font-weight: 500;
    }
    .case-card { 
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); 
      border-radius: 12px; 
      padding: 24px; 
      margin: 24px 0;
      border: 1px solid #e5e7eb;
    }
    .case-name { 
      font-size: 20px; 
      font-weight: 600; 
      color: #111827; 
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .status-label { 
      font-size: 13px; 
      color: #6b7280; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      font-weight: 600; 
      margin-bottom: 8px;
    }
    .status-badge { 
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px; 
      background: ${status.color}; 
      color: white; 
      border-radius: 8px; 
      font-weight: 600; 
      font-size: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .button:hover { transform: translateY(-1px); }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    .footer-note { 
      margin-top: 8px; 
      opacity: 0.8; 
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .case-card { padding: 20px; }
      .case-name { font-size: 18px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>⚖️ iAlex</h1>
        <p>Tu asistente legal inteligente</p>
      </div>
      <div class="content">
        <p class="greeting">Hola ${userName},</p>
        <p style="color: #4b5563; margin-bottom: 24px;">El estado de tu caso ha sido actualizado. Aquí están los detalles:</p>
        <div class="case-card">
          <div class="case-name">${caseName}</div>
          <div class="status-label">Nuevo Estado</div>
          <div class="status-badge">
            <span>${status.emoji}</span>
            <span>${status.text}</span>
          </div>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}/cases" class="button">Ver Detalles del Caso</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div class="footer-note">Este es un mensaje automático, por favor no responder a este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function documentProcessedTemplate(
  docName: string,
  userName: string,
  status: "success" | "failure",
  errorMessage?: string,
): string {
  const isSuccess = status === "success";

  const config = isSuccess
    ? {
        gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        icon: "✅",
        iconBg: "#d1fae5",
        iconColor: "#059669",
        title: "Documento Procesado Exitosamente",
        message: `Tu documento <strong>"${docName}"</strong> ha sido procesado exitosamente y ya está disponible para consultas.`,
        detail:
          "Ahora puedes buscar información dentro de este documento usando el agente de IA.",
        buttonText: "Abrir iAlex",
        buttonGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      }
    : {
        gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        icon: "⚠️",
        iconBg: "#fee2e2",
        iconColor: "#dc2626",
        title: "Error al Procesar Documento",
        message: `Lamentablemente, hubo un problema al procesar tu documento <strong>"${docName}"</strong>.`,
        detail:
          errorMessage ||
          "Por favor, intenta subirlo nuevamente o comunícate con el soporte.",
        buttonText: "Intentar Nuevamente",
        buttonGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${config.title} - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: ${config.gradient}; 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 26px; 
      font-weight: 700; 
      margin: 0; 
      line-height: 1.3;
    }
    .content { padding: 40px 32px; }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: ${config.iconBg};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    .greeting { 
      font-size: 18px; 
      color: #1f2937; 
      margin-bottom: 20px; 
      font-weight: 500;
    }
    .message { 
      color: #4b5563; 
      margin-bottom: 16px; 
      font-size: 16px;
      line-height: 1.6;
    }
    .detail-box {
      background: #f9fafb;
      border-left: 4px solid ${config.iconColor};
      padding: 16px 20px;
      border-radius: 8px;
      margin: 24px 0;
      color: #374151;
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: ${config.buttonGradient}; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 22px; }
      .content { padding: 32px 24px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>${config.title}</h1>
      </div>
      <div class="content">
        <div class="icon-wrapper">${config.icon}</div>
        <p class="greeting">Hola ${userName},</p>
        <p class="message">${config.message}</p>
        <div class="detail-box">${config.detail}</div>
        ${
          isSuccess
            ? `<div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}" class="button">${config.buttonText}</a>
        </div>`
            : ""
        }
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Este es un mensaje automático, por favor no responder a este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function teamInviteTemplate(
  teamName: string,
  inviterName: string,
  inviteLink: string,
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Invitación a Equipo - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
    }
    .content { padding: 40px 32px; }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: #ede9fe;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    .intro { 
      font-size: 17px; 
      color: #4b5563; 
      margin-bottom: 32px; 
      text-align: center;
    }
    .team-card { 
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); 
      border-radius: 12px; 
      padding: 28px; 
      margin: 24px 0;
      border: 2px solid #e9d5ff;
    }
    .team-row {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e9d5ff;
    }
    .team-row:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .team-label {
      font-size: 13px;
      color: #7c3aed;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      min-width: 120px;
    }
    .team-value {
      font-size: 18px;
      color: #1f2937;
      font-weight: 600;
    }
    .button { 
      display: inline-block; 
      padding: 16px 40px; 
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.3);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .team-card { padding: 20px; }
      .team-row { flex-direction: column; align-items: flex-start; }
      .team-label { margin-bottom: 4px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>👥 Invitación a Equipo</h1>
      </div>
      <div class="content">
        <div class="icon-wrapper">🎉</div>
        <p class="intro">Has sido invitado a unirte a un equipo en iAlex</p>
        <div class="team-card">
          <div class="team-row">
            <div class="team-label">Equipo</div>
            <div class="team-value">${teamName}</div>
          </div>
          <div class="team-row">
            <div class="team-label">Invitado por</div>
            <div class="team-value">${inviterName}</div>
          </div>
        </div>
        <p style="color: #4b5563; margin: 24px 0; text-align: center;">Acepta la invitación para colaborar con tu equipo en casos y documentos.</p>
        <div style="text-align: center;">
          <a href="${inviteLink}" class="button">Aceptar Invitación</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Si no esperabas esta invitación, puedes ignorar este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function agentTaskCompleteTemplate(
  taskDescription: string,
  userName: string,
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Tarea Completada - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
    }
    .content { padding: 40px 32px; }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: #dbeafe;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    .greeting { 
      font-size: 18px; 
      color: #1f2937; 
      margin-bottom: 20px; 
      font-weight: 500;
    }
    .intro {
      color: #4b5563;
      margin-bottom: 24px;
      font-size: 16px;
    }
    .task-card { 
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); 
      border-radius: 12px; 
      padding: 24px; 
      margin: 24px 0;
      border-left: 4px solid #3b82f6;
      color: #1e40af;
      font-size: 16px;
      line-height: 1.6;
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .task-card { padding: 20px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>🤖 Tarea Completada</h1>
      </div>
      <div class="content">
        <div class="icon-wrapper">✨</div>
        <p class="greeting">Hola ${userName},</p>
        <p class="intro">El agente de IA ha completado exitosamente la siguiente tarea:</p>
        <div class="task-card">${taskDescription}</div>
        <div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}" class="button">Ver en iAlex</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Este es un mensaje automático, por favor no responder a este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function eventReminderTemplate(
  eventTitle: string,
  eventType: string,
  startDate: string,
  startTime: string,
  location: string | undefined,
  meetingUrl: string | undefined,
  userName: string,
  minutesUntil: number,
): string {
  const eventTypeConfig: Record<
    string,
    { label: string; emoji: string; color: string }
  > = {
    audiencia: { label: "Audiencia", emoji: "🏛️", color: "#dc2626" },
    plazo: { label: "Plazo Legal", emoji: "⏰", color: "#ea580c" },
    reunion_cliente: {
      label: "Reunión con Cliente",
      emoji: "👥",
      color: "#2563eb",
    },
    presentacion: { label: "Presentación", emoji: "📄", color: "#7c3aed" },
    reunion_equipo: {
      label: "Reunión de Equipo",
      emoji: "👨‍💼",
      color: "#0891b2",
    },
    personal: { label: "Evento Personal", emoji: "🙋", color: "#059669" },
    otro: { label: "Otro Evento", emoji: "📌", color: "#6b7280" },
  };

  const config = eventTypeConfig[eventType] || eventTypeConfig.otro;

  const timeLabel =
    minutesUntil >= 1440
      ? `en ${Math.floor(minutesUntil / 1440)} día${Math.floor(minutesUntil / 1440) > 1 ? "s" : ""}`
      : minutesUntil >= 60
        ? `en ${Math.floor(minutesUntil / 60)} hora${Math.floor(minutesUntil / 60) > 1 ? "s" : ""}`
        : `en ${minutesUntil} minuto${minutesUntil > 1 ? "s" : ""}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Recordatorio de Evento - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
    }
    .content { padding: 40px 32px; }
    .urgency-badge {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 18px;
      text-align: center;
      margin: 0 auto 32px;
      display: inline-block;
      box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);
    }
    .greeting { 
      font-size: 18px; 
      color: #1f2937; 
      margin-bottom: 20px; 
      font-weight: 500;
    }
    .event-card { 
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); 
      border-radius: 12px; 
      padding: 28px; 
      margin: 24px 0;
      border-left: 4px solid ${config.color};
    }
    .event-type {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${config.color};
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .event-title { 
      font-size: 24px; 
      font-weight: 700; 
      color: #1f2937; 
      margin-bottom: 20px;
      line-height: 1.3;
    }
    .event-detail {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
      color: #374151;
      font-size: 15px;
    }
    .event-icon {
      font-size: 20px;
      min-width: 24px;
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.3);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .event-card { padding: 20px; }
      .event-title { font-size: 20px; }
      .urgency-badge { font-size: 16px; padding: 10px 20px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>⏰ Recordatorio de Evento</h1>
      </div>
      <div class="content">
        <div style="text-align: center;">
          <div class="urgency-badge">⚡ Comienza ${timeLabel}</div>
        </div>
        <p class="greeting">Hola ${userName},</p>
        <p style="color: #4b5563; margin-bottom: 24px;">Este es un recordatorio de tu próximo evento:</p>
        <div class="event-card">
          <div class="event-type">
            <span>${config.emoji}</span>
            <span>${config.label}</span>
          </div>
          <div class="event-title">${eventTitle}</div>
          <div class="event-detail">
            <span class="event-icon">📅</span>
            <div><strong>Fecha:</strong> ${startDate}</div>
          </div>
          <div class="event-detail">
            <span class="event-icon">🕐</span>
            <div><strong>Hora:</strong> ${startTime}</div>
          </div>
          ${
            location
              ? `<div class="event-detail">
            <span class="event-icon">📍</span>
            <div><strong>Ubicación:</strong> ${location}</div>
          </div>`
              : ""
          }
          ${
            meetingUrl
              ? `<div class="event-detail">
            <span class="event-icon">🔗</span>
            <div><strong>Enlace:</strong> <a href="${meetingUrl}" style="color: #2563eb; text-decoration: none;">${meetingUrl}</a></div>
          </div>`
              : ""
          }
        </div>
        <div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}" class="button">Ver Detalles del Evento</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Este es un mensaje automático, por favor no responder a este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function eventInviteTemplate(
  eventTitle: string,
  eventType: string,
  startDate: string,
  startTime: string,
  location: string | undefined,
  meetingUrl: string | undefined,
  organizerName: string,
  userName: string,
): string {
  const eventTypeConfig: Record<
    string,
    { label: string; emoji: string; color: string }
  > = {
    audiencia: { label: "Audiencia", emoji: "🏛️", color: "#dc2626" },
    plazo: { label: "Plazo Legal", emoji: "⏰", color: "#ea580c" },
    reunion_cliente: {
      label: "Reunión con Cliente",
      emoji: "👥",
      color: "#2563eb",
    },
    presentacion: { label: "Presentación", emoji: "📄", color: "#7c3aed" },
    reunion_equipo: {
      label: "Reunión de Equipo",
      emoji: "👨‍💼",
      color: "#0891b2",
    },
    personal: { label: "Evento Personal", emoji: "🙋", color: "#059669" },
    otro: { label: "Otro Evento", emoji: "📌", color: "#6b7280" },
  };

  const config = eventTypeConfig[eventType] || eventTypeConfig.otro;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Invitación a Evento - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
    }
    .content { padding: 40px 32px; }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: #cffafe;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    .intro { 
      font-size: 17px; 
      color: #4b5563; 
      margin-bottom: 8px; 
      text-align: center;
    }
    .organizer {
      font-size: 19px;
      font-weight: 600;
      color: #1f2937;
      text-align: center;
      margin-bottom: 32px;
    }
    .event-card { 
      background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%); 
      border-radius: 12px; 
      padding: 28px; 
      margin: 24px 0;
      border-left: 4px solid ${config.color};
    }
    .event-type {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${config.color};
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .event-title { 
      font-size: 24px; 
      font-weight: 700; 
      color: #1f2937; 
      margin-bottom: 20px;
      line-height: 1.3;
    }
    .event-detail {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
      color: #374151;
      font-size: 15px;
    }
    .event-icon {
      font-size: 20px;
      min-width: 24px;
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px -1px rgba(6, 182, 212, 0.3);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .event-card { padding: 20px; }
      .event-title { font-size: 20px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>📅 Invitación a Evento</h1>
      </div>
      <div class="content">
        <div class="icon-wrapper">✉️</div>
        <p class="intro">Hola ${userName},</p>
        <p class="organizer">${organizerName} te ha invitado a un evento</p>
        <div class="event-card">
          <div class="event-type">
            <span>${config.emoji}</span>
            <span>${config.label}</span>
          </div>
          <div class="event-title">${eventTitle}</div>
          <div class="event-detail">
            <span class="event-icon">📅</span>
            <div><strong>Fecha:</strong> ${startDate}</div>
          </div>
          <div class="event-detail">
            <span class="event-icon">🕐</span>
            <div><strong>Hora:</strong> ${startTime}</div>
          </div>
          ${
            location
              ? `<div class="event-detail">
            <span class="event-icon">📍</span>
            <div><strong>Ubicación:</strong> ${location}</div>
          </div>`
              : ""
          }
          ${
            meetingUrl
              ? `<div class="event-detail">
            <span class="event-icon">🔗</span>
            <div><strong>Enlace:</strong> <a href="${meetingUrl}" style="color: #2563eb; text-decoration: none;">${meetingUrl}</a></div>
          </div>`
              : ""
          }
        </div>
        <div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}" class="button">Ver Evento</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Este es un mensaje automático, por favor no responder a este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function eventUpdateTemplate(
  eventTitle: string,
  updateType: "status" | "details",
  oldValue: string,
  newValue: string,
  userName: string,
): string {
  const updateLabels: Record<string, string> = {
    status: "Estado del Evento",
    details: "Detalles del Evento",
  };

  const statusConfig: Record<
    string,
    { label: string; color: string; emoji: string }
  > = {
    programado: { label: "Programado", color: "#3b82f6", emoji: "📅" },
    completado: { label: "Completado", color: "#10b981", emoji: "✅" },
    cancelado: { label: "Cancelado", color: "#ef4444", emoji: "❌" },
    reprogramado: { label: "Reprogramado", color: "#f59e0b", emoji: "🔄" },
  };

  const oldStatus = statusConfig[oldValue] || {
    label: oldValue,
    color: "#6b7280",
    emoji: "📋",
  };
  const newStatus = statusConfig[newValue] || {
    label: newValue,
    color: "#6b7280",
    emoji: "📋",
  };

  const displayOld = updateType === "status" ? oldStatus.label : oldValue;
  const displayNew = updateType === "status" ? newStatus.label : newValue;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Actualización de Evento - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
    }
    .content { padding: 40px 32px; }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: #f3e8ff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    .greeting { 
      font-size: 18px; 
      color: #1f2937; 
      margin-bottom: 20px; 
      font-weight: 500;
    }
    .event-title {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
      text-align: center;
      margin-bottom: 32px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .update-card { 
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); 
      border-radius: 12px; 
      padding: 28px; 
      margin: 24px 0;
      border-left: 4px solid #a855f7;
    }
    .update-label {
      font-size: 13px;
      color: #9333ea;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .change-box {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-top: 16px;
    }
    .change-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }
    .change-row:last-child {
      margin-bottom: 0;
    }
    .change-label {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      min-width: 80px;
    }
    .change-value {
      font-size: 16px;
      color: #1f2937;
      font-weight: 600;
      flex: 1;
    }
    .arrow {
      color: #9333ea;
      font-size: 20px;
      font-weight: bold;
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px -1px rgba(168, 85, 247, 0.3);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .update-card { padding: 20px; }
      .change-row { flex-direction: column; align-items: flex-start; gap: 8px; }
      .arrow { transform: rotate(90deg); }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>🔔 Actualización de Evento</h1>
      </div>
      <div class="content">
        <div class="icon-wrapper">📝</div>
        <p class="greeting">Hola ${userName},</p>
        <p style="color: #4b5563; margin-bottom: 24px; text-align: center;">Se ha realizado una actualización en tu evento</p>
        <div class="event-title">"${eventTitle}"</div>
        <div class="update-card">
          <div class="update-label">${updateLabels[updateType]}</div>
          <div class="change-box">
            <div class="change-row">
              <div class="change-label">Antes</div>
              <div class="change-value">${displayOld}</div>
            </div>
            <div style="text-align: center; margin: 12px 0;">
              <span class="arrow">↓</span>
            </div>
            <div class="change-row">
              <div class="change-label">Ahora</div>
              <div class="change-value">${displayNew}</div>
            </div>
          </div>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}/eventos" class="button">Ver Evento</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Este es un mensaje automático, por favor no responder a este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function subscriptionThankYouTemplate(
  userName: string,
  planName: string,
  features: string[],
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>¡Gracias por Suscribirte! - iAlex</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header { 
      background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
      color: white; 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0; 
      letter-spacing: -0.5px;
    }
    .header p { 
      margin: 8px 0 0 0; 
      opacity: 0.9; 
      font-size: 14px; 
    }
    .content { 
      padding: 40px 32px; 
    }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: #d1fae5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    .greeting { 
      font-size: 18px; 
      color: #1f2937; 
      margin-bottom: 24px; 
      font-weight: 500;
    }
    .plan-card { 
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); 
      border-radius: 12px; 
      padding: 24px; 
      margin: 24px 0;
      border: 2px solid #a7f3d0;
      text-align: center;
    }
    .plan-label { 
      font-size: 13px; 
      color: #047857; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      font-weight: 600; 
      margin-bottom: 8px;
    }
    .plan-name { 
      font-size: 24px; 
      font-weight: 700; 
      color: #065f46; 
      margin-bottom: 16px;
    }
    .features-list {
      margin: 24px 0;
      padding: 0;
      list-style: none;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      color: #374151;
      font-size: 15px;
      line-height: 1.5;
    }
    .feature-icon {
      color: #10b981;
      font-weight: bold;
      font-size: 18px;
      flex-shrink: 0;
    }
    .highlight-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .highlight-box p {
      color: #92400e;
      margin: 0;
      font-size: 15px;
      line-height: 1.6;
    }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin-top: 24px; 
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
    }
    .footer { 
      text-align: center; 
      color: #6b7280; 
      font-size: 13px; 
      padding: 32px; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer-brand { 
      font-weight: 600; 
      color: #1f2937; 
      margin-bottom: 8px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 24px; }
      .content { padding: 32px 24px; }
      .plan-card { padding: 20px; }
      .plan-name { font-size: 20px; }
      .button { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>🎉 ¡Bienvenido a iAlex!</h1>
        <p>Tu suscripción está activa</p>
      </div>
      <div class="content">
        <div class="icon-wrapper">✨</div>
        <p class="greeting">Hola ${userName},</p>
        <p style="color: #4b5563; margin-bottom: 24px;">
          Queremos agradecerte por unirte a iAlex. Tu confianza en nosotros es el motor que nos impulsa a seguir mejorando cada día.
        </p>
        <div class="plan-card">
          <div class="plan-label">Tu Plan</div>
          <div class="plan-name">${planName}</div>
        </div>
        <p style="color: #4b5563; margin: 24px 0 16px 0;">
          <strong>Ahora tienes acceso completo a:</strong>
        </p>
        <ul class="features-list">
          ${features
            .map(
              (feature) => `
          <li class="feature-item">
            <span class="feature-icon">✓</span>
            <span>${feature}</span>
          </li>
          `,
            )
            .join("")}
        </ul>
        <div class="highlight-box">
          <p>
            <strong>💡 Consejo:</strong> Comienza creando tu primer caso y sube tus documentos clave. 
            Nuestro asistente de IA estará listo para ayudarte con análisis jurídicos, 
            búsquedas de jurisprudencia y redacción de escritos.
          </p>
        </div>
        <p style="color: #4b5563; margin: 24px 0;">
          Estamos aquí para ayudarte a transformar tu práctica legal. Si tienes alguna pregunta 
          o necesitas asistencia, nuestro equipo está a tu disposición.
        </p>
        <div style="text-align: center;">
          <a href="${process.env.VITE_APP_URL}/casos" class="button">Comenzar Ahora</a>
        </div>
        <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">
          Un cordial saludo,<br>
          <strong style="color: #1f2937;">El Equipo de iAlex</strong>
        </p>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Gracias por confiar en nosotros para potenciar tu práctica legal.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
