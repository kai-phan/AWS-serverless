export async function secret() {
  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'secret' }),
  });
}