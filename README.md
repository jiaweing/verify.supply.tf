# Supply.tf Item Verification System 🔒

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![DrizzleORM](https://img.shields.io/badge/Drizzle-000000?style=for-the-badge&logo=drizzle&logoColor=white)](https://orm.drizzle.team/)

A secure blockchain-backed verification system for item authenticity and ownership tracking. Leveraging NFC technology, encrypted verification links, and blockchain-based ownership history to ensure genuine items and seamless ownership transfers.

## 📋 Features

### 🛡️ Item Verification

- **NFC Integration**: Scan NFC tags for instant item verification
- **Two-Factor Authentication**: Email-based 2FA for secure access
- **Blockchain Verification**: Real-time verification against blockchain data
- **Ownership History**: Complete tracking of item ownership changes

### 👤 Admin Portal

- **Item Management**: Comprehensive item data entry and validation
- **NFC Management**: Secure link generation with dual-layer encryption
- **Blockchain Integration**: Direct access to blockchain data
- **Analytics Dashboard**: Track verification metrics and system usage

### 🔄 Ownership Management

- **Secure Transfers**: Protected transfer initiation process
- **Email Verification**: Dual-party confirmation via email
- **Time-Limited Requests**: Auto-expiring transfer requests
- **Audit Trail**: Detailed history of all ownership changes

## 🛠️ Tech Stack

### Frontend

- **Next.js 14**: App Router for modern routing
- **TypeScript**: Type-safe development
- **ShadCN/UI**: Professional UI components
- **TailwindCSS**: Utility-first CSS

### Backend

- **Drizzle ORM**: Type-safe database operations
- **PostgreSQL**: Reliable data storage
- **JWT**: Secure authentication
- **AES-256**: Military-grade encryption

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm

### Installation

1. **Clone & Setup**

   ```bash
   git clone https://github.com/yourusername/verify.supply.tf.git
   cd verify.supply.tf
   pnpm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Configure your .env file with required values
   ```

3. **Database Setup**

   ```bash
   # Create database
   createdb supply

   # Generate and apply migrations
   pnpm db:generate
   pnpm db:push

   # Create initial admin user
   pnpm db:seed
   ```

4. **Development Server**
   ```bash
   pnpm dev
   ```
   Visit http://localhost:3000

## ⚙️ Configuration

### Required Environment Variables

| Variable               | Description               | Validation       | Example                                  |
| ---------------------- | ------------------------- | ---------------- | ---------------------------------------- |
| DATABASE_URL           | PostgreSQL connection URL | Valid URL        | postgresql://user:pass@localhost:5432/db |
| JWT_SECRET             | JWT signing secret        | Min 32 chars     | your-secure-jwt-secret-32-chars-long     |
| MASTER_KEY             | Global encryption key     | Min 32 chars     | your-encryption-key-32-chars-long        |
| SESSION_SECRET         | Session encryption key    | Min 32 chars     | your-session-secret-32-chars-long        |
| INITIAL_ADMIN_EMAIL    | Initial admin login email | Valid email      | admin@example.com                        |
| INITIAL_ADMIN_PASSWORD | Initial admin password    | Min 8 chars      | YourSecurePassword123                    |
| SMTP_HOST              | SMTP server host          | Required         | smtp.gmail.com                           |
| SMTP_PORT              | SMTP server port          | Positive integer | 587                                      |
| SMTP_USER              | SMTP username             | Required         | your-smtp-username                       |
| SMTP_PASSWORD          | SMTP password             | Required         | your-smtp-password                       |
| SMTP_FROM              | SMTP from address         | Valid email      | noreply@yourdomain.com                   |
| APP_URL                | Application URL           | Valid URL        | http://localhost:3000                    |

### Initial Admin Setup

During first-time setup, the system uses `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` to create the first admin user. You can run `pnpm db:seed` manually to create this user. After the initial setup, you can manage admin users through the admin interface.

## 🔐 Security Architecture

### Encryption System

1. **Item-Specific Layer**

   - Unique key per item
   - Regular key rotation
   - Encrypted metadata

2. **Global Layer**
   - Master key encryption
   - Monthly key rotation
   - Secure key storage

### NFC Implementation

```
verify.supply.tf/?key=<encrypted-data>&version=<key-version>
```

## 📝 API Documentation

### Admin Endpoints

| Endpoint              | Method | Description          |
| --------------------- | ------ | -------------------- |
| /api/auth/admin/login | POST   | Admin authentication |
| /api/items            | POST   | Create item          |
| /api/items            | GET    | List all items       |

### Verification Endpoints

| Endpoint               | Method | Description      |
| ---------------------- | ------ | ---------------- |
| /api/auth/request-code | POST   | Request 2FA code |
| /api/auth/verify-code  | POST   | Verify 2FA code  |
| /api/items/:id         | GET    | Item details     |

## 💾 Database Schema

### Admin Users Table

```sql
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Items Table

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY,
  sku VARCHAR NOT NULL,
  serial_number VARCHAR UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  blockchain_data JSONB,
  encryption_metadata JSONB
);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

Please ensure your PR:

- Follows the existing code style
- Includes relevant tests
- Updates documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔍 Screenshots

[Coming Soon]

## 📞 Support

For support, please create an issue in the GitHub repository or contact the maintainers.
