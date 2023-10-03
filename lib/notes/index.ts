import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidV4 } from 'uuid';

const client = new DynamoDBClient({});

export async function createNote(event: any) {
  const { body, pathParameters } = event;
  const { userId } = pathParameters;
  const { content } = JSON.parse(body);

  if (!userId || !content) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'userId and content are required' }),
    });
  }

  const noteId = uuidV4();

  const res = await client.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      userId: { S: userId },
      noteId: { S: noteId },
      content: { S: content },
    }
  }));

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ noteId }),
  });
}

export async function getNote({ pathParameters }: any) {
  const { userId, id: noteId } = pathParameters;

  if (!userId || !noteId) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'userId and id are required' }),
    });
  }

  const res = await client.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      userId: { S: userId },
      noteId: { S: noteId },
    }
  }));

  if (!res.Item) {
    return Promise.resolve({
      statusCode: 404,
      body: JSON.stringify({ message: 'Note not found' }),
    });
  }

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify(res.Item),
  });
}

export async function getAllNotes({ pathParameters }: any) {
  const { userId } = pathParameters;

  if (!userId) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'userId is required' }),
    });
  }

  const res = await client.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': { S: userId },
    }
  }));

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify(res.Items),
  });
}