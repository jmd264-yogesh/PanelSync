import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Global rate limiting: 1 request per 30 seconds across the entire server
let lastHealthCheckTime = 0;
const RATE_LIMIT_WINDOW_MS = 30 * 1000; // 30 seconds

interface HealthResponse {
  status: 'ok' | 'error';
  healthy: boolean;
  statusCode: number;
  statusText: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      latencyMs?: number;
      error?: string;
    };
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
  };
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  const timeSinceLast = now - lastHealthCheckTime;

  // Enforce 1 request per 30 seconds globally
  if (timeSinceLast < RATE_LIMIT_WINDOW_MS) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceLast) / 1000);
    return NextResponse.json(
      {
        status: 'error',
        healthy: false,
        statusCode: 429,
        statusText: 'Too Many Requests',
        message: `Rate limit exceeded. Only 1 request is allowed every 30 seconds. Please try again in ${retryAfterSeconds}s.`,
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  }

  // Update the last request timestamp
  lastHealthCheckTime = now;

  const searchParams = request.nextUrl.searchParams;
  const isShallow = searchParams.get('shallow') === 'true';
  const uptimeSeconds = Math.floor(process.uptime());
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;
  const services: HealthResponse['services'] = {
    database: {
      status: 'unhealthy',
    },
    memory: {
      heapUsedMb: toMb(mem.heapUsed),
      heapTotalMb: toMb(mem.heapTotal),
      rssMb: toMb(mem.rss),
    },
  };

  let isDatabaseHealthy = true;
  if (!isShallow) {
    const dbStartTime = Date.now();
    try {
      // 3-second timeout for DB check
      const queryPromise = dbClient.execute(sql`SELECT 1`);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timed out after 3000ms')), 3000)
      );
      await Promise.race([queryPromise, timeoutPromise]);
      services.database = {
        status: 'healthy',
        latencyMs: Date.now() - dbStartTime,
      };
    } catch (error: any) {
      isDatabaseHealthy = false;
      services.database = {
        status: 'unhealthy',
        latencyMs: Date.now() - dbStartTime,
        error: error?.message || 'Database connection error',
      };
    }
  } else {
    // When shallow check is requested, skip active DB ping
    services.database = {
      status: 'healthy',
    };
  }

  const statusCode = isDatabaseHealthy ? 200 : 503;
  const statusText = isDatabaseHealthy ? 'OK' : 'Service Unavailable';

  const responseBody: HealthResponse = {
    status: isDatabaseHealthy ? 'ok' : 'error',
    healthy: isDatabaseHealthy,
    statusCode,
    statusText,
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
    services,
  };

  return NextResponse.json(responseBody, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}