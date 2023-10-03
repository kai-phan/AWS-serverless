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

    const notesTable = new cdk.aws_dynamodb.Table(this, 'notesTable', {
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'noteId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      }
    });

    const createNoteLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'createNote', {
      entry: path.join(__dirname, 'notes', 'index.ts'),
      handler: 'createNote',
      //Importantly, we need to pass the notesTable to the Lambda function as an environment variable.
      environment: {
        TABLE_NAME: notesTable.tableName,
      }
    });

    const getNoteLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getNote', {
      entry: path.join(__dirname, 'notes', 'index.ts'),
      handler: 'getNote',
      environment: {
        TABLE_NAME: notesTable.tableName,
      }
    });

    const getAllNotesLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getAllNotes', {
      entry: path.join(__dirname, 'notes', 'index.ts'),
      handler: 'getAllNotes',
      environment: {
        TABLE_NAME: notesTable.tableName,
      }
    });

    notesTable.grantReadData(getNoteLambda);
    notesTable.grantWriteData(createNoteLambda);
    notesTable.grantReadData(getAllNotesLambda);

    const noteResources = firstAPI.root.addResource('notes').addResource('{userId}');

    noteResources.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(createNoteLambda));
    noteResources.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getAllNotesLambda));
    noteResources.addResource('{id}').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getNoteLambda));
  }
}
