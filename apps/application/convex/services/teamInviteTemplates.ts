export function teamInviteExistingUserTemplate(
  teamName: string, 
  inviterName: string, 
  roleName: string, 
  inviteUrl: string, 
  expiryDate: string
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
    .expiry-notice {
      color: #6b7280;
      font-size: 14px;
      text-align: center;
      margin-top: 16px;
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
          <div class="team-row">
            <div class="team-label">Rol asignado</div>
            <div class="team-value">${roleName}</div>
          </div>
        </div>
        <p style="color: #4b5563; margin: 24px 0; text-align: center;">Acepta la invitación para colaborar con tu equipo en casos y documentos.</p>
        <div style="text-align: center;">
          <a href="${inviteUrl}" class="button">Aceptar Invitación</a>
        </div>
        <p class="expiry-notice">Esta invitación expira el ${expiryDate}</p>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Si no esperabas esta invitación, puedes ignorar este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function teamInviteNewUserTemplate(
  teamName: string, 
  inviterName: string, 
  roleName: string, 
  signupUrl: string, 
  expiryDate: string
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
    .expiry-notice {
      color: #6b7280;
      font-size: 14px;
      text-align: center;
      margin-top: 16px;
    }
    .info-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
    }
    .info-box p {
      color: #0369a1;
      font-size: 14px;
      margin: 0;
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
          <div class="team-row">
            <div class="team-label">Rol asignado</div>
            <div class="team-value">${roleName}</div>
          </div>
        </div>
        <div class="info-box">
          <p><strong>¿Qué es iAlex?</strong> Una plataforma de gestión legal que te ayudará a colaborar con tu equipo en casos, documentos y más.</p>
        </div>
        <p style="color: #4b5563; margin: 24px 0; text-align: center;">Para comenzar, necesitas crear una cuenta en iAlex y automáticamente serás agregado/a al equipo.</p>
        <div style="text-align: center;">
          <a href="${signupUrl}" class="button">Crear Cuenta y Unirse al Equipo</a>
        </div>
        <p class="expiry-notice">Esta invitación expira el ${expiryDate}</p>
      </div>
      <div class="footer">
        <div class="footer-brand">iAlex - Tu asistente legal inteligente</div>
        <div>Si no esperabas esta invitación, puedes ignorar este correo.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
