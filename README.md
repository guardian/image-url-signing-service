# Image URL Signing Service

Node/TypeScript/Express service for creating signed Gu image URLs.

## Local Development

Setup your local env:

```
$ bin/setup
```

Run the API locally:

It requires a AWS credential that have access to the S3 object storing the public settings of the pan-domain-authentication.  Many accounts such as workflow and targeting have the access.  You may need to set AWS_PROFILE environment to choose which profile to use before running it locally.

For example, if you want to use the profile "workflow" for the AWS credential, you may run:

```
$ AWS_PROFILE=workflow yarn dev
```

Run the tests:

```
$ yarn test
```
