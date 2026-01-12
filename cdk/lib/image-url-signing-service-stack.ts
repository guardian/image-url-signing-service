import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { GuStack, GuStackProps } from '@guardian/cdk/lib/constructs/core';

export interface ImageUrlSigningServiceStackProps extends GuStackProps {
  stack: string;
  stage: string;
}

export class ImageUrlSigningServiceStack extends GuStack {
  constructor(scope: Construct, id: string, props: ImageUrlSigningServiceStackProps) {
    super(scope, id, props);

    const { stack, stage } = props;

    // Domain mappings
    const domainNames: Record<string, string> = {
      CODE: 'image-url-signing-service.code.dev-gutools.co.uk',
      PROD: 'image-url-signing-service.gutools.co.uk',
    };

    const domainName = domainNames[stage];

    // TLS Certificate (already exists in us-east-1)
    const certificate = certificatemanager.Certificate.fromCertificateArn(
      this,
      'TLSCertificate',
      'arn:aws:acm:us-east-1:477621165360:certificate/781a1702-ca2e-4142-8acf-7ce23f52d106'
    );

    // IAM Role for Lambda
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        logs: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['arn:aws:logs:*:*:*'],
            }),
          ],
        }),
        lambda: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: ['*'],
            }),
          ],
        }),
        panda: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: ['arn:aws:s3:::pan-domain-auth-settings/*'],
            }),
          ],
        }),
      },
    });

    // Lambda Function
    const imageSigningApiLambda = new lambda.Function(this, 'ImageSigningApiLambda', {
      functionName: `image-url-signing-service-${stage}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromBucket(
        cdk.aws_s3.Bucket.fromBucketName(this, 'DeployBucket', 'targeting-dist'),
        `${stack}/${stage}/image-url-signing-service/image-url-signing-service.zip`
      ),
      description: 'Sign i.guim.co.uk image urls',
      memorySize: 128,
      timeout: cdk.Duration.seconds(60),
      role: executionRole,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'ImageSigningApi', {
      restApiName: `image-url-signing-service-${stage}`,
      description: 'API for signing i.guim.co.uk image urls',
      deployOptions: {
        stageName: stage,
      },
      domainName: {
        domainName: domainName,
        certificate: certificate,
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(imageSigningApiLambda, {
      proxy: true,
    });

    // Root resource method
    api.root.addMethod('ANY', lambdaIntegration);

    // Proxy resource for all paths
    const proxyResource = api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Usage Plan
    const usagePlan = api.addUsagePlan('ImageSigningApiUsagePlan', {
      name: 'image-url-signing-service',
      apiStages: [
        {
          api: api,
          stage: api.deploymentStage,
        },
      ],
    });

    // DNS Record (using Guardian DNS construct)
    // Note: This assumes the Guardian::DNS::RecordSet custom resource is available
    // If not available, you would need to use Route53 records or manual DNS setup
    new cdk.CfnResource(this, 'ImageSigningApiDNSRecord', {
      type: 'Guardian::DNS::RecordSet',
      properties: {
        Name: domainName,
        RecordType: 'CNAME',
        ResourceRecords: [api.domainName?.domainNameAliasDomainName || ''],
        Stage: stage,
        TTL: 3600,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'CustomDomainUrl', {
      value: `https://${domainName}`,
      description: 'Custom domain URL',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: imageSigningApiLambda.functionName,
      description: 'Name of the Lambda function',
    });
  }
}
