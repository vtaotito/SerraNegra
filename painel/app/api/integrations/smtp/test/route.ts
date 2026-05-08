import { NextRequest, NextResponse } from "next/server";
import { requireRole, findUserById, logActivity } from "@/lib/auth";
import { sendTestEmail } from "@/lib/mailer";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("admin", "supervisor");
  } catch (err) {
    const code = err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      {
        success: false,
        error: code === 403 ? "Sem permissão" : "Não autenticado",
      },
      { status: code },
    );
  }

  let body: { to?: string };
  try {
    body = (await request.json()) as { to?: string };
  } catch {
    return NextResponse.json(
      { success: false, error: "Corpo inválido (JSON)" },
      { status: 400 },
    );
  }

  const to = (body.to ?? "").trim().toLowerCase();
  if (!to || !EMAIL_OK.test(to)) {
    return NextResponse.json(
      { success: false, error: "Informe um e-mail válido para o teste." },
      { status: 400 },
    );
  }

  const user = await findUserById(session.sub);
  const triggeredBy =
    user?.displayName ?? user?.email ?? user?.username ?? session.sub;

  const result = await sendTestEmail({ to, triggeredBy });

  await logActivity(
    session.sub,
    "INTEGRATION_SMTP_TEST",
    { to, ok: result.ok, reason: result.reason ?? null },
    clientIp(request),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.reason ?? "Falha ao enviar e-mail de teste.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { sentTo: to, sentAt: new Date().toISOString() },
  });
}
