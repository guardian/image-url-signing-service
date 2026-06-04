# Image URL Signing Service

Node/TypeScript/Express service for creating signed Gu image URLs.

## Local Development

Setup your local env:

```
$ bin/setup
```

Run the API locally:

It requires a AWS credential that have access to the S3 object storing the public settings of the pan-domain-authentication. Many accounts such as workflow and targeting have the access. You may need to set AWS_PROFILE environment to choose which profile to use before running it locally.

For example, if you want to use the profile "workflow" for the AWS credential, you may run:

```
$ AWS_PROFILE=workflow pnpm dev
```

Run the tests:

```
$ pnpm test
```

## Notes

In order for this to generate the signed URL a salt needs to be configured.

### AWS Secrets Manager (Production)

The service retrieves the salt from AWS Secrets Manager. You need to create a secret for each stage:

1. Go to [AWS Secrets Manager](https://eu-west-1.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-1)
2. Create a new secret with the following names per stage:
    - CODE: `image-url-signing-service-CODE/salt`
    - PROD: `image-url-signing-service-PROD/salt`
3. Set the secret value as a JSON object:
    ```json
    {
        "salt": "your-salt-value"
    }
    ```
4. The Lambda IAM role has permissions to read secrets matching `image-url-signing-service-*`

### Environment Variable (Local Development)

For local development, you can set the `SALT` environment variable as a fallback:

```
$ SALT=your-salt-value pnpm dev
```

The service will attempt to fetch from Secrets Manager first, and fall back to the environment variable if that fails.
