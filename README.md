# commercetools Connect Proxy

This project is a commercetools Connect-hosted event proxy for teams that already run their business logic outside Connect.

It creates and manages a commercetools Subscription (in `postDeploy`), receives events through the Connect-managed queue/topic delivery pipeline, and forwards each event to an external API (for example, a webhook receiver in Vercel).

## What This Is For

Use this connector when:

- your core logic lives in an existing monorepo or API outside commercetools Connect
- you still want commercetools events (`messages` and/or `changes`) delivered reliably
- you want Connect to host only the thin forwarding layer

The Express event app does not contain domain business logic. Its job is to transform and forward events.

## High-Level Flow

1. `postDeploy` creates/updates a commercetools Subscription that points to Connect-managed messaging infrastructure.
2. commercetools publishes matching events to that destination.
3. The Connect event app (`/event`) receives the queued message.
4. The app forwards the payload to `API_ENDPOINT` with HMAC headers.
5. The app response controls queue acknowledgement and retries.

## Retry and Acknowledgement Behavior

The proxy performs a single forward attempt per delivery attempt.

- Retryable downstream failures (`429`, `5xx`, transport/network failures) return non-2xx from the app, so Connect/GCP retries.
- Non-retryable downstream `4xx` responses are acknowledged to avoid retry storms.
- Incoming Pub/Sub HTTP envelopes are accepted up to 1 MB; larger requests return `413`.

This keeps retry ownership in the queue layer instead of in-process retry loops.

## Subscription Key Strategy

Each deployment must provide `SUBSCRIPTION_SUFFIX`.

The connector builds the final subscription key as:

`ct-event-proxy-subscription-<SUBSCRIPTION_SUFFIX>`

Why: this prevents multiple deployments in the same commercetools project from overwriting each other's subscription.

Example suffixes:

- `dev-a`
- `dev-b`
- `staging`
- `prod`

## Required commercetools Scope

For this proxy behavior, the API client only needs:

- `manage_subscriptions:{projectKey}`

## Configuration

Defined in `connect.yaml`.

Standard configuration:

- `CTP_REGION` (required)
- `API_ENDPOINT` (required): external webhook/API URL to receive forwarded events
- `SUBSCRIPTION_SUFFIX` (required): unique suffix per deployment in the same project
- `SUBSCRIPTION_CONFIG` (optional): JSON for `messages` and `changes` filters
- `ADDITIONAL_HEADERS` (optional): JSON headers appended to outbound webhook request

Secured configuration:

- `CTP_PROJECT_KEY` (required)
- `CTP_CLIENT_ID` (required)
- `CTP_CLIENT_SECRET` (required)
- `CTP_SCOPE` (required)
- `WEBHOOK_SECRET` (required): used for HMAC signature headers on forwarded requests

## Local Development (Event App)

From `event/`:

```bash
yarn install --frozen-lockfile
yarn build
yarn test
yarn start:dev
```

## Notes

- `postDeploy` creates/updates only this deployment's subscription key.
- `preUndeploy` deletes only this deployment's subscription key.
- If you deploy the connector more than once to the same project, always use different `SUBSCRIPTION_SUFFIX` values.
