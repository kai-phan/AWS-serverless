import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommandOutput, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const dynamoDBClient = new DynamoDBClient({});
const s3Client = new S3Client({});

export async function publishArticle({ body }:any) {
  const { title, content, author } = JSON.parse(body);

  if (!title || !content || !author) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
    });
  }

  const articleId = uuidv4();

  await dynamoDBClient.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      PK: { S: 'article' },
      SK: { S: articleId },
      title: { S: title },
      author: { S: author },
    }
  }));

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: articleId,
    Body: content,
  }));

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ articleId }),
  });
}

export async function getArticle({ pathParameters }: any) {
  const { id } = pathParameters;

  let result: GetObjectCommandOutput | undefined = undefined;

  try {
    result = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: id,
    }));
  } catch (e) {
    result = undefined
  }

  if (!result?.Body) {
    return Promise.resolve({
      statusCode: 404,
      body: JSON.stringify({ message: 'Article not found' }),
    });
  }

  const content = await result?.Body.transformToString();

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ content }),
  });
}

export async function listArticles() {
  const { Items} = await dynamoDBClient.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: 'article' },
    }
  }));

  if (!Items) {
    return Promise.resolve({
      statusCode: 500,
      body: JSON.stringify({ message: 'Articles not found' }),
    });
  }

  const results = Items.map((item) => {
    return {
      id: item.SK.S,
      title: item.title?.S,
      author: item.author?.S,
    }
  });

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ results }),
  });
}