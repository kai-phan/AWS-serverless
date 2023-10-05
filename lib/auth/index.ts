import { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as process from 'process';

const client = new CognitoIdentityProviderClient({});

export async function signup({ body }: any) {
  const { email, password, username } = JSON.parse(body);

  if (!email || !password || !username) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
    });
  }

  await client.send(new SignUpCommand({
    ClientId: process.env.USER_POOL_CLIENT_ID,
    Password: password,
    Username: username,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      }
    ]
  }));

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'Signup successful' }),
  });
}

export async function confirm({ body }: any) {
  const { username, code } = JSON.parse(body);

  if (!username || !code) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
    });
  }

  await client.send(new ConfirmSignUpCommand({
    ClientId: process.env.USER_POOL_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
  }));

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'Confirm successful' }),
  });
}

export async function signin({ body }: any) {
  const { username, password } = JSON.parse(body);

  if (!username || !password) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
    });
  }

  const res = await client.send(new InitiateAuthCommand({
    ClientId: process.env.USER_POOL_CLIENT_ID,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    }
  }));

  const idToken = res.AuthenticationResult?.IdToken;

  if (!idToken) {
    return Promise.resolve({
      statusCode: 401,
      body: JSON.stringify({ message: 'Invalid credentials' }),
    });
  }

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ idToken }),
  });
}