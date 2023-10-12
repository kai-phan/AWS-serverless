import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import  path from 'path';
import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions'

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

    /** AWS step function */
    // provision a new DynamoDB
    const storeDB = new cdk.aws_dynamodb.Table(this, 'storeDB', {
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

    // provision a new Lambda function and grant it access to storeBD
    const isItemInStockLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'isItemInStock', {
      entry: path.join(__dirname, 'stocks', 'index.ts'),
      handler: 'isItemInStock',
      environment: {
        TABLE_NAME: storeDB.tableName,
      }
    });
    storeDB.grantReadData(isItemInStockLambda);

    const updateItemInStockLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'updateItemInStock', {
      entry: path.join(__dirname, 'stocks', 'index.ts'),
      handler: 'updateItemInStock',
      environment: {
        TABLE_NAME: storeDB.tableName,
      }
    });
    storeDB.grantWriteData(updateItemInStockLambda);

    const createOrderLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'createOrder', {
      entry: path.join(__dirname, 'stocks', 'index.ts'),
      handler: 'createOrder',
      environment: {
        TABLE_NAME: storeDB.tableName,
      }
    });
    storeDB.grantWriteData(createOrderLambda);

    const createStoreItem = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'createStoreItem', {
      entry: path.join(__dirname, 'stocks', 'index.ts'),
      handler: 'createStoreItem',
      environment: {
        TABLE_NAME: storeDB.tableName,
      }
    });
    storeDB.grantWriteData(createStoreItem);

    const createStoreItemResource = firstAPI.root.addResource('create-store-item');
    createStoreItemResource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(createStoreItem));

    /* Create state tasks run the Lambda functions */
    const isItemInStockMappedTask = new cdk.aws_stepfunctions.Map(this, 'isItemInStockMappedTask', {
      itemsPath: '$.order',
      resultPath: JsonPath.DISCARD,
      parameters: {
        'item.$': '$$.Map.Item.Value',
      }
    }).iterator(new cdk.aws_stepfunctions_tasks.LambdaInvoke(this, 'isItemInStockTask', {
      lambdaFunction: isItemInStockLambda,
    }));

    const updateItemInStockMappedTask = new cdk.aws_stepfunctions.Map(this, 'updateItemInStockMappedTask', {
      itemsPath: '$.order',
      resultPath: JsonPath.DISCARD,
      parameters: {
        'item.$': '$$.Map.Item.Value',
      }
    }).iterator(new cdk.aws_stepfunctions_tasks.LambdaInvoke(this, 'updateItemInStockTask', {
      lambdaFunction: updateItemInStockLambda,
    }));

    const createOrderTask = new cdk.aws_stepfunctions_tasks.LambdaInvoke(this, 'createOrderTask', {
      lambdaFunction: createOrderLambda,
    });

    /* Create state machine orchestrate tasks */
    const parallelState = new cdk.aws_stepfunctions.Parallel(this, 'parallelState');
    parallelState.branch(createOrderTask, updateItemInStockMappedTask);

    const definition = isItemInStockMappedTask.next(parallelState);

    const myFirstStateMachine = new cdk.aws_stepfunctions.StateMachine(this, 'myFirstStateMachine', {
      definitionBody: cdk.aws_stepfunctions.DefinitionBody.fromChainable(definition),
    });

    /* Create IAM role to execute the state machine */

    // First, by setting a "principal", I define that the role will be assumed by an API.
    // Then, I add a policy allowing the API to start the execution of the state machine,
    // and I specify the state machine ARN, to narrow the scope of the policy only to this state machine.
    const invokeStateMachineRole = new cdk.aws_iam.Role(this, 'invokeStateMachineRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    invokeStateMachineRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [myFirstStateMachine.stateMachineArn]
    }));

    /* Create API Gateway to trigger state machine */
    const createOrderResource = firstAPI.root.addResource('create-order');
    createOrderResource.addMethod('POST', new cdk.aws_apigateway.Integration({
      integrationHttpMethod: 'POST',
      // The type of the API Gateway integration is AWS, which means that it will call an AWS service.
      type: cdk.aws_apigateway.IntegrationType.AWS,
      // The URI of the API Gateway integration is the ARN of the StartExecution action of the Step Functions API.
      uri: `arn:aws:apigateway:${cdk.Aws.REGION}:states:action/StartExecution`,
      options: {
        // The credentialsRole property is the IAM role that will be assumed by API Gateway to call the Step Functions API.
        credentialsRole: invokeStateMachineRole,
        requestTemplates: {
          // The requestTemplates property is the template that will be used to format the request to the Step Functions API.
          // In this case, I am passing the entire request body as input to the state machine.
          // The input is a JSON object with a single property, order, which is the array of items to be ordered.
          // The $util.escapeJavascript() function is used to escape the JSON string. example of the request body:
          // {
          //   "order": [
          //     {
          //       "itemId": "item-1",
          //       "quantity": 1
          //     },
          //     {
          //       "itemId": "item-2",
          //       "quantity": 2
          //     }
          //   ]
          // }
          // The $input.json('$') expression is used to access the entire request body.
          'application/json': `{ 
            "input": "{\\"order\\": $util.escapeJavaScript($input.json('$'))}", 
            "stateMachineArn": "${myFirstStateMachine.stateMachineArn}"
           }`,
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "statusCode": 200,
                "data": {
                  "body": $input.body
                }
              }`
            }
          }
        ],
      },
    }),{
      //  I specify the response of the API.
      //  Here, I simply return a 200 status code.
      //  This response has to match with one of the responses defined in the integrationResponses,
      //  or the API will return a 500 status code.
      methodResponses: [
        {
          statusCode: '200',
        }
      ]
    })
  }
}
