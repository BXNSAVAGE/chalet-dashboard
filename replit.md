# Chalet Dashboard

## Overview
A comprehensive German-language chalet booking and invoice management dashboard with an Apple Calendar-style interface. Features include customer management, booking calendar, invoice generation with PDF export, and pre-made email templates.

## Recent Changes
- **December 9, 2025**: Complete rebuild of the dashboard
  - Created Apple Calendar-style main interface with 3-column layout
  - Added customer management system
  - Rebuilt booking system with calendar integration
  - Added invoice generation with automatic calculations and PDF export
  - Created 5 pre-made email templates (booking confirmation, payment reminder, check-in info, invoice, thank you)
  - Migrated database schema to PostgreSQL with proper relationships

## Project Architecture

### Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Frontend**: Vanilla HTML/CSS/JavaScript with Apple-style design
- **PDF Generation**: jsPDF library

### File Structure
- `server.js` - Express server with all API endpoints and database initialization
- `index.html` - Main dashboard with all pages and modals
- `style.css` - Legacy stylesheet (styles now inline in index.html)
- `main.js` - Legacy JavaScript (now integrated in index.html)
- `images/` - Static image assets
- `functions/` - Legacy Cloudflare Workers functions (not used)
- `wrangler.toml` - Legacy Cloudflare configuration (not used)

### Database Tables
- **customers** - Customer profiles (name, email, phone, address, country, notes)
- **bookings** - Booking records linked to customers
- **invoices** - Invoice records with line items and calculations
- **email_templates** - Pre-made email templates

### API Endpoints

#### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer with bookings and invoices
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

#### Bookings
- `GET /api/bookings` - List all bookings
- `POST /api/bookings` - Create booking (auto-creates customer if new email)
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking

#### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create invoice with auto-generated number
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

#### Other
- `GET /api/email-templates` - List email templates
- `GET /api/stats` - Dashboard statistics

### Features
1. **Apple Calendar Dashboard** - Main view with calendar, upcoming bookings, and statistics
2. **Booking Management** - Create, edit, view bookings on calendar
3. **Customer Profiles** - Maintain customer database with full history
4. **Invoice Generation** - Create invoices from bookings, auto-calculate taxes
5. **PDF Export** - Download professional invoices as PDF
6. **Email Templates** - Pre-made German emails for common scenarios

## Running the Application
The application runs on port 5000:
```
node server.js
```

## User Preferences
- German language interface
- Euro currency (€)
- European date format (DD.MM.YYYY)
- Tourist tax: €5 per adult per night
- Standard cleaning fee: €70
