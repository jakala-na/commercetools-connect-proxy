import dotenv from 'dotenv';
dotenv.config();

import { createApiRoot } from '../client/create.client';
import { assertError, assertString } from '../utils/assert.utils';
import { buildSubscriptionKey, deleteProxySubscription } from './actions';

const SUBSCRIPTION_SUFFIX_KEY = 'SUBSCRIPTION_SUFFIX';

async function preUndeploy(): Promise<void> {
  const apiRoot = createApiRoot();
  const properties = new Map(Object.entries(process.env));
  const subscriptionSuffix = properties.get(SUBSCRIPTION_SUFFIX_KEY);
  assertString(subscriptionSuffix, SUBSCRIPTION_SUFFIX_KEY);
  const subscriptionKey = buildSubscriptionKey(subscriptionSuffix);
  await deleteProxySubscription(apiRoot, subscriptionKey);
}

async function run(): Promise<void> {
  try {
    await preUndeploy();
  } catch (error) {
    assertError(error);
    process.stderr.write(`Post-undeploy failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

run();
