import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('ADMIN_ALERT_FROM_EMAIL') || 'CatchUp Alerts <alerts@catchup-platform.app>';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'Supabase service configuration is missing.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: alerts, error } = await supabase
    .from('admin_alerts')
    .select('*')
    .eq('delivery_status', 'pending')
    .eq('recipient_email', 'etchh0@gmail.com')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!alerts?.length) return json({ ok: true, sent: 0, skipped: 0 });

  let sent = 0;
  let skipped = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const alert of alerts) {
    if (!resendApiKey) {
      skipped += 1;
      await markAlert(supabase, alert, {
        delivery_status: 'skipped',
        last_delivery_error: 'RESEND_API_KEY is not configured.',
      });
      continue;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['etchh0@gmail.com'],
        subject: alert.subject,
        text: [
          alert.body,
          '',
          `Severity: ${alert.severity}`,
          `Event: ${alert.event_type}`,
          `Created: ${alert.created_at}`,
          '',
          'Open the CatchUp admin console for details.',
        ].join('\n'),
      }),
    });

    if (response.ok) {
      sent += 1;
      await markAlert(supabase, alert, {
        delivery_status: 'sent',
        sent_at: new Date().toISOString(),
        last_delivery_error: null,
      });
      continue;
    }

    const body = await response.text();
    failures.push({ id: alert.id, error: body });
    await markAlert(supabase, alert, {
      delivery_status: 'failed',
      last_delivery_error: body.slice(0, 500),
    });
  }

  return json({ ok: failures.length === 0, sent, skipped, failures }, failures.length ? 207 : 200);
});

async function markAlert(
  supabase: ReturnType<typeof createClient>,
  alert: { id: string; delivery_attempts?: number },
  updates: Record<string, unknown>,
) {
  await supabase
    .from('admin_alerts')
    .update({
      ...updates,
      delivery_attempts: Number(alert.delivery_attempts || 0) + 1,
    })
    .eq('id', alert.id);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
