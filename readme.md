# Adyen Hosted Payment Integration with Webhook, Refunds, AWS Serverless Deployment, and 3D Secure Support

## Project Overview

This project implements a complete end-to-end payment processing system using Adyen Drop-in integration. The application supports secure payment processing, webhook handling, refund functionality, HMAC validation, AWS serverless deployment, idempotency handling, and cloud database persistence.

The system demonstrates a production-style payment architecture with secure webhook verification, cloud-hosted MySQL database integration, frontend/backend deployment, and Adyen Web v6 payment flow handling.

---

# Features

- Adyen Drop-in payment integration
- Payment session creation using Adyen Sessions API
- AUTHORISATION webhook handling
- REFUND webhook handling
- HMAC signature validation for webhook security
- AWS Lambda serverless backend deployment
- AWS API Gateway integration
- AWS SSM Parameter Store secret management
- Cloud MySQL database integration using Railway
- Refund API implementation
- Payment and refund persistence
- Idempotency handling using UNIQUE constraints
- Success and failure payment handling
- Adyen Web v6 callback handling
- 3D Secure (3DS) ready architecture

---

# System Architecture

```text
Frontend (React + Adyen Drop-in)
        ↓
Backend API (Node.js + Express)
        ↓
AWS Lambda + API Gateway
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
6. Adyen processes payment
7. Adyen triggers AUTHORISATION webhook
8. Backend validates HMAC signature
9. Payment details stored in payments table
10. Frontend navigates to success/failure page
```

---

# Failure Handling Flow

```text
1. Payment gets refused by Adyen
2. Adyen Web v6 triggers onPaymentFailed callback
3. Frontend redirects to failure page
4. Adyen sends failure webhook event
5. Backend validates HMAC signature
6. Failed payment stored in database
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

- React.js
- Adyen Web Drop-in
- Axios

## Backend

- Node.js
- Express.js
- MySQL2

## Database

- MySQL
- Railway Cloud Database

## Cloud & Deployment

- AWS Lambda
- AWS API Gateway
- AWS SSM Parameter Store
- Serverless Framework
- Vercel

## Payment Gateway

- Adyen

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

- AUTHORISATION events
- REFUND events

Performs:

- HMAC validation
- Payment persistence
- Refund persistence
- Duplicate event handling

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

# Adyen Web v6 Payment Handling

## Successful Payments

Handled using:

```js
onPaymentCompleted
```

## Failed Payments

Handled using:

```js
onPaymentFailed
```

Important Learning:

In Adyen Web v6, refused or cancelled payments are handled separately using the `onPaymentFailed` callback instead of `onPaymentCompleted`.

---

# AWS SSM Parameter Store

Sensitive values were securely stored using AWS Systems Manager (SSM) Parameter Store.

Examples:

- Adyen API keys
- HMAC keys
- Database credentials

Benefits:

- Secure secret management
- Avoid hardcoding credentials
- Centralized configuration management

---

# Security Features

- HMAC webhook validation implemented
- Environment variable based secret management
- Secure webhook verification using Adyen HMAC validator
- Cloud database integration with SSL support
- AWS SSM secure parameter management
- Idempotency handling for webhook retries

---

# Idempotency Handling

To prevent duplicate webhook processing and repeated transaction entries, idempotency handling was implemented using UNIQUE constraints on transaction and refund identifiers.

## Payments Table UNIQUE Constraint

```sql
ALTER TABLE payments
ADD CONSTRAINT unique_transaction
UNIQUE (transactionId);
```

## Refunds Table UNIQUE Constraint

```sql
ALTER TABLE refunds
ADD CONSTRAINT unique_refund
UNIQUE (refundId);
```

## Why Idempotency Was Needed

Payment gateways like Adyen may retry webhook delivery multiple times due to:

- Network failures
- Timeout issues
- Delivery confirmation failures

Without idempotency handling, duplicate webhook events could create multiple payment or refund records in the database.

---

# Deployment

## Frontend

Deployed using:

- Vercel

## Backend

Deployed using:

- AWS Lambda
- API Gateway
- Serverless Framework

## Database

Hosted on Railway MySQL.

---

# Challenges Faced

- Understanding Adyen Web v6 callback behavior
- Triggering and handling failure payment scenarios
- Identifying that refused payments are handled using onPaymentFailed callback
- Understanding Adyen documentation and test simulation behavior
- Webhook synchronization
- AWS serverless deployment
- MySQL connection configuration
- HMAC validation implementation

---

# Future Improvements

- 3D Secure (3DS) authentication integration
- OTP-based payment verification
- Real-time payment status tracking
- WebSocket-based updates
- Fraud detection system
- Monitoring and logging dashboards
- Analytics dashboard
- Multi-payment gateway support

---

# Test Card Details

## Successful Payment

```text
Card Number: 4111 1111 1111 1111
Expiry: 03/30
CVV: 737
Card Holder Name: John Smith
```

---

## Refused Payment

```text
Card Number: 4111 1111 1111 1111
Expiry: 03/30
CVV: 737
Card Holder Name: REFUSED
```

---

# 3D Secure (3DS)

3D Secure is an additional authentication layer used during online payments.

Examples:

- OTP verification
- Banking authentication page
- Biometric verification

Benefits:

- Reduced fraud
- Enhanced payment security
- Improved transaction authentication

The architecture is prepared for future 3DS integration using Adyen Sessions Flow.

---

# Conclusion

This project demonstrates a production-style payment integration system using Adyen with:

- Secure webhook validation
- AWS serverless deployment
- Refund handling
- Database persistence
- HMAC-based webhook security
- Failure handling using Adyen Web v6
- Idempotent webhook processing
- Cloud-native payment architecture

The implementation covers real-world payment gateway concepts including payment authorization, webhook systems, secure cloud deployment, refund workflows, and scalable backend architecture.
