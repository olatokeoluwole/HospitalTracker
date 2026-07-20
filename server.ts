import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Set up Nodemailer transporter
  // The user should configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  // For testing without creds, we'll just log
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // API Route to send notification
  app.post("/api/notify-low-stock", async (req, res) => {
    const { drugName, quantity } = req.body;

    if (!drugName || quantity === undefined) {
      return res.status(400).json({ error: "Missing drugName or quantity" });
    }

    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`[Email Stub] Low stock alert: ${drugName} dropped to ${quantity}.`);
        console.log(`[Email Stub] Please configure SMTP settings in .env to actually send emails.`);
        return res.json({ success: true, stub: true });
      }

      await transporter.sendMail({
        from: `"MedTrack Pro" <${process.env.SMTP_USER}>`,
        to: "olatokeoluwole@gmail.com",
        subject: `⚠️ Low Stock Alert: ${drugName}`,
        text: `The inventory for ${drugName} has dropped to ${quantity}. Please restock soon.`,
        html: `<h2>Low Stock Alert</h2><p>The inventory for <strong>${drugName}</strong> has dropped to <strong>${quantity}</strong>.</p><p>Please restock soon.</p>`,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
