import {
  AzureServiceBusDestination,
  ChangeSubscription,
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

const DEFAULT_CHANGE_SUBSCRIPTIONS: ChangeSubscription[] = [];

export function parseMessageSubscriptionConfig(
  configJson?: string
): MessageSubscription[] {
  if (!configJson) {
    logger.info('No MESSAGE_SUBSCRIPTION_CONFIG provided, using default Order subscriptions');
    return DEFAULT_MESSAGE_SUBSCRIPTIONS;
  }
  try {
    const parsed = JSON.parse(configJson);
    if (!Array.isArray(parsed)) {
      throw new Error('MESSAGE_SUBSCRIPTION_CONFIG must be a JSON array');
    }
    logger.info(`Parsed ${parsed.length} message subscription configurations`);
    return parsed as MessageSubscription[];
  } catch (error) {
    logger.warn(`Failed to parse MESSAGE_SUBSCRIPTION_CONFIG: ${error}. Using defaults.`);
    return DEFAULT_MESSAGE_SUBSCRIPTIONS;
  }
}

export function parseChangeSubscriptionConfig(
  configJson?: string
): ChangeSubscription[] {
  if (!configJson) {
    logger.info('No CHANGE_SUBSCRIPTION_CONFIG provided, no change subscriptions will be created');
    return DEFAULT_CHANGE_SUBSCRIPTIONS;
  }
  try {
    const parsed = JSON.parse(configJson);
    if (!Array.isArray(parsed)) {
      throw new Error('CHANGE_SUBSCRIPTION_CONFIG must be a JSON array');
    }
    logger.info(`Parsed ${parsed.length} change subscription configurations`);
    return parsed as ChangeSubscription[];
  } catch (error) {
    logger.warn(`Failed to parse CHANGE_SUBSCRIPTION_CONFIG: ${error}. Using defaults.`);
    return DEFAULT_CHANGE_SUBSCRIPTIONS;
  }
}

export async function createGcpPubSubProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
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
  await createSubscription(apiRoot, destination, messageSubscriptions, changeSubscriptions);
}

export async function createAzureServiceBusProxySubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  connectionString: string,
  messageSubscriptions: MessageSubscription[],
  changeSubscriptions: ChangeSubscription[]
): Promise<void> {
  const destination: AzureServiceBusDestination = {
    type: 'AzureServiceBus',
    connectionString: connectionString,
  };
  await createSubscription(apiRoot, destination, messageSubscriptions, changeSubscriptions);
}

async function createSubscription(
  apiRoot: ByProjectKeyRequestBuilder,
  destination: Destination,
  messageSubscriptions: MessageSubscription[],
  changeSubscriptions: ChangeSubscription[]
) {
  await deleteProxySubscription(apiRoot);

  logger.info(
    `Creating subscription with ${messageSubscriptions.length} message and ${changeSubscriptions.length} change configurations`
  );

  await apiRoot
    .subscriptions()
    .post({
      body: {
        key: EVENT_PROXY_SUBSCRIPTION_KEY,
        destination,
        messages: messageSubscriptions.length > 0 ? messageSubscriptions : undefined,
        changes: changeSubscriptions.length > 0 ? changeSubscriptions : undefined,
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
