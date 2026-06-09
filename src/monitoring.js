let sentryClient = null;

export async function initializeMonitoring() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) return null;

  try {
    const [Sentry, { BrowserTracing }] = await Promise.all([
      import('@sentry/react'),
      import('@sentry/tracing'),
    ]);

    Sentry.init({
      dsn,
      integrations: [new BrowserTracing()],
      tracesSampleRate: Number(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || 0.2),
      environment: process.env.NODE_ENV || 'development',
      release: process.env.REACT_APP_SENTRY_RELEASE || 'catchup-platform@local',
      normalizeDepth: 5,
      beforeSend(event) {
        if (event?.request?.headers) delete event.request.headers;
        return event;
      },
    });

    sentryClient = Sentry;
    return Sentry;
  } catch (err) {
    console.warn('Sentry initialization skipped:', err);
    return null;
  }
}

export function capturePlatformException(error, context = {}) {
  if (sentryClient?.captureException) {
    sentryClient.captureException(error, { extra: context });
  }
}
