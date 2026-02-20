import {
  AzureServiceBusDestination,
  ChangeSubscription,
  Destination,
  GoogleCloudPubSubDestination,
  MessageSubscription,
} from '@commercetools/platform-sdk';
import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/declarations/src/generated/client/by-project-key-request-builder';
import { logger } from '../utils/logger.utils';

const EVENT_PROXY_SUBSCRIPTION_KEY_PREFIX = 'ct-event-proxy-subscription';

const DEFAULT_MESSAGE_SUBSCRIPTIONS: MessageSubscription[] = [
  {
    resourceTypeId: 'order',
    types: [
      'OrderCreated',
      'OrderStateChanged',
      'OrderPaymentStateChanged',
      'OrderShipmentStateChanged',
    ],
  },
];

const DEFAULT_CHANGE_SUBSCRIPTIONS: ChangeSubscription[] = [];

interface ParsedSubscriptionConfig {
  messageSubscriptions: MessageSubscription[];
  changeSubscriptions: ChangeSubscription[];
}

export function parseSubscriptionConfig(configJson?: string): ParsedSubscriptionConfig {
  if (!configJson || configJson.trim().length === 0) {
    logger.info('No SUBSCRIPTION_CONFIG provided, using default subscriptions');
    return {
      messageSubscriptions: DEFAULT_MESSAGE_SUBSCRIPTIONS,
      changeSubscriptions: DEFAULT_CHANGE_SUBSCRIPTIONS,
    };
  }

  const parsed = JSON.parse(configJson) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('SUBSCRIPTION_CONFIG must be a JSON object');
  }

  const config = parsed as {
    messages?: unknown;
    changes?: unknown;
  };

  if (config.messages !== undefined && !Array.isArray(config.messages)) {
    throw new Error('SUBSCRIPTION_CONFIG.messages must be a JSON array');
  }

  if (config.changes !== undefined && !Array.isArray(config.changes)) {
    throw new Error('SUBSCRIPTION_CONFIG.changes must be a JSON array');
  }

  const messageSubscriptions = (config.messages ?? DEFAULT_MESSAGE_SUBSCRIPTIONS) as MessageSubscription[];
  const changeSubscriptions = (config.changes ?? DEFAULT_CHANGE_SUBSCRIPTIONS) as ChangeSubscription[];

  logger.info(
    `Parsed SUBSCRIPTION_CONFIG with ${messageSubscriptions.length} message and ${changeSubscriptions.length} change configurations`
  );

  return {
    messageSubscriptions,
    changeSubscriptions,
  };
}

export function buildSubscriptionKey(suffix: string): string {
  const normalizedSuffix = suffix.trim();
  if (normalizedSuffix.length === 0) {
    throw new Error('SUBSCRIPTION_SUFFIX must not be empty');
  }
  return `${EVENT_PROXY_SUBSCRIPTION_KEY_PREFIX}-${normalizedSuffix}`;
}

export async function createGcpPubSubProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  subscriptionKey: string,
  topicName: string,
  projectId: string,
  messageSubscriptions: MessageSubscription[],
  changeSubscriptions: ChangeSubscription[]
): Promise<void> {
  const destination: GoogleCloudPubSubDestination = {
    type: 'GoogleCloudPubSub',
    topic: topicName,
    projectId,
  };
  await createSubscription(
    apiRoot,
    subscriptionKey,
    destination,
    messageSubscriptions,
    changeSubscriptions
  );
}

export async function createAzureServiceBusProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  subscriptionKey: string,
  connectionString: string,
  messageSubscriptions: MessageSubscription[],
  changeSubscriptions: ChangeSubscription[]
): Promise<void> {
  const destination: AzureServiceBusDestination = {
    type: 'AzureServiceBus',
    connectionString: connectionString,
  };
  await createSubscription(
    apiRoot,
    subscriptionKey,
    destination,
    messageSubscriptions,
    changeSubscriptions
  );
}

async function createSubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  subscriptionKey: string,
  destination: Destination,
  messageSubscriptions: MessageSubscription[],
  changeSubscriptions: ChangeSubscription[]
) {
  await deleteProxySubscription(apiRoot, subscriptionKey);

  logger.info(
    `Creating subscription with ${messageSubscriptions.length} message and ${changeSubscriptions.length} change configurations`
  );

  await apiRoot
    .subscriptions()
    .post({
      body: {
        key: subscriptionKey,
        destination,
        messages: messageSubscriptions.length > 0 ? messageSubscriptions : undefined,
        changes: changeSubscriptions.length > 0 ? changeSubscriptions : undefined,
      },
    })
    .execute();

  logger.info('Subscription created successfully');
}

export async function deleteProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  subscriptionKey: string
): Promise<void> {
  const {
    body: { results: subscriptions },
  } = await apiRoot
    .subscriptions()
    .get({
      queryArgs: {
        where: `key = "${subscriptionKey}"`,
      },
    })
    .execute();

  if (subscriptions.length > 0) {
    const subscription = subscriptions[0];
    logger.info(`Deleting existing subscription: ${subscriptionKey}`);

    await apiRoot
      .subscriptions()
      .withKey({ key: subscriptionKey })
      .delete({
        queryArgs: {
          version: subscription.version,
        },
      })
      .execute();
  }
}
