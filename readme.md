# Adyen Hosted Payment Integration with Webhook and Refund Handling

## Project Overview

This project implements a complete end-to-end payment processing system using Adyen Drop-in integration. The application supports secure payment processing, webhook handling, refund functionality, HMAC validation, and cloud database persistence.

The system demonstrates a production-like payment architecture with deployed backend services, secure webhook verification, and cloud-hosted MySQL database integration.

---

# Features

* Adyen Drop-in payment integration
* Payment session creation using Adyen Sessions API
* AUTHORISATION webhook handling
* REFUND webhook handling
* HMAC signature validation for webhook security
* Cloud MySQL database integration using Railway
* Refund API implementation
* Payment and refund persistence
* Public webhook deployment using Render
* Success and failure payment handling

---

# System Architecture

```text
Frontend (React)
        ↓
Backend API (Node.js + Express)
        ↓
Adyen Payment Gateway
        ↓
Webhook Events
        ↓
Webhook Verification using HMAC
        ↓
Cloud MySQL Database (Railway)
```

---

# Payment Flow

```text
1. Frontend requests payment session from backend
2. Backend calls Adyen Sessions API
3. Session response returned to frontend
4. Adyen Drop-in rendered on frontend
5. User enters card details
6. Payment processed by Adyen
7. Adyen triggers AUTHORISATION webhook
8. Backend validates HMAC signature
9. Payment details stored in payments table
```

---

# Refund Flow

```text
1. Refund API called with payment PSP reference
2. Backend sends refund request to Adyen
3. Adyen processes refund
4. Adyen triggers REFUND webhook
5. Backend validates HMAC signature
6. Refund details stored in refunds table
```

---

# Tech Stack

## Frontend

* React.js
* Adyen Web Drop-in
* Axios

## Backend

* Node.js
* Express.js
* MySQL2

## Database

* MySQL
* Railway Cloud Database

## Deployment

* Render

## Payment Gateway

* Adyen

---

# Folder Structure

```
project-root/
│
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── main.jsx
│   │   ├── Success.jsx
│   │   ├── Failed.jsx
│   │   └── styles.css
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── index.js
│   ├── package.json
│   ├── .env
│   └── node_modules/
│
├── README.md
└── screenshots/
```
---

# Database Schema

## payments Table

```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  transactionId VARCHAR(255),
  merchantReference VARCHAR(255),
  status VARCHAR(100),
  amount INTEGER,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## refunds Table

```sql
CREATE TABLE refunds (
  id SERIAL PRIMARY KEY,
  refundId VARCHAR(255),
  paymentId VARCHAR(255),
  status VARCHAR(100),
  refundAmount INTEGER,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# API Endpoints

## Create Payment Session

```http
POST /create-payment-session
```

Creates Adyen payment session and returns session details to frontend.

---

## Webhook Endpoint

```http
POST /webhook
```

Handles:

* AUTHORISATION events
* REFUND events

Performs:

* HMAC validation
* Payment persistence
* Refund persistence

---

## Refund API

```http
POST /refund
```

Request Body:

```json
{
  "paymentPspReference": "PAYMENT_REFERENCE"
}
```

Triggers refund request through Adyen.

---

# Environment Variables

## Backend .env

```env
ADYEN_API_KEY=your_adyen_api_key
ADYEN_MERCHANT_ACCOUNT=your_merchant_account
ADYEN_HMAC_KEY=your_hmac_key

DB_HOST=your_db_host
DB_PORT=your_db_port
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

---

# Security Features

* HMAC webhook validation implemented
* Environment variable based secret management
* Secure webhook verification using Adyen HMAC validator
* Cloud database integration with SSL support

---

# Deployment

## Frontend

Can be deployed using:

* Vercel
* Netlify

## Backend

Deployed using Render.

## Database

Hosted on Railway MySQL.

---

# Challenges Faced

* Webhook accessibility for localhost environments
* Cloud database connectivity issues
* MySQL connection pool configuration
* Deployment environment variable management
* HMAC validation implementation
* Payment webhook testing and debugging

---

# Future Improvements

* AWS Lambda migration
* API Gateway integration
* Transaction history dashboard
* Idempotency handling
* Admin analytics dashboard
* Monitoring and logging system
* Automated refund management

---

# Test Card Details

## Successful Payment

```text
Card Number: 4111 1111 1111 1111
Expiry: 03/30
CVV: 737
```

## Refused Payment

```text
Card Number: 4000 0000 0000 0002
Expiry: 03/30
CVV: 737
```

---

# Conclusion

This project demonstrates a production-style payment integration system using Adyen with secure webhook validation, cloud deployment, refund handling, and persistent cloud database storage.

The implementation covers core payment gateway concepts including payment authorization, webhook architecture, cloud deployment, database persistence, refund processing, and HMAC-based webhook security.
