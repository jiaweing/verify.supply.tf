import { env } from "@/env.mjs";
import nodemailer from "nodemailer";

// Initialize nodemailer with SMTP settings from env
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

const companyName = "Supply Chain Verify";
const supportEmail = env.SMTP_FROM;

export type EmailType = "verify" | "transfer-request" | "transfer-confirmed";

interface EmailTemplate<T> {
  subject: string;
  generateText: (data: T) => string;
  generateHtml: (data: T) => string;
}

const templates: {
  [K in EmailType]: EmailTemplate<EmailData[K]>;
} = {
  verify: {
    subject: "Verify Your Item",
    generateText: ({ code }: { code: string }) => `
Your verification code for ${companyName} is: ${code}

This code will expire in 10 minutes.

If you did not request this code, please ignore this email.

For any questions, contact ${supportEmail}
    `,
    generateHtml: ({ code }: { code: string }) => `
<h2>Your Verification Code</h2>
<p>Your verification code for ${companyName} is:</p>
<h1 style="font-size: 32px; letter-spacing: 3px; font-family: monospace; background: #f0f0f0; padding: 12px; border-radius: 4px;">${code}</h1>
<p>This code will expire in 10 minutes.</p>
<p>If you did not request this code, please ignore this email.</p>
<p>For any questions, contact <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  },
  "transfer-request": {
    subject: "Item Transfer Request",
    generateText: ({
      newOwnerName,
      newOwnerEmail,
      itemDetails,
      confirmUrl,
    }: {
      newOwnerName: string;
      newOwnerEmail: string;
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      confirmUrl: string;
    }) => `
${newOwnerName} (${newOwnerEmail}) has requested to take ownership of your item:

Serial Number: ${itemDetails.serialNumber}
SKU: ${itemDetails.sku}

To confirm this transfer, click the following link:
${confirmUrl}

The transfer request will expire in 24 hours.

For any questions, contact ${supportEmail}
    `,
    generateHtml: ({
      newOwnerName,
      newOwnerEmail,
      itemDetails,
      confirmUrl,
    }: {
      newOwnerName: string;
      newOwnerEmail: string;
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      confirmUrl: string;
    }) => `
<h2>Item Transfer Request</h2>
<p>${newOwnerName} (${newOwnerEmail}) has requested to take ownership of your item:</p>
<div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0;">
  <p><strong>Serial Number:</strong> ${itemDetails.serialNumber}</p>
  <p><strong>SKU:</strong> ${itemDetails.sku}</p>
</div>
<p>To confirm this transfer, click the following link:</p>
<p><a href="${confirmUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Confirm Transfer</a></p>
<p>The transfer request will expire in 24 hours.</p>
<p>For any questions, contact <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  },
  "transfer-confirmed": {
    subject: "Item Transfer Confirmed",
    generateText: ({
      itemDetails,
      viewUrl,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      viewUrl: string;
    }) => `
Your have successfully taken ownership of the following item:

Serial Number: ${itemDetails.serialNumber}
SKU: ${itemDetails.sku}

To view your item details, click the following link:
${viewUrl}

For any questions, contact ${supportEmail}
    `,
    generateHtml: ({
      itemDetails,
      viewUrl,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      viewUrl: string;
    }) => `
<h2>Item Transfer Confirmed</h2>
<p>You have successfully taken ownership of the following item:</p>
<div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0;">
  <p><strong>Serial Number:</strong> ${itemDetails.serialNumber}</p>
  <p><strong>SKU:</strong> ${itemDetails.sku}</p>
</div>
<p>To view your item details, click the following link:</p>
<p><a href="${viewUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Item</a></p>
<p>For any questions, contact <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  },
};

interface VerifyEmailData {
  code: string;
}

interface TransferRequestEmailData {
  newOwnerName: string;
  newOwnerEmail: string;
  itemDetails: {
    serialNumber: string;
    sku: string;
  };
  confirmUrl: string;
}

interface TransferConfirmedEmailData {
  itemDetails: {
    serialNumber: string;
    sku: string;
  };
  viewUrl: string;
}

type EmailData = {
  verify: VerifyEmailData;
  "transfer-request": TransferRequestEmailData;
  "transfer-confirmed": TransferConfirmedEmailData;
};

export async function sendEmail<T extends EmailType>({
  to,
  type,
  data,
}: {
  to: string;
  type: T;
  data: EmailData[T];
}) {
  const template = templates[type];

  const info = await transporter.sendMail({
    from: {
      name: companyName,
      address: supportEmail,
    },
    to,
    subject: template.subject,
    text: template.generateText(data),
    html: template.generateHtml(data),
  });

  return info;
}
