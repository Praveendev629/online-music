import app from "./api/index";

async function main() {
  const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine the test server port."));
        return;
      }
      fetch(`http://127.0.0.1:${address.port}/api/health`)
        .then(async (result) => {
          const body = await result.text();
          server.close();
          resolve({ status: result.status, body });
        })
        .catch((error) => {
          server.close();
          reject(error);
        });
    });
  });

  console.log(response);
  if (response.status !== 200 || !response.body.includes("soundwave-api")) {
    throw new Error("Vercel adapter health check failed.");
  }
}

void main();
