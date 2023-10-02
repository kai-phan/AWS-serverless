export function handler(event: any) {
  console.log('event', event);
  return new Promise((resolve, reject) => {
    resolve({
      statusCode: 200,
      body: JSON.stringify({ message: 'Hello World!' }),
    });
  });
}