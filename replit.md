# Product Lookup Sepulveda

## Overview

This is a full-stack web application built with Express.js and React that manages product inventory and scan history. The system provides barcode scanning capabilities, product search, user authentication, and data import/export functionality. The application is designed for retail or warehouse environments where tracking product inventory and user activities is essential.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Components**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Barcode Scanning**: ZXing library for barcode/QR code reading

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Authentication**: Passport.js with local strategy and session management
- **File Processing**: Multer for file uploads, CSV parsing, ZIP file extraction
- **Database ORM**: Drizzle ORM for type-safe database operations

### Database Schema
The application uses PostgreSQL with three main entities:
- **Users**: Authentication and user management
- **Products**: Product catalog with SKU, pricing, and specifications
- **Scans**: Activity tracking linking users to scanned products

## Key Components

### Authentication System
- Session-based authentication using Passport.js
- Predefined user accounts with shared password system
- User dropdown selection for easy switching between staff members
- Protected API routes requiring authentication

### Product Management
- CSV file import for bulk product data
- ZIP file processing for multiple CSV imports
- Product search and filtering capabilities
- SKU-based product identification
- Pricing and inventory tracking

### Barcode Scanning
- Browser-based barcode scanning using device camera
- Support for various barcode formats through ZXing library
- Real-time product lookup after successful scan
- Scan history tracking with timestamps

### Data Import/Export
- Multi-format file upload (CSV, ZIP)
- Batch processing of product catalogs
- Error handling and validation during import
- File management interface for uploaded data

## Data Flow

1. **User Authentication**: Users select from predefined accounts and authenticate
2. **Product Import**: Admin uploads CSV/ZIP files containing product data
3. **Inventory Scanning**: Users scan barcodes to look up products
4. **Activity Tracking**: All scans are logged with user and timestamp information
5. **Data Management**: Products can be searched, updated, and managed through the interface

## External Dependencies

### Database
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL
- **Connection**: Environment-based connection string configuration
- **Migrations**: Drizzle Kit for schema management

### Third-Party Services
- **Microsoft Graph**: Integration capabilities (configured but not actively used)
- **File Processing**: AdmZip for ZIP file extraction, CSV parsing libraries

### Development Tools
- **Replit Environment**: Configured for Replit deployment with PostgreSQL module
- **Vite Plugins**: Specialized plugins for Replit integration and theme management

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with automatic restarts
- **Database**: PostgreSQL 16 module in Replit
- **Hot Reload**: Vite development server with HMR
- **Port Configuration**: Development on port 5000, production on port 80

### Production Build
- **Frontend**: Vite build process generating optimized static assets
- **Backend**: ESBuild compilation for Node.js deployment
- **Assets**: Static file serving from Express
- **Process Management**: PM2 or similar for production process management

### Environment Configuration
- Database URL through environment variables
- Session secrets and authentication configuration
- File upload directories and temporary storage
- Development vs production feature flags

## User Preferences

Preferred communication style: Simple, everyday language.

## Database Isolation

**Important:** This application now uses isolated database tables to prevent data conflicts with other applications:
- Products stored in: `sepulveda_products` table
- Users stored in: `sepulveda_users` table  
- Scan history stored in: `sepulveda_scans` table

This ensures complete separation from other Replit applications using the same PostgreSQL environment.

## Changelog

Changelog:
- June 26, 2025. Initial setup
- January 27, 2025. Implemented database isolation with prefixed table names (sepulveda_*) to prevent cross-application data conflicts. Reloaded 34,435 products from local CSV files in data directory.
- July 8, 2025. Integrated new Whittex catalog file (Whittex_Catalog_Sepulveda_07-08-2025.csv) with 80 products. Total product count now 34,529 products from 177 CSV files. All Whittex products are fully searchable and integrated into the system.