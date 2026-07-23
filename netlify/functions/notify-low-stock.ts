import { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { drugName, quantity } = JSON.parse(event.body || '{}');

    if (!drugName || quantity === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing drugName or quantity" }),
      };
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`[Email Stub] Low stock alert: ${drugName} dropped to ${quantity}.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, stub: true }),
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"MedTrack Pro" <${process.env.SMTP_USER}>`,
      to: "olatokeoluwole@gmail.com",
      subject: `⚠️ Low Stock Alert: ${drugName}`,
      text: `The inventory for ${drugName} has dropped to ${quantity}. Please restock soon.`,
      html: `<h2>Low Stock Alert</h2><p>The inventory for <strong>${drugName}</strong> has dropped to <strong>${quantity}</strong>.</p><p>Please restock soon.</p>`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    console.error("Failed to send email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
