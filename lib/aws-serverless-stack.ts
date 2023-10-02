import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import  path from 'path';

export class AwsServerlessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const firstAPI = new cdk.aws_apigateway.RestApi(this, 'firstAPI', {});

    const diceResource = firstAPI.root.addResource('dice');

    const rollADiceLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'rollADice', {
      entry: path.join(__dirname, 'rollADice', 'index.ts'),
      handler: 'handler',
    });

    diceResource.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(rollADiceLambda));
    diceResource.addResource('{diceCount}').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(rollADiceLambda));
  }
}
