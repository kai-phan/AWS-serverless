import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidV4 } from 'uuid';

const dbClient = new DynamoDBClient({});

export async function isItemInStock({ item }: any) {
  //Because it is a building block of the future state machine, the typing is simpler.
  // This function receives a single item composed of an itemId and a quantity.
  // It will check in the store DB if the item is in stock, and throw an error if it is not.
  const { itemId, quantity } = item;

  const { Item } = await dbClient.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: { S: 'StoreItem' },
      SK: { S: itemId },
    }
  }));

  const stock = Item?.stock?.N;

  if (!stock || parseInt(stock) < quantity) {
    throw new Error('Item not in stock');
  }
}

export async function updateItemInStock({ item }: any) {
  const { itemId, quantity } = item;

  await dbClient.send(new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: { S: 'StoreItem' },
      SK: { S: itemId },
    },
    UpdateExpression: 'SET stock = stock - :quantity',
    ExpressionAttributeValues: {
      ':quantity': { N: quantity.toString() },
    }
  }));
}

export async function createOrder({ order }: { order: { itemId: string, quantity: number }[] }) {
  await dbClient.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      PK: { S: 'Order' },
      SK: { S: uuidV4() },
      order: { L: order.map(({ itemId, quantity }) => {
        return {
          M: {
            itemId: { S: itemId },
            quantity: { N: quantity.toString() },
          }
        }
      })},
    }
  }));
}

export async function createStoreItem({ body }: any) {
  const { itemId, quantity } = JSON.parse(body);

  if (!itemId || !quantity) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
    });
  }

  await dbClient.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      PK: { S: 'StoreItem' },
      SK: { S: itemId },
      stock: { N: quantity.toString() },
    }
  }));

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'Store Item created' }),
  });
}