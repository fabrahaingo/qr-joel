import { app, APP_URL, PORT } from "./app.ts";

app.listen(PORT, () => {
  console.log(`📱 Try: ${APP_URL}`);
});

console.log(`QR: JOEL gateway started successfully \u{2705}`);
