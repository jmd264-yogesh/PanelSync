/**
 * Public origin of the app, resolved at request time.
 *
 * NEXT_PUBLIC_* values are inlined by Next at build time, and .dockerignore
 * keeps .env* out of the build context, so NEXT_PUBLIC_APP_URL is baked into
 * the image as undefined. APP_URL is a plain server variable, so it is read
 * from the environment on every request and survives the Docker build.
 *
 * The request origin is only a last resort: behind the proxy it resolves to the
 * container bind address (0.0.0.0:3000), not the browser-facing host.
 */
export function getAppUrl(request?: Request): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (request ? new URL(request.url).origin : 'http://localhost:3000')
  );
}
