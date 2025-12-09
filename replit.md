# Chalet Dashboard

## Overview
A German-language invoice and booking management dashboard for a chalet rental business. Originally built for Cloudflare Workers/Pages with D1 database, now adapted for Replit with PostgreSQL.

## Recent Changes
- **December 9, 2025**: Migrated from Cloudflare Workers to Node.js/Express for Replit compatibility
- Replaced D1 database with PostgreSQL
- Created Express server with all necessary API endpoints

## Project Architecture

### Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Frontend**: Static HTML/CSS/JavaScript (served by Express)

### File Structure
- `server.js` - Express server with API endpoints and database initialization
- `index.html` - Main invoice management interface
- `main.js` - Frontend JavaScript for booking calendar
- `style.css` - Main stylesheet
- `images/` - Static image assets
- `functions/` - Legacy Cloudflare Workers functions (not used in Replit)
- `wrangler.toml` - Legacy Cloudflare configuration (not used in Replit)

### API Endpoints
- `GET /api/bookings` - Fetch all bookings
- `POST /api/bookings` - Create a new booking
- `PUT /api/bookings` - Create or update a booking (upsert)
- `DELETE /api/bookings` - Delete a booking
- `GET /api/invoices` - Fetch all invoices
- `PUT /api/invoices` - Save all invoices (batch)
- `GET /api/folders` - Fetch all folders
- `PUT /api/folders` - Save all folders (batch)

### Database Schema
- **bookings** - Booking records with guest info, dates, amounts
- **invoices** - Invoice records with line items and totals
- **folders** - Folder organization for invoices

## Running the Application
The application runs on port 5000. Start with:
```
node server.js
```

## User Preferences
- German language interface
- Euro currency (€)
- European date format (DD.MM.YYYY)
