import express from "express";
import admin from "firebase-admin";
import { readFileSync } from "fs";

const app = express();
app.use(express.json());

// Load Firebase credentials
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY || readFileSync("./serviceAccountKey.json", "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Function to send notification
async function sendNotification(token, title, body) {
  const message = {
    notification: { title, body },
    token: token,
  };

  try {
    await admin.messaging().send(message);
    console.log(`✅ Sent notification to token: ${token.substring(0, 10)}...`);
  } catch (err) {
    console.error("❌ Error sending:", err);
  }
}

// Periodic check for pending notifications
setInterval(async () => {
  console.log("🔍 Checking for pending notifications...");
  const snapshot = await db.collection("scheduled_notifications_test").get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { token, deviceId, title, body, scheduledAt } = data;

    // Skip if not yet time
    if (scheduledAt && scheduledAt.toMillis() > Date.now()) continue;

    let finalToken = token;

    // 🔄 Try to get latest token from device_tokens if missing
    if (!finalToken && deviceId) {
      const tokenDoc = await db.collection("device_tokens").doc(deviceId).get();
      if (tokenDoc.exists) {
        finalToken = tokenDoc.data().token;
        console.log(`🔁 Fetched token for ${deviceId}`);
      } else {
        console.warn(`⚠️ No token found for deviceId: ${deviceId}`);
        continue;
      }
    }

    if (!finalToken) {
      console.warn("⚠️ Skipping notification: missing token");
      continue;
    }

    await sendNotification(finalToken, title || "Notification", body || "");
    await db.collection("scheduled_notifications_test").doc(doc.id).delete();
  }
}, 10000); // check every 10s

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
