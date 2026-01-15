import {
  AzureServiceBusDestination,
  Destination,
  GoogleCloudPubSubDestination,
  MessageSubscription,
} from '@commercetools/platform-sdk';
import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/declarations/src/generated/client/by-project-key-request-builder';
import { logger } from '../utils/logger.utils';

const EVENT_PROXY_SUBSCRIPTION_KEY = 'ct-event-proxy-subscription';

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

export function parseSubscriptionConfig(
  configJson?: string
): MessageSubscription[] {
  if (!configJson) {
    logger.info('No SUBSCRIPTION_CONFIG provided, using default Order subscriptions');
    return DEFAULT_MESSAGE_SUBSCRIPTIONS;
  }
  try {
    const parsed = JSON.parse(configJson);
    if (!Array.isArray(parsed)) {
      throw new Error('SUBSCRIPTION_CONFIG must be a JSON array');
    }
    logger.info(`Parsed ${parsed.length} subscription configurations`);
    return parsed as MessageSubscription[];
  } catch (error) {
    logger.warn(`Failed to parse SUBSCRIPTION_CONFIG: ${error}. Using defaults.`);
    return DEFAULT_MESSAGE_SUBSCRIPTIONS;
  }
}

export async function createGcpPubSubProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  topicName: string,
  projectId: string,
  messageSubscriptions: MessageSubscription[]
): Promise<void> {
  const destination: GoogleCloudPubSubDestination = {
    type: 'GoogleCloudPubSub',
    topic: topicName,
    projectId,
  };
  await createSubscription(apiRoot, destination, messageSubscriptions);
}

export async function createAzureServiceBusProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  connectionString: string,
  messageSubscriptions: MessageSubscription[]
): Promise<void> {
  const destination: AzureServiceBusDestination = {
    type: 'AzureServiceBus',
    connectionString: connectionString,
  };
  await createSubscription(apiRoot, destination, messageSubscriptions);
}

async function createSubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  destination: Destination,
  messageSubscriptions: MessageSubscription[]
) {
  await deleteProxySubscription(apiRoot);

  logger.info(`Creating subscription with ${messageSubscriptions.length} message configurations`);

  await apiRoot
    .subscriptions()
    .post({
      body: {
        key: EVENT_PROXY_SUBSCRIPTION_KEY,
        destination,
        messages: messageSubscriptions,
      },
    })
    .execute();

  logger.info('Subscription created successfully');
}

export async function deleteProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder
): Promise<void> {
  const {
    body: { results: subscriptions },
  } = await apiRoot
    .subscriptions()
    .get({
      queryArgs: {
        where: `key = "${EVENT_PROXY_SUBSCRIPTION_KEY}"`,
      },
    })
    .execute();

  if (subscriptions.length > 0) {
    const subscription = subscriptions[0];
    logger.info(`Deleting existing subscription: ${EVENT_PROXY_SUBSCRIPTION_KEY}`);

    await apiRoot
      .subscriptions()
      .withKey({ key: EVENT_PROXY_SUBSCRIPTION_KEY })
      .delete({
        queryArgs: {
          version: subscription.version,
        },
      })
      .execute();
  }
}
