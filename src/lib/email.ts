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

const companyName = "supply.tf";
const supportEmail = env.SMTP_FROM;

export type EmailType =
  | "verify"
  | "transfer-request"
  | "transfer-confirmed"
  | "transfer-completed"
  | "transfer-cancelled"
  | "transfer-declined";

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
    subject: "Accept Item Transfer",
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
The owner of the following item would like to transfer ownership to you:

Serial Number: ${itemDetails.serialNumber}
SKU: ${itemDetails.sku}

To accept this transfer and take ownership of the item, click the following link:
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
<h2>Accept Item Transfer</h2>
<p>The owner of the following item would like to transfer ownership to you:</p>
<div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0;">
  <p><strong>Serial Number:</strong> ${itemDetails.serialNumber}</p>
  <p><strong>SKU:</strong> ${itemDetails.sku}</p>
</div>
<p>To accept this transfer and take ownership of the item, click the following link:</p>
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
You have successfully taken ownership of the following item:

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
  "transfer-completed": {
    subject: "Item Transfer Complete",
    generateText: ({
      itemDetails,
      newOwnerName,
      newOwnerEmail,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      newOwnerName: string;
      newOwnerEmail: string;
    }) => `
The transfer of your item has been completed:

Serial Number: ${itemDetails.serialNumber}
SKU: ${itemDetails.sku}

New Owner: ${newOwnerName} (${newOwnerEmail})

For any questions, contact ${supportEmail}
    `,
    generateHtml: ({
      itemDetails,
      newOwnerName,
      newOwnerEmail,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      newOwnerName: string;
      newOwnerEmail: string;
    }) => `
<h2>Item Transfer Complete</h2>
<p>The transfer of your item has been completed:</p>
<div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0;">
  <p><strong>Serial Number:</strong> ${itemDetails.serialNumber}</p>
  <p><strong>SKU:</strong> ${itemDetails.sku}</p>
  <p><strong>New Owner:</strong> ${newOwnerName} (${newOwnerEmail})</p>
</div>
<p>For any questions, contact <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  },
  "transfer-cancelled": {
    subject: "Item Transfer Cancelled",
    generateText: ({
      itemDetails,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
    }) => `
The pending transfer for the following item has been cancelled by the owner:

Serial Number: ${itemDetails.serialNumber}
SKU: ${itemDetails.sku}

No further action is required.

For any questions, contact ${supportEmail}
    `,
    generateHtml: ({
      itemDetails,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
    }) => `
<h2>Item Transfer Cancelled</h2>
<p>The pending transfer for the following item has been cancelled by the owner:</p>
<div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0;">
  <p><strong>Serial Number:</strong> ${itemDetails.serialNumber}</p>
  <p><strong>SKU:</strong> ${itemDetails.sku}</p>
</div>
<p>No further action is required.</p>
<p>For any questions, contact <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  },
  "transfer-declined": {
    subject: "Item Transfer Declined",
    generateText: ({
      itemDetails,
      newOwnerEmail,
      newOwnerName,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      newOwnerEmail: string;
      newOwnerName: string;
    }) => `
The following transfer request has been declined by the recipient:

Serial Number: ${itemDetails.serialNumber}
SKU: ${itemDetails.sku}

Declined by: ${newOwnerName} (${newOwnerEmail})

No further action is required.

For any questions, contact ${supportEmail}
    `,
    generateHtml: ({
      itemDetails,
      newOwnerEmail,
      newOwnerName,
    }: {
      itemDetails: {
        serialNumber: string;
        sku: string;
      };
      newOwnerEmail: string;
      newOwnerName: string;
    }) => `
<h2>Item Transfer Declined</h2>
<p>The following transfer request has been declined by the recipient:</p>
<div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0;">
  <p><strong>Serial Number:</strong> ${itemDetails.serialNumber}</p>
  <p><strong>SKU:</strong> ${itemDetails.sku}</p>
  <p><strong>Declined by:</strong> ${newOwnerName} (${newOwnerEmail})</p>
</div>
<p>No further action is required.</p>
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

interface TransferCompletedEmailData {
  itemDetails: {
    serialNumber: string;
    sku: string;
  };
  newOwnerName: string;
  newOwnerEmail: string;
}

interface TransferCancelledEmailData {
  itemDetails: {
    serialNumber: string;
    sku: string;
  };
}

interface TransferDeclinedEmailData {
  itemDetails: {
    serialNumber: string;
    sku: string;
  };
  newOwnerEmail: string;
  newOwnerName: string;
}

type EmailData = {
  verify: VerifyEmailData;
  "transfer-request": TransferRequestEmailData;
  "transfer-confirmed": TransferConfirmedEmailData;
  "transfer-completed": TransferCompletedEmailData;
  "transfer-cancelled": TransferCancelledEmailData;
  "transfer-declined": TransferDeclinedEmailData;
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
