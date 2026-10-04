# Research decisions

- **Flask adapters**: Preserve the team's working backend and API. FastAPI
  migration was rejected by the user.
- **Stateless signed context**: Cloud instances cannot depend on one process's
  session dictionary. Read-only fixtures avoid storage provisioning; a signed,
  expiring reference binds the employee to the exact random CX session.
- **Standard CX webhook**: Use camelCase sessionInfo, fulfillmentInfo,
  fulfillmentResponse, and payload per Google's
  [request](https://cloud.google.com/dialogflow/cx/docs/reference/rest/v3/WebhookRequest)
  and [response](https://cloud.google.com/dialogflow/cx/docs/reference/rest/v3/WebhookResponse)
  contracts.
- **SDK adapter**: Use regional SessionsClient, explicit deadline and retry=None;
  convert protobuf messages through MessageToDict. Source:
  [SessionsClient](https://cloud.google.com/python/docs/reference/dialogflow-cx/latest/google.cloud.dialogflowcx_v3.services.sessions.SessionsClient).
- **Public demo selection**: Fictional employee selection does not assert an
  authenticated identity. Real identity/storage integration is deferred.
- **No silent fallback**: Missing configuration and SDK failures return errors.
  Tests replace external calls, and live integration is explicitly unverified.
