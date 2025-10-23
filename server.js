import express from "express";
import admin from "firebase-admin";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = express();
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

// 🕒 Every 60s, check for due notifications
setInterval(async () => {
  const now = new Date();

  const snapshot = await db.collection("scheduled_notifications")
    .where("sent", "==", false)
    .where("cancelled", "==", false)
    .where("sendAt", "<=", now.toISOString())
    .get();

  snapshot.forEach(async (doc) => {
    const data = doc.data();

    const message = {
      token: data.token,
      notification: {
        title: data.title,
        body: data.body,
      },
      android: { priority: "high" },
    };

    try {
      await admin.messaging().send(message);
      await doc.ref.update({ sent: true });
      console.log("✅ Sent notification:", data.title);
    } catch (err) {
      console.error("❌ Error sending:", err);
    }
  });
}, 60000);

app.get("/", (req, res) => res.send("🌼 Notification Scheduler Running"));
app.listen(3000, () => console.log("🚀 Server listening on port 3000"));
