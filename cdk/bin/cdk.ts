#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ImageUrlSigningServiceStack } from '../lib/image-url-signing-service-stack';

const app = new cdk.App();

const stack = 'targeting';
const stage = app.node.tryGetContext('stage') || 'CODE';

new ImageUrlSigningServiceStack(app, `ImageUrlSigningService-${stage}`, {
  stack,
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
});
