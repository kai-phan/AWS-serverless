export const handler = ({ pathParameters }: any) => {
  const randomNumber = Math.floor(Math.random() * 6) + 1;

  return Promise.resolve({
    statusCode: 200,
    body: pathParameters.diceCount ? randomNumber * Number(pathParameters.diceCount) : randomNumber,
  });
}