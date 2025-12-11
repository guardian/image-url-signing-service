# Image URL Signing Service CDK

This CDK application replaces the CloudFormation template for the image URL signing service.

## Migration from CloudFormation

This service has been migrated from CloudFormation (`cfn.yaml`) to CDK. The CDK stack provides:

- **Lambda Function**: Node.js function for signing i.guim.co.uk image URLs
- **API Gateway**: REST API with custom domain
- **IAM Roles**: Proper permissions for Lambda execution and S3 access
- **Custom Domain**: Stage-specific domain mapping
- **DNS Records**: Automated DNS setup using Guardian DNS constructs

## Architecture

- **Lambda Runtime**: Node.js 18.x
- **Memory**: 128MB
- **Timeout**: 60 seconds
- **Custom Domains**:
  - CODE: `image-url-signing-service.code.dev-gutools.co.uk`
  - PROD: `image-url-signing-service.gutools.co.uk`

## Deployment

Deploy using CDK instead of the old CloudFormation template:

```bash
cd cdk
npm install
npm run build
npm run synth
npm run deploy
```

The RiffRaff configuration should be updated to deploy CDK-generated templates instead of the old `cfn.yaml`.

## Development

```bash
cd cdk
npm install
npm run build
npm run synth
npm run diff
```
