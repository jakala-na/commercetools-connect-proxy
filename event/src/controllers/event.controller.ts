import { Request, Response } from 'express';
import crypto from 'crypto';
import CustomError from '../errors/custom.error';
import { logger } from '../utils/logger.utils';

const API_ENDPOINT = process.env.API_ENDPOINT;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const ADDITIONAL_HEADERS = process.env.ADDITIONAL_HEADERS;

function parseAdditionalHeaders(): Record<string, string> {
  if (!ADDITIONAL_HEADERS) {
    return {};
  }
  try {
    const parsed = JSON.parse(ADDITIONAL_HEADERS);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.warn('ADDITIONAL_HEADERS must be a JSON object, ignoring');
      return {};
    }
    return parsed as Record<string, string>;
  } catch (error) {
    logger.warn(`Failed to parse ADDITIONAL_HEADERS: ${error}`);
    return {};
  }
}

interface WebhookPayload {
  timestamp: string;
  notificationType: string;
  resourceTypeId: string;
  resourceId: string;
  messageType?: string;
  projectKey: string;
  data: unknown;
}

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

function generateWebhookHeaders(payload: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const signaturePayload = `${timestamp}.${payload}`;
  const signature = generateSignature(signaturePayload, WEBHOOK_SECRET!);
  const additionalHeaders = parseAdditionalHeaders();

  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Source': 'commercetools-event-proxy',
    ...additionalHeaders,
  };
}

async function forwardToExternalApi(payload: WebhookPayload): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const headers = generateWebhookHeaders(payloadString);

  try {
    const response = await fetch(API_ENDPOINT!, {
      method: 'POST',
      headers,
      body: payloadString,
    });

    if (!response.ok) {
      const status = response.status;

      if (status >= 500 || status === 429) {
        logger.error(`Retryable webhook delivery failure with status ${status}`);
        throw new CustomError(502, `External API returned retryable error: ${status}`);
      }

      logger.warn(
        `Non-retryable webhook delivery failure with status ${status}. Acknowledging message.`
      );
      return;
    }

    logger.info(`Event forwarded successfully to ${API_ENDPOINT}`);
    return;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    logger.error(`Failed to forward event: ${error}`);
    throw new CustomError(502, `Failed to forward event: ${error}`);
  }
}

export const post = async (request: Request, response: Response) => {
  if (!request.body) {
    logger.error('Missing request body.');
    throw new CustomError(400, 'Bad request: No Pub/Sub message was received');
  }

  if (!request.body.message) {
    logger.error('Missing body message');
    throw new CustomError(400, 'Bad request: Wrong Pub/Sub message format');
  }

  const pubSubMessage = request.body.message;

  const decodedData = pubSubMessage.data
    ? Buffer.from(pubSubMessage.data, 'base64').toString().trim()
    : undefined;

  if (!decodedData) {
    throw new CustomError(400, 'Bad request: Empty message data');
  }

  if (!API_ENDPOINT) {
    throw new CustomError(500, 'API_ENDPOINT is not configured');
  }
  if (!WEBHOOK_SECRET) {
    throw new CustomError(500, 'WEBHOOK_SECRET is not configured');
  }

  const jsonData = JSON.parse(decodedData);

  const webhookPayload: WebhookPayload = {
    timestamp: new Date().toISOString(),
    notificationType: jsonData.notificationType,
    resourceTypeId: jsonData.resource?.typeId || jsonData.resourceTypeId,
    resourceId: jsonData.resource?.id || jsonData.resourceId,
    messageType: jsonData.type,
    projectKey: jsonData.projectKey,
    data: jsonData,
  };

  await forwardToExternalApi(webhookPayload);

  response.status(200).send({ status: 'forwarded' });
};
