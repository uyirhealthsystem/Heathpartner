import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Health Partner service running on port ${env.port}`);
});
