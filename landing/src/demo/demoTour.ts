import type { DiffFile, ReviewTour } from '@review-tour/schema';

const verifySignatureFile: DiffFile = {
  id: 'file-verify-signature',
  path: 'src/server/webhooks/verifySignature.ts',
  status: 'added',
  language: 'typescript',
  additions: 29,
  deletions: 0,
  hunks: [
    {
      id: 'hunk-verify-signature-1',
      fileId: 'file-verify-signature',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 29,
      header: '@@ -0,0 +1,29 @@',
      patchHash: 'demo-verify-signature-1',
      lines: [
        {
          type: 'add',
          newLine: 1,
          content: "import { createHmac, timingSafeEqual } from 'node:crypto';",
        },
        { type: 'add', newLine: 2, content: '' },
        { type: 'add', newLine: 3, content: 'const TOLERANCE_SECONDS = 300;' },
        { type: 'add', newLine: 4, content: '' },
        { type: 'add', newLine: 5, content: 'export type SignatureCheck =' },
        { type: 'add', newLine: 6, content: '  | { ok: true }' },
        {
          type: 'add',
          newLine: 7,
          content:
            "  | { ok: false; reason: 'missing-header' | 'stale-timestamp' | 'bad-signature' };",
        },
        { type: 'add', newLine: 8, content: '' },
        { type: 'add', newLine: 9, content: 'export function verifyStripeSignature(' },
        { type: 'add', newLine: 10, content: '  payload: string,' },
        { type: 'add', newLine: 11, content: '  header: string | undefined,' },
        { type: 'add', newLine: 12, content: '  secret: string,' },
        { type: 'add', newLine: 13, content: '  nowMs = Date.now(),' },
        { type: 'add', newLine: 14, content: '): SignatureCheck {' },
        {
          type: 'add',
          newLine: 15,
          content: "  if (!header) return { ok: false, reason: 'missing-header' };",
        },
        { type: 'add', newLine: 16, content: '' },
        {
          type: 'add',
          newLine: 17,
          content: '  const { timestamp, signature } = parseSignatureHeader(header);',
        },
        {
          type: 'add',
          newLine: 18,
          content: '  if (Math.abs(nowMs / 1000 - timestamp) > TOLERANCE_SECONDS) {',
        },
        {
          type: 'add',
          newLine: 19,
          content: "    return { ok: false, reason: 'stale-timestamp' };",
        },
        { type: 'add', newLine: 20, content: '  }' },
        { type: 'add', newLine: 21, content: '' },
        {
          type: 'add',
          newLine: 22,
          content:
            "  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest();",
        },
        {
          type: 'add',
          newLine: 23,
          content: "  const received = Buffer.from(signature, 'hex');",
        },
        {
          type: 'add',
          newLine: 24,
          content:
            '  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {',
        },
        {
          type: 'add',
          newLine: 25,
          content: "    return { ok: false, reason: 'bad-signature' };",
        },
        { type: 'add', newLine: 26, content: '  }' },
        { type: 'add', newLine: 27, content: '' },
        { type: 'add', newLine: 28, content: '  return { ok: true };' },
        { type: 'add', newLine: 29, content: '}' },
      ],
    },
  ],
};

const stripeHandlerFile: DiffFile = {
  id: 'file-stripe-handler',
  path: 'src/server/webhooks/stripe.ts',
  status: 'modified',
  language: 'typescript',
  additions: 14,
  deletions: 1,
  hunks: [
    {
      id: 'hunk-stripe-handler-imports',
      fileId: 'file-stripe-handler',
      oldStart: 1,
      oldLines: 4,
      newStart: 1,
      newLines: 5,
      header: '@@ -1,4 +1,5 @@',
      patchHash: 'demo-stripe-handler-imports',
      lines: [
        {
          type: 'context',
          oldLine: 1,
          newLine: 1,
          content: "import { logger } from '../../lib/logger';",
        },
        {
          type: 'add',
          newLine: 2,
          content: "import { verifyStripeSignature } from './verifySignature';",
        },
        {
          type: 'context',
          oldLine: 2,
          newLine: 3,
          content: "import { env } from '../../config/env';",
        },
        {
          type: 'context',
          oldLine: 3,
          newLine: 4,
          content: "import { processStripeEvent } from './processEvent';",
        },
        { type: 'context', oldLine: 4, newLine: 5, content: '' },
      ],
    },
    {
      id: 'hunk-stripe-handler-verify',
      fileId: 'file-stripe-handler',
      oldStart: 12,
      oldLines: 6,
      newStart: 13,
      newLines: 18,
      header: '@@ -12,6 +13,18 @@',
      patchHash: 'demo-stripe-handler-verify',
      lines: [
        {
          type: 'context',
          oldLine: 12,
          newLine: 13,
          content: 'export async function handleStripeWebhook(req: Request): Promise<Response> {',
        },
        {
          type: 'delete',
          oldLine: 13,
          content: '  const event = JSON.parse(await req.text()) as StripeEvent;',
        },
        { type: 'add', newLine: 14, content: '  const payload = await req.text();' },
        { type: 'add', newLine: 15, content: '  const check = verifyStripeSignature(' },
        { type: 'add', newLine: 16, content: '    payload,' },
        {
          type: 'add',
          newLine: 17,
          content: "    req.headers.get('stripe-signature') ?? undefined,",
        },
        { type: 'add', newLine: 18, content: '    env.STRIPE_WEBHOOK_SECRET,' },
        { type: 'add', newLine: 19, content: '  );' },
        { type: 'add', newLine: 20, content: '' },
        { type: 'add', newLine: 21, content: '  if (!check.ok) {' },
        {
          type: 'add',
          newLine: 22,
          content: "    logger.warn('stripe webhook rejected', { reason: check.reason });",
        },
        {
          type: 'add',
          newLine: 23,
          content: "    return new Response('invalid signature', { status: 400 });",
        },
        { type: 'add', newLine: 24, content: '  }' },
        { type: 'add', newLine: 25, content: '' },
        {
          type: 'add',
          newLine: 26,
          content: '  const event = JSON.parse(payload) as StripeEvent;',
        },
        { type: 'context', oldLine: 14, newLine: 27, content: '' },
        {
          type: 'context',
          oldLine: 15,
          newLine: 28,
          content: '  await processStripeEvent(event);',
        },
        {
          type: 'context',
          oldLine: 16,
          newLine: 29,
          content: "  return new Response('ok', { status: 200 });",
        },
        { type: 'context', oldLine: 17, newLine: 30, content: '}' },
      ],
    },
  ],
};

const processEventFile: DiffFile = {
  id: 'file-process-event',
  path: 'src/server/webhooks/processEvent.ts',
  status: 'modified',
  language: 'typescript',
  additions: 9,
  deletions: 1,
  hunks: [
    {
      id: 'hunk-process-event-imports',
      fileId: 'file-process-event',
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 5,
      header: '@@ -1,3 +1,5 @@',
      patchHash: 'demo-process-event-imports',
      lines: [
        {
          type: 'context',
          oldLine: 1,
          newLine: 1,
          content: "import { logger } from '../../lib/logger';",
        },
        {
          type: 'add',
          newLine: 2,
          content: "import { withRetry } from '../../lib/queue/retry';",
        },
        { type: 'add', newLine: 3, content: "import { eventStore } from './eventStore';" },
        {
          type: 'context',
          oldLine: 2,
          newLine: 4,
          content: "import type { StripeEvent } from './types';",
        },
        { type: 'context', oldLine: 3, newLine: 5, content: '' },
      ],
    },
    {
      id: 'hunk-process-event-idempotency',
      fileId: 'file-process-event',
      oldStart: 8,
      oldLines: 9,
      newStart: 8,
      newLines: 15,
      header: '@@ -8,9 +8,15 @@',
      patchHash: 'demo-process-event-idempotency',
      lines: [
        {
          type: 'context',
          oldLine: 8,
          newLine: 8,
          content: 'export async function processStripeEvent(event: StripeEvent): Promise<void> {',
        },
        {
          type: 'context',
          oldLine: 9,
          newLine: 9,
          content: '  const handler = handlers[event.type];',
        },
        { type: 'context', oldLine: 10, newLine: 10, content: '  if (!handler) {' },
        {
          type: 'context',
          oldLine: 11,
          newLine: 11,
          content: "    logger.info('unhandled stripe event', { type: event.type });",
        },
        { type: 'context', oldLine: 12, newLine: 12, content: '    return;' },
        { type: 'context', oldLine: 13, newLine: 13, content: '  }' },
        { type: 'context', oldLine: 14, newLine: 14, content: '' },
        {
          type: 'add',
          newLine: 15,
          content: '  if (await eventStore.hasProcessed(event.id)) {',
        },
        {
          type: 'add',
          newLine: 16,
          content: "    logger.info('duplicate delivery skipped', { id: event.id });",
        },
        { type: 'add', newLine: 17, content: '    return;' },
        { type: 'add', newLine: 18, content: '  }' },
        { type: 'add', newLine: 19, content: '' },
        { type: 'delete', oldLine: 15, content: '  await handler(event);' },
        {
          type: 'add',
          newLine: 20,
          content: '  await withRetry(() => handler(event), { attempts: 3, backoffMs: 250 });',
        },
        {
          type: 'add',
          newLine: 21,
          content: '  await eventStore.markProcessed(event.id, { ttlHours: 72 });',
        },
        { type: 'context', oldLine: 16, newLine: 22, content: '}' },
      ],
    },
  ],
};

const webhookTestFile: DiffFile = {
  id: 'file-stripe-test',
  path: 'src/server/webhooks/stripe.test.ts',
  status: 'added',
  language: 'typescript',
  additions: 22,
  deletions: 0,
  hunks: [
    {
      id: 'hunk-stripe-test-1',
      fileId: 'file-stripe-test',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 22,
      header: '@@ -0,0 +1,22 @@',
      patchHash: 'demo-stripe-test-1',
      lines: [
        {
          type: 'add',
          newLine: 1,
          content: "import { describe, expect, it } from 'vitest';",
        },
        {
          type: 'add',
          newLine: 2,
          content: "import { verifyStripeSignature } from './verifySignature';",
        },
        { type: 'add', newLine: 3, content: '' },
        { type: 'add', newLine: 4, content: "const SECRET = 'whsec_test';" },
        { type: 'add', newLine: 5, content: '' },
        { type: 'add', newLine: 6, content: "describe('verifyStripeSignature', () => {" },
        {
          type: 'add',
          newLine: 7,
          content: "  it('rejects requests without a signature header', () => {",
        },
        {
          type: 'add',
          newLine: 8,
          content: "    const check = verifyStripeSignature('{}', undefined, SECRET);",
        },
        {
          type: 'add',
          newLine: 9,
          content: "    expect(check).toEqual({ ok: false, reason: 'missing-header' });",
        },
        { type: 'add', newLine: 10, content: '  });' },
        { type: 'add', newLine: 11, content: '' },
        {
          type: 'add',
          newLine: 12,
          content: "  it('rejects stale timestamps outside the tolerance window', () => {",
        },
        {
          type: 'add',
          newLine: 13,
          content: "    const header = signedHeader('{}', SECRET, Date.now() - 10 * 60 * 1000);",
        },
        {
          type: 'add',
          newLine: 14,
          content: "    const check = verifyStripeSignature('{}', header, SECRET);",
        },
        {
          type: 'add',
          newLine: 15,
          content: "    expect(check).toEqual({ ok: false, reason: 'stale-timestamp' });",
        },
        { type: 'add', newLine: 16, content: '  });' },
        { type: 'add', newLine: 17, content: '' },
        {
          type: 'add',
          newLine: 18,
          content: "  it('accepts a payload signed with the shared secret', () => {",
        },
        {
          type: 'add',
          newLine: 19,
          content: '    const header = signedHeader(\'{"id":"evt_1"}\', SECRET, Date.now());',
        },
        {
          type: 'add',
          newLine: 20,
          content:
            '    expect(verifyStripeSignature(\'{"id":"evt_1"}\', header, SECRET).ok).toBe(true);',
        },
        { type: 'add', newLine: 21, content: '  });' },
        { type: 'add', newLine: 22, content: '});' },
      ],
    },
  ],
};

const envFile: DiffFile = {
  id: 'file-env',
  path: 'src/config/env.ts',
  status: 'modified',
  language: 'typescript',
  additions: 1,
  deletions: 0,
  hunks: [
    {
      id: 'hunk-env-secret',
      fileId: 'file-env',
      oldStart: 4,
      oldLines: 5,
      newStart: 4,
      newLines: 6,
      header: '@@ -4,5 +4,6 @@',
      patchHash: 'demo-env-secret',
      lines: [
        { type: 'context', oldLine: 4, newLine: 4, content: 'export const env = createEnv({' },
        {
          type: 'context',
          oldLine: 5,
          newLine: 5,
          content: '  DATABASE_URL: required(),',
        },
        {
          type: 'context',
          oldLine: 6,
          newLine: 6,
          content: '  STRIPE_API_KEY: required(),',
        },
        {
          type: 'add',
          newLine: 7,
          content: '  STRIPE_WEBHOOK_SECRET: required({ redactInLogs: true }),',
        },
        { type: 'context', oldLine: 7, newLine: 8, content: '  SENTRY_DSN: optional(),' },
        { type: 'context', oldLine: 8, newLine: 9, content: '});' },
      ],
    },
  ],
};

export const demoTour: ReviewTour = {
  schemaVersion: 'review-tour/v1',
  id: 'demo-webhook-hardening',
  createdAt: '2026-07-04T09:00:00.000Z',
  generator: {
    name: 'review-tour',
    version: '0.1.0',
    mode: 'codex-skill',
  },
  repository: {
    root: '/Users/dev/code/acme/payments',
    name: 'acme/payments',
    currentBranch: 'feature/webhook-signatures',
    baseBranch: 'main',
    headSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    isDirty: false,
  },
  diff: {
    mode: 'base...head',
    stats: { filesChanged: 5, additions: 75, deletions: 2 },
    files: [verifySignatureFile, stripeHandlerFile, processEventFile, webhookTestFile, envFile],
  },
  tour: {
    title: 'Add Stripe webhook signature verification and idempotent processing',
    summary:
      'Hardens the webhook endpoint: requests are authenticated with HMAC signatures, event ' +
      'processing becomes idempotent with bounded retries, and the new behavior is locked in ' +
      'by tests.',
    chapters: [
      {
        id: 'chapter-verify',
        index: 1,
        title: 'Verify webhook signatures before trusting the payload',
        summary:
          'Every request is now authenticated with an HMAC signature and a timestamp ' +
          'tolerance window before the body is parsed. Unsigned or stale requests are ' +
          'rejected with a 400.',
        risk: 'high',
        rationale:
          'Authentication of inbound webhooks is the security boundary of this change; a flaw ' +
          'here lets an attacker forge payment events.',
        reviewQuestions: [
          'Is the signature comparison constant-time for all header shapes?',
          'Should a missing header return 400 or 401?',
          'Is a 5 minute tolerance window compatible with our retry policy?',
        ],
        hunkIds: [
          'hunk-verify-signature-1',
          'hunk-stripe-handler-imports',
          'hunk-stripe-handler-verify',
        ],
        files: [
          {
            path: 'src/server/webhooks/verifySignature.ts',
            hunkIds: ['hunk-verify-signature-1'],
          },
          {
            path: 'src/server/webhooks/stripe.ts',
            hunkIds: ['hunk-stripe-handler-imports', 'hunk-stripe-handler-verify'],
          },
        ],
      },
      {
        id: 'chapter-idempotency',
        index: 2,
        title: 'Make event processing idempotent with bounded retries',
        summary:
          'Stripe redelivers events, so processing now records handled event ids and skips ' +
          'duplicates. Handler failures retry three times with backoff before surfacing.',
        risk: 'medium',
        rationale:
          'Duplicate deliveries and handler failures decide whether payment events are ' +
          'double-processed or silently dropped.',
        reviewQuestions: [
          'Can markProcessed fail after the handler succeeded, and what happens on redelivery?',
          "Is the 72 hour TTL longer than Stripe's maximum retry window?",
        ],
        hunkIds: ['hunk-process-event-imports', 'hunk-process-event-idempotency'],
        files: [
          {
            path: 'src/server/webhooks/processEvent.ts',
            hunkIds: ['hunk-process-event-imports', 'hunk-process-event-idempotency'],
          },
        ],
      },
      {
        id: 'chapter-tests',
        index: 3,
        title: 'Lock it in: tests and configuration',
        summary:
          'The new verifier is covered for the missing-header, stale-timestamp, and happy ' +
          'paths, and the webhook secret becomes a required, log-redacted environment ' +
          'variable.',
        risk: 'low',
        rationale:
          'Coverage and configuration keep the new invariants from regressing after this PR ' +
          'merges.',
        reviewQuestions: [
          'Do the tests cover a tampered payload with a valid timestamp?',
          'Should STRIPE_WEBHOOK_SECRET rotate per environment?',
        ],
        hunkIds: ['hunk-stripe-test-1', 'hunk-env-secret'],
        files: [
          {
            path: 'src/server/webhooks/stripe.test.ts',
            hunkIds: ['hunk-stripe-test-1'],
          },
          {
            path: 'src/config/env.ts',
            hunkIds: ['hunk-env-secret'],
          },
        ],
      },
    ],
  },
  warnings: [],
};
