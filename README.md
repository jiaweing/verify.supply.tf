# Supply Chain Verification System

A Next.js-based web application for verifying the authenticity and tracking the ownership history of supply chain items using blockchain technology.

## Features

- **Item Verification**: Verify the authenticity of items using unique identifiers
- **Ownership History**: Track complete ownership history through blockchain transactions
- **Admin Dashboard**: Manage items, view transfers, and monitor system activity
- **Email Authentication**: Secure authentication system using email verification codes
- **User Sessions**: Temporary access sessions for item verification
- **Multi-Image Support**: Support for multiple item images (front/back, variations)

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Custom email-based auth system
- **Container**: Docker & Docker Compose
- **Security**: Encryption utilities for sensitive data
- **API**: REST endpoints with Next.js Route Handlers
- **State Management**: React Server Components + Client Hooks

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL
- Docker (optional)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Authentication
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="securepassword"

# Email (for verification codes)
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="user@example.com"
EMAIL_SERVER_PASSWORD="password"
EMAIL_FROM="noreply@example.com"

# Encryption
ENCRYPTION_KEY="32-char-key"
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Initialize encryption key:
   ```bash
   pnpm run init-key
   ```
4. Set up the database:
   ```bash
   pnpm run db:push
   ```
5. Seed initial data (optional):
   ```bash
   pnpm run db:seed
   ```

### Development

Start the development server:

```bash
pnpm run dev
```

The application will be available at http://localhost:3000

### Production

Build the application:

```bash
pnpm run build
```

Start the production server:

```bash
pnpm start
```

### Docker Deployment

1. Build the image:

   ```bash
   docker build -t supply-verify .
   ```

2. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

## Project Structure

- `/src`
  - `/app` - Next.js app router pages and API routes
  - `/components` - Reusable React components
  - `/db` - Database schema and configuration
  - `/hooks` - Custom React hooks
  - `/lib` - Utility functions and shared logic
  - `/scripts` - Setup and maintenance scripts

## API Routes

### Authentication

- `POST /api/auth/request-code` - Request email verification code
- `POST /api/auth/verify-code` - Verify email code
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/admin/logout` - Admin logout

### Items

- `GET /api/items` - List all items
- `POST /api/items` - Create new item (admin)
- `GET /api/items/[id]` - Get item details
- `POST /api/items/[id]/transfer` - Transfer item ownership
- `GET /api/items/[id]/transactions` - Get item transaction history
- `POST /api/items/verify` - Verify item authenticity

### Sessions

- `GET /api/session` - Get current session
- `POST /api/logout` - End current session

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is proprietary and confidential. All rights reserved.
