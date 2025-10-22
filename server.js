import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import fs from "fs";

const app = express();
app.use(express.json());

// Load service account (downloaded from Firebase)
// const serviceAccount = JSON.parse(fs.readFileSync("firebase-key.json", "utf8"));
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  };

  const jwtToken = jwt.sign(payload, serviceAccount.private_key, { algorithm: "RS256" });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken
    })
  });

  const data = await res.json();
  return data.access_token;
}

app.post("/send", async (req, res) => {
  const { token, title, body } = req.body;
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body }
          }
        })
      }
    );

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
