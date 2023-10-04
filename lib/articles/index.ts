import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommandOutput, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

export async function updateArticle({ body, pathParameters }: any) {
  const { id } = pathParameters;
  const { title, content, author } = JSON.parse(body);

  if (!id) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'article id is missing' }),
    });
  }

  const item = { title, author };

  const expression = Object.keys(item).reduce((acc, key, index) => {
    let result = acc;

    if (item[key as keyof typeof item]) {
      result = `${acc}${index > 0 ? ', ' : ''}${key} = :${key}`;
    }

    return result;
  }, 'SET ');

  const expressionAttributeValues = Object.keys(item).reduce((acc, key) => {
    let result = acc;
    if (item[key as keyof typeof item]) {
      result = {
        ...acc,
        [`:${key}`]: { S: item[key as keyof typeof item] },
      };
    }

    return result;
  }, {});

  if (Object.keys(expressionAttributeValues).length !== 0) {
    const { Attributes } = await dynamoDBClient.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: { S: 'article' },
        SK: { S: id },
      },
      UpdateExpression: expression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    if (!Attributes) {
      return Promise.resolve({
        statusCode: 500,
        body: JSON.stringify({ message: 'Article not found' }),
      });
    }
  }

  if (content) {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: id,
      Body: content,
    }));
  }

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'Article updated' }),
  });
}

export async function deleteArticle({ pathParameters }: any) {
  const { id } = pathParameters;

  if (!id) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'article id is missing' }),
    });
  }

  await Promise.all([
    dynamoDBClient.send(new DeleteItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: { S: 'article' },
        SK: { S: id },
      }
    })),
    s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: id,
    }))
  ]);

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'Article deleted' }),
  });
}