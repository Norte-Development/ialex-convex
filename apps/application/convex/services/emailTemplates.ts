export function caseUpdateTemplate(caseName: string, newStatus: string, userName: string): string {
  const statusText = {
    pendiente: "Pendiente",
    "en progreso": "En Progreso",
    completado: "Completado",
    archivado: "Archivado",
    cancelado: "Cancelado"
  }[newStatus] || newStatus;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
    .status-badge { display: inline-block; padding: 8px 16px; background: #4CAF50; color: white; border-radius: 4px; font-weight: bold; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>iAlex - Actualización de Caso</h1>
    </div>
    <div class="content">
      <p>Hola ${userName},</p>
      <p>El estado del caso <strong>"${caseName}"</strong> ha sido actualizado.</p>
      <p>Nuevo estado: <span class="status-badge">${statusText}</span></p>
      <a href="${process.env.CONVEX_SITE_URL}/cases" class="button">Ver Caso</a>
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Este es un mensaje automático, por favor no responder a este correo.</p>
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
  errorMessage?: string
): string {
  const isSuccess = status === "success";

  const title = isSuccess
    ? "iAlex - Documento Procesado"
    : "iAlex - Error al Procesar Documento";

  const icon = isSuccess ? "✅" : "⚠️";
  const contentMessage = isSuccess
    ? `
      <p>Hola ${userName},</p>
      <p>Tu documento <strong>"${docName}"</strong> ha sido procesado exitosamente y ya está disponible para consultas.</p>
      <p>Ahora puedes buscar información dentro de este documento usando el agente de IA.</p>
    `
    : `
      <p>Hola ${userName},</p>
      <p>Lamentablemente, hubo un problema al procesar tu documento <strong>"${docName}"</strong>.</p>
      <p>${errorMessage ? errorMessage : "Por favor, intenta subirlo nuevamente o comunícate con el soporte."}</p>
    `;

  const button =
    isSuccess && `
      <div style="text-align: center;">
        <a href="#" class="button">Abrir iAlex</a>
      </div>
    `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: ${isSuccess ? "#1a1a1a" : "#b71c1c"};
      color: white;
      padding: 20px;
      text-align: center;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      margin: 20px 0;
    }
    .success-icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 20px;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 12px;
      padding: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #1a1a1a;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      <div class="success-icon">${icon}</div>
      ${contentMessage}
      ${button || ""}
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Este es un mensaje automático, por favor no responder a este correo.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function teamInviteTemplate(teamName: string, inviterName: string, inviteLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
    .team-info { background: white; padding: 20px; border-left: 4px solid #4CAF50; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>iAlex - Invitación a Equipo</h1>
    </div>
    <div class="content">
      <p>Has sido invitado a unirte a un equipo en iAlex.</p>
      <div class="team-info">
        <p><strong>Equipo:</strong> ${teamName}</p>
        <p><strong>Invitado por:</strong> ${inviterName}</p>
      </div>
      <p>Acepta la invitación para colaborar con tu equipo en casos y documentos.</p>
      <a href="${inviteLink}" class="button">Aceptar Invitación</a>
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Si no esperabas esta invitación, puedes ignorar este correo.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function agentTaskCompleteTemplate(taskDescription: string, userName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
    .task-box { background: white; padding: 20px; border-left: 4px solid #2196F3; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>iAlex - Tarea Completada</h1>
    </div>
    <div class="content">
      <p>Hola ${userName},</p>
      <p>El agente ha completado la siguiente tarea:</p>
      <div class="task-box">
        <p>${taskDescription}</p>
      </div>
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Este es un mensaje automático, por favor no responder a este correo.</p>
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
  minutesUntil: number
): string {
  const eventTypeLabels: Record<string, string> = {
    audiencia: "🏛️ Audiencia",
    plazo: "⏰ Plazo Legal",
    reunion_cliente: "👥 Reunión con Cliente",
    presentacion: "📄 Presentación",
    reunion_equipo: "👨‍💼 Reunión de Equipo",
    personal: "🙋 Evento Personal",
    otro: "📌 Otro Evento",
  };

  const timeLabel = minutesUntil >= 1440 
    ? `en ${Math.floor(minutesUntil / 1440)} día(s)`
    : minutesUntil >= 60
    ? `en ${Math.floor(minutesUntil / 60)} hora(s)`
    : `en ${minutesUntil} minuto(s)`;

  const locationInfo = location 
    ? `<p><strong>📍 Ubicación:</strong> ${location}</p>`
    : "";

  const meetingInfo = meetingUrl
    ? `<p><strong>🔗 Enlace:</strong> <a href="${meetingUrl}" style="color: #2196F3;">${meetingUrl}</a></p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
    .event-box { background: white; padding: 20px; border-left: 4px solid #FF9800; margin: 20px 0; }
    .time-badge { display: inline-block; padding: 8px 16px; background: #FF5722; color: white; border-radius: 4px; font-weight: bold; margin: 10px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #FF9800; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Recordatorio de Evento</h1>
    </div>
    <div class="content">
      <p>Hola ${userName},</p>
      <p>Este es un recordatorio de tu próximo evento:</p>
      <div class="event-box">
        <h2 style="margin-top: 0;">${eventTitle}</h2>
        <p><strong>Tipo:</strong> ${eventTypeLabels[eventType] || eventType}</p>
        <p><strong>📅 Fecha:</strong> ${startDate}</p>
        <p><strong>🕐 Hora:</strong> ${startTime}</p>
        ${locationInfo}
        ${meetingInfo}
        <div class="time-badge">Comienza ${timeLabel}</div>
      </div>
      <p style="text-align: center;">
        <a href="${process.env.CONVEX_SITE_URL}/eventos" class="button">Ver Detalles del Evento</a>
      </p>
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Este es un mensaje automático, por favor no responder a este correo.</p>
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
  userName: string
): string {
  const eventTypeLabels: Record<string, string> = {
    audiencia: "🏛️ Audiencia",
    plazo: "⏰ Plazo Legal",
    reunion_cliente: "👥 Reunión con Cliente",
    presentacion: "📄 Presentación",
    reunion_equipo: "👨‍💼 Reunión de Equipo",
    personal: "🙋 Evento Personal",
    otro: "📌 Otro Evento",
  };

  const locationInfo = location 
    ? `<p><strong>📍 Ubicación:</strong> ${location}</p>`
    : "";

  const meetingInfo = meetingUrl
    ? `<p><strong>🔗 Enlace:</strong> <a href="${meetingUrl}" style="color: #2196F3;">${meetingUrl}</a></p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
    .event-box { background: white; padding: 20px; border-left: 4px solid #2196F3; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Invitación a Evento</h1>
    </div>
    <div class="content">
      <p>Hola ${userName},</p>
      <p><strong>${organizerName}</strong> te ha invitado al siguiente evento:</p>
      <div class="event-box">
        <h2 style="margin-top: 0;">${eventTitle}</h2>
        <p><strong>Tipo:</strong> ${eventTypeLabels[eventType] || eventType}</p>
        <p><strong>📅 Fecha:</strong> ${startDate}</p>
        <p><strong>🕐 Hora:</strong> ${startTime}</p>
        ${locationInfo}
        ${meetingInfo}
      </div>
      <p style="text-align: center;">
        <a href="${process.env.CONVEX_SITE_URL}/eventos" class="button">Ver Evento</a>
      </p>
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Este es un mensaje automático, por favor no responder a este correo.</p>
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
  userName: string
): string {
  const updateLabels: Record<string, string> = {
    status: "Estado",
    details: "Detalles",
  };

  const statusLabels: Record<string, string> = {
    programado: "Programado",
    completado: "Completado",
    cancelado: "Cancelado",
    reprogramado: "Reprogramado",
  };

  const displayOld = updateType === "status" ? statusLabels[oldValue] || oldValue : oldValue;
  const displayNew = updateType === "status" ? statusLabels[newValue] || newValue : newValue;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; margin: 20px 0; }
    .update-box { background: white; padding: 20px; border-left: 4px solid #9C27B0; margin: 20px 0; }
    .change { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #9C27B0; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Actualización de Evento</h1>
    </div>
    <div class="content">
      <p>Hola ${userName},</p>
      <p>El evento <strong>"${eventTitle}"</strong> ha sido actualizado.</p>
      <div class="update-box">
        <p><strong>Cambio realizado:</strong> ${updateLabels[updateType]}</p>
        <div class="change">
          <p><strong>Antes:</strong> ${displayOld}</p>
          <p><strong>Ahora:</strong> ${displayNew}</p>
        </div>
      </div>
      <p style="text-align: center;">
        <a href="${process.env.CONVEX_SITE_URL}/eventos" class="button">Ver Evento</a>
      </p>
    </div>
    <div class="footer">
      <p>iAlex - Tu asistente legal inteligente</p>
      <p>Este es un mensaje automático, por favor no responder a este correo.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

