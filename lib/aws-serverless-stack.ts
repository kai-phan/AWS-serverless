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

    /**
     * Article API
     * */
    const articleBucket = new cdk.aws_s3.Bucket(this, 'articleBucket', {
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: cdk.aws_s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            }
          ],
        }
      ],
    });

    const articleTable = new cdk.aws_dynamodb.Table(this, 'articleTable', {
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'PK',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      }
    });

    const getArticleLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getArticle', {
      entry: path.join(__dirname, 'articles', 'index.ts'),
      handler: 'getArticle',
      environment: {
        BUCKET_NAME: articleBucket.bucketName,
      }
    });

    const listArticlesLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'listArticles', {
      entry: path.join(__dirname, 'articles', 'index.ts'),
      handler: 'listArticles',
      environment: {
        TABLE_NAME: articleTable.tableName,
      }
    });

    const publishArticleLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'publishArticle', {
      entry: path.join(__dirname, 'articles', 'index.ts'),
      handler: 'publishArticle',
      environment: {
        BUCKET_NAME: articleBucket.bucketName,
        TABLE_NAME: articleTable.tableName,
      }
    });

    const updateArticleLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'updateArticle', {
      entry: path.join(__dirname, 'articles', 'index.ts'),
      handler: 'updateArticle',
      environment: {
        TABLE_NAME: articleTable.tableName,
        BUCKET_NAME: articleBucket.bucketName,
      }
    });

    const deleteArticleLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'deleteArticle', {
      entry: path.join(__dirname, 'articles', 'index.ts'),
      handler: 'deleteArticle',
      environment: {
        TABLE_NAME: articleTable.tableName,
        BUCKET_NAME: articleBucket.bucketName,
      }
    });

    const articleResources = firstAPI.root.addResource('articles');

    articleResources.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(publishArticleLambda));
    articleResources.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(listArticlesLambda));

    const articleByIdResources = articleResources.addResource('{id}');

    articleByIdResources.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getArticleLambda));
    articleByIdResources.addMethod('PUT', new cdk.aws_apigateway.LambdaIntegration(updateArticleLambda));
    articleByIdResources.addMethod('DELETE', new cdk.aws_apigateway.LambdaIntegration(deleteArticleLambda));

    articleBucket.grantWrite(publishArticleLambda);
    articleTable.grantWriteData(publishArticleLambda);
    articleTable.grantReadData(listArticlesLambda);
    articleBucket.grantRead(getArticleLambda);
    articleTable.grantWriteData(updateArticleLambda);
    articleBucket.grantWrite(updateArticleLambda);
    articleTable.grantWriteData(deleteArticleLambda);
    articleBucket.grantWrite(deleteArticleLambda);

    /** AWS Cognito */
    const userPool = new cdk.aws_cognito.UserPool(this, 'firstUserPool', {
      selfSignUpEnabled: true,
      autoVerify: {
        // Allow user create account and receive verification code via email
        email: true,
      }
    });

    const userPoolClient = new cdk.aws_cognito.UserPoolClient(this, 'firstUserPoolClient', {
      userPool,
      authFlows: {
        // Allow user to sign in with email and password
        userPassword: true,
      }
    });

    const signupLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'signup', {
      entry: path.join(__dirname, 'auth', 'index.ts'),
      handler: 'signup',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      }
    });

    // Given signupLambda permission to signup user
    signupLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['cognito-idp:SignUp'],
      resources: [userPool.userPoolArn],
    }));

    const confirmLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'confirm', {
      entry: path.join(__dirname, 'auth', 'index.ts'),
      handler: 'confirm',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      }
    });

    // Given confirmLambda permission to confirm signup user
    confirmLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['cognito-idp:ConfirmSignUp'],
      resources: [userPool.userPoolArn],
    }));

    const signinLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'signin', {
      entry: path.join(__dirname, 'auth', 'index.ts'),
      handler: 'signin',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      }
    });

    // Given signinLambda permission to signin user
    signinLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['cognito-idp:InitiateAuth'],
      resources: [userPool.userPoolArn],
    }));

    const authResources = firstAPI.root.addResource('auth');

    authResources.addResource('signup').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(signupLambda));
    authResources.addResource('confirm').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(confirmLambda));
    authResources.addResource('signin').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(signinLambda));

    // Authorizer
    const authorizer = new cdk.aws_apigateway.CognitoUserPoolsAuthorizer(this, 'firstAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    const secretLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'secret', {
      entry: path.join(__dirname, 'protected', 'index.ts'),
      handler: 'secret',
    });

    firstAPI.root.addResource('secret').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(secretLambda), {
      authorizer,
      authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
    });

    /** Upload */
    const fileUpload = new cdk.aws_s3.Bucket(this, 'fileUpload', {
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: cdk.aws_s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            }
          ],
        }
      ],
    });

    const presignImageLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'presignImage', {
      entry: path.join(__dirname, 'upload', 'index.ts'),
      handler: 'presignImage',
      environment: {
        BUCKET_NAME: fileUpload.bucketName,
      }
    });

    fileUpload.grantWrite(presignImageLambda);

    const uploadResource = firstAPI.root.addResource('upload');

    uploadResource.addResource('presign').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(presignImageLambda));
  }
}
