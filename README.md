# verify.supply.tf

A blockchain-based physical asset verification and ownership tracking system built for SUPPLY: THE FUTURE apparel.

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Blockchain](https://img.shields.io/badge/Blockchain-121D33?style=for-the-badge&logo=blockchain.com&logoColor=white)](https://blockchain.com)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)

</div>

## Overview

verify.supply.tf is a robust blockchain-based verification system designed to track and verify the authenticity and ownership of physical products. It creates an immutable digital record for each item, enabling secure ownership transfers and authenticity verification through NFC integration.

## Features

| Feature                        | Description                                                         |
| ------------------------------ | ------------------------------------------------------------------- |
| 🔒 **Blockchain Verification** | Immutable history tracking using a custom blockchain implementation |
| 👤 **Ownership Management**    | Secure transfer system with email verification                      |
| 🏷️ **NFC Integration**         | Physical-digital product linkage through NFC tags                   |
| 📱 **Mobile-First Design**     | Responsive interface optimized for mobile verification              |
| 🔍 **Audit Trail**             | Complete historical record of ownership transfers                   |
| 🛡️ **Tamper Protection**       | Cryptographic verification of product authenticity                  |

## Blockchain Architecture

### Block Structure

```mermaid
classDiagram
    class Block {
        +blockNumber: number
        +timestamp: string
        +previousHash: string
        +merkleRoot: string
        +blockNonce: number
        +calculateHash()
        +verifyTransaction()
    }

    class Transaction {
        +type: string
        +itemId: string
        +timestamp: string
        +nonce: string
        +data: object
    }

    Block "1" *-- "many" Transaction
```

### Chain Verification Flow

```mermaid
graph TB
    A[New Block] -->|Hash| B{Verify Previous Hash}
    B -->|Valid| C{Check Block Number}
    C -->|Valid| D{Verify Merkle Root}
    D -->|Valid| E{Verify Transactions}
    E -->|Valid| F[Block Accepted]

    B -->|Invalid| X[Reject Block]
    C -->|Invalid| X
    D -->|Invalid| X
    E -->|Invalid| X
```

### Merkle Tree Implementation

```mermaid
graph TB
    subgraph Merkle Tree
    R[Root Hash] --- H1[Hash 1-2]
    R --- H2[Hash 3-4]
    H1 --- T1[Transaction 1]
    H1 --- T2[Transaction 2]
    H2 --- T3[Transaction 3]
    H2 --- T4[Transaction 4]
    end

    V[Verify Transaction] --> P[Build Proof]
    P --> C{Check Against Root}
    C -->|Match| Valid[Valid Transaction]
    C -->|No Match| Invalid[Invalid Transaction]
```

### Ownership Transfer Process

```mermaid
sequenceDiagram
    participant Current Owner
    participant System
    participant Blockchain
    participant New Owner

    Current Owner->>System: Initiate Transfer
    System->>System: Generate Transfer Nonce
    System->>New Owner: Send Confirmation Email
    New Owner->>System: Confirm Transfer
    System->>Blockchain: Create Transfer Block
    Blockchain->>Blockchain: Verify Chain Integrity
    Blockchain->>System: Confirm Transfer
    System->>Current Owner: Send Transfer Complete
    System->>New Owner: Send Ownership Confirmation
```

## Technical Implementation

### Core Components

<table>
<tr>
<td width="50%">

#### 🔒 Security Features

- **Nonce Verification**  
  64-character hex nonce prevents replay attacks
- **Timestamp Normalization**  
  Millisecond precision for reliable hashing
- **Merkle Tree Proofs**  
  Efficient transaction verification system
- **Chain Integrity**  
  Continuous block link verification
- **Data Immutability**  
  Cryptographic protection of records

</td>
<td width="50%">

#### 🏗️ Data Structures

```typescript
// Block Structure
interface BlockData {
  blockNumber: number;
  timestamp: string;
  previousHash: string;
  merkleRoot: string;
  blockNonce: number;
}

// Transaction Record
interface TransactionData {
  type: "create" | "transfer";
  itemId: string;
  timestamp: string;
  nonce: string;
  data: {
    from?: {
      name: string;
      email: string;
    };
    to: {
      name: string;
      email: string;
    };
    item: ItemDetails;
  };
}
```

</td>
</tr>
</table>

## Setup and Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- pnpm (recommended)

### Quick Start

1. Clone and install dependencies:

```bash
git clone https://github.com/jiaweing/verify.supply.tf.git
cd verify.supply.tf
pnpm install
```

2. Configure environment:

```bash
cp .env.example .env
# Edit .env with your settings
```

3. Initialize database:

```bash
pnpm db:push
pnpm db:seed
```

4. Start development server:

```bash
pnpm dev
```

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).

See the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for <a href="https://supply.tf">SUPPLY: THE FUTURE</a>

</div>
