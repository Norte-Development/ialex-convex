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

export function documentProcessedTemplate(docName: string, userName: string): string {
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
    .success-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>iAlex - Documento Procesado</h1>
    </div>
    <div class="content">
      <div class="success-icon">✅</div>
      <p>Hola ${userName},</p>
      <p>Tu documento <strong>"${docName}"</strong> ha sido procesado exitosamente y ya está disponible para consultas.</p>
      <p>Ahora puedes buscar información dentro de este documento usando el agente de IA.</p>
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

