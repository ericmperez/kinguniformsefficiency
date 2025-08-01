# King Uniforms React Application - Project Index

## Overview
This is a comprehensive React-based laundry management system for King Uniforms, built with TypeScript, Firebase, and Material-UI. The application handles laundry ticket processing, client management, driver assignments, billing, and real-time activity monitoring.

## Project Structure

### Root Directory Files

#### Configuration Files
- **`package.json`** - Project dependencies and scripts (React 18, TypeScript, Firebase, Material-UI)
- **`vite.config.ts`** - Vite build configuration
- **`tsconfig.json`** - TypeScript configuration
- **`tsconfig.node.json`** - TypeScript configuration for Node.js
- **`vercel.json`** - Vercel deployment configuration (CRITICAL - Do not modify)
- **`firebase.json`** - Firebase project configuration
- **`firestore.rules`** - Firestore security rules
- **`firestore.indexes.json`** - Firestore database indexes
- **`storage.rules`** - Firebase Storage security rules
- **`database.rules.json`** - Realtime Database rules

#### Documentation Files
- **`README.md`** - Deployment warning about vercel.json
- **`CONTRIBUTING.md`** - Contribution guidelines
- **`DASHBOARD_TESTING_GUIDE.md`** - Testing documentation for dashboard features

#### Implementation Documentation
- **`CART_EDITING_*`** - Cart editing feature implementation docs
- **`CART_PRINT_*`** - Cart printing functionality docs
- **`PRINTING_*`** - Printing system documentation
- **`DRIVER_NOTIFICATION_SYSTEM_COMPLETE.md`** - Driver notification implementation
- **`SUGGESTIONS_PANEL_IMPLEMENTATION.md`** - Suggestions panel feature docs
- **`PICKUP_DELIVERY_METHOD_IMPLEMENTATION_COMPLETE.md`** - Pickup/delivery implementation
- **`EMAIL_CONTENT_GUIDE_IMPLEMENTATION.md`** - Email system documentation
- **`PRODUCTION_EMAIL_*`** - Production email setup and resolution docs

#### Test Files
- **`test-*.js`** - Various test scripts for different features
- **`debug-*.js`** - Debug scripts for troubleshooting
- **`cart-monitor.js`** - Cart monitoring utility
- **`check-users.js`** - User verification script
- **`final-cart-verification.js`** - Cart verification utility

#### Server Files
- **`server.js`** - Express server for development
- **`server.cjs`** - CommonJS server configuration
- **`deploy-production-email.sh`** - Email deployment script

### Source Code (`src/`)

#### Core Application Files
- **`App.tsx`** - Main application component (1872 lines) - Central routing, navigation, and state management
- **`main.tsx`** - Application entry point
- **`firebase.ts`** - Firebase configuration and initialization
- **`types.ts`** - TypeScript type definitions for the entire application
- **`permissions.ts`** - User permission system and role-based access control
- **`App.css`** - Global application styles

#### Components (`src/components/`)

##### Core Business Logic Components
- **`ActiveInvoices.tsx`** (6111 lines) - Main invoice management interface
- **`PickupWashing.tsx`** (947 lines) - Pickup and washing process management
- **`Washing.tsx`** (2753 lines) - Washing process interface
- **`Segregation.tsx`** (1781 lines) - Laundry segregation management
- **`ShippingPage.tsx`** (3211 lines) - Driver shipping interface
- **`BillingPage.tsx`** (3586 lines) - Billing and invoice management

##### Management Components
- **`UserManagement.tsx`** (530 lines) - User administration interface
- **`DriverManagement.tsx`** (237 lines) - Driver management
- **`ClientForm.tsx`** (1038 lines) - Client creation and editing
- **`ProductForm.tsx`** (200 lines) - Product management
- **`InvoiceForm.tsx`** (211 lines) - Invoice creation and editing

##### Modal and Popup Components
- **`InvoiceDetailsModal.tsx`** (1971 lines) - Invoice details modal
- **`InvoiceDetailsPopup.tsx`** (668 lines) - Invoice details popup
- **`LaundryCartModal.tsx`** (271 lines) - Laundry cart modal
- **`LaundryTicketFieldsModal.tsx`** (327 lines) - Laundry ticket fields
- **`SignatureModal.tsx`** (610 lines) - Digital signature capture
- **`DeleteConfirmationModal.tsx`** (71 lines) - Delete confirmation dialog
- **`PrintConfigModal.tsx`** (1119 lines) - Print configuration modal

##### Reporting and Analytics
- **`ReportsPage.tsx`** (910 lines) - Reports interface
- **`Report.tsx`** (316 lines) - Individual report component
- **`AnalyticsPage.tsx`** (380 lines) - Analytics dashboard
- **`GlobalActivityLog.tsx`** (138 lines) - Global activity logging
- **`RealTimeActivityDashboard.tsx`** (618 lines) - Real-time activity monitoring

##### Authentication and UI
- **`AuthContext.tsx`** (174 lines) - Authentication context provider
- **`LocalLoginForm.tsx`** (234 lines) - Login form component
- **`SignInSide.tsx`** (98 lines) - Sign-in side panel
- **`SignInCard.tsx`** (80 lines) - Sign-in card component
- **`HomeLoginPage.tsx`** (289 lines) - Home login page
- **`LoginExample.tsx`** (31 lines) - Login example component
- **`LoginExamples.tsx`** (12 lines) - Login examples container

##### Specialized Components
- **`PrintingSettings.tsx`** (1792 lines) - Printing configuration
- **`DriverNotificationSettings.tsx`** (313 lines) - Driver notification configuration
- **`SuggestionsPanel.tsx`** (478 lines) - Suggestions and feedback panel
- **`CartEditHandler.tsx`** (259 lines) - Cart editing functionality
- **`RutasPorCamion.tsx`** (152 lines) - Truck routes management
- **`Supervisor.tsx`** (206 lines) - Supervisor interface
- **`SendInvoicePage.tsx`** (246 lines) - Invoice sending interface

##### Utility Components
- **`Content.tsx`** (40 lines) - Content wrapper component
- **`AppTheme.tsx`** (7 lines) - Theme configuration
- **`ColorModeSelect.tsx`** (7 lines) - Color mode selection
- **`LaundryTicketPreview.tsx`** (75 lines) - Ticket preview component
- **`LaundryTicketPreview.css`** (75 lines) - Ticket preview styles

##### Legacy and Backup Files
- **`ActiveInvoices.tsx.backup`** (4912 lines) - Backup of main invoices component
- **`markInvoiceAsDone.ts`** (3 lines) - Invoice completion utility
- **`types.ts`** (627 lines) - Component-specific types

#### Services (`src/services/`)

##### Core Services
- **`firebaseService.ts`** (1062 lines) - Firebase database operations and API
- **`emailService.ts`** (495 lines) - Email sending functionality
- **`pdfService.tsx`** (61 lines) - PDF generation and handling
- **`taskScheduler.ts`** (237 lines) - Automated task scheduling
- **`driverAssignmentNotifier.ts`** (334 lines) - Driver assignment notifications
- **`themeService.ts`** (25 lines) - Theme management service

#### Configuration (`src/config/`)
- **`api.ts`** - API configuration and endpoints

#### Utilities (`src/utils/`)
- **`dateFormatter.ts`** - Date formatting utilities

#### Assets (`src/assets/`)
- **`King Uniforms Logo.jpeg`** - Company logo
- **`King Uniforms Logo.png`** - Company logo (PNG format)
- **`RIMCO-CAT-Logo400.webp`** - Client logo
- **`Baby Blanket.jpg`** - Product image
- **`color_palette.txt`** - Color scheme definitions
- **`logo-large.svg`** - Large logo SVG
- **`person.svg`** - Person icon
- **`react.svg`** - React logo
- **`user-roles`** - User role definitions

#### Types (`src/types/`)
- **`html2pdfjs.d.ts`** - HTML to PDF library type definitions

### API Directory (`api/`)

#### API Endpoints
- **`send-invoice.js`** (56 lines) - Invoice sending API endpoint
- **`send-test-email.js`** (51 lines) - Test email sending endpoint
- **`test-truck-assignment.js`** (50 lines) - Truck assignment testing endpoint

#### Cron Jobs (`api/cron/`)
- **`truck-assignment-check.js`** - Automated truck assignment checking

#### Library Files (`api/lib/`)
- **`firebase.js`** - Firebase configuration for API
- **`truckAssignmentNotifier.js`** - Truck assignment notification logic

### Scripts (`scripts/`)

#### Migration Scripts
- **`migrateClientsWashingType.ts`** (40 lines) - Client washing type migration
- **`migratePickupEntryTimestamps.ts`** (38 lines) - Pickup entry timestamp migration
- **`migratePickupGroupTimestamps.ts`** (46 lines) - Pickup group timestamp migration
- **`fixSegregatedCartsForTunnelClients.ts`** (32 lines) - Cart segregation fixes

#### Testing Scripts
- **`testOrdering.ts`** (134 lines) - Order testing utilities
- **`testSignature.ts`** (116 lines) - Signature testing
- **`debugTunnelOrdering.ts`** (115 lines) - Tunnel ordering debugging
- **`debugSkipButton.ts`** (125 lines) - Skip button debugging

#### Utility Scripts
- **`seedPickupGroups.ts`** (69 lines) - Pickup group seeding utility

### Public Directory (`public/`)

#### Images
- **`images/clients/`** - Client logos and avatars
  - `default-avatar.png` - Default user avatar
  - `ManatiMedicalCenter.png` - Client logo
  - `RIMCO-CAT-Logo400.webp` - Client logo
- **`images/products/`** - Product images
  - `scrubpants.png` - Scrub pants product image
  - `scrubshirt.png` - Scrub shirt product image
  - `whiteSheets.png` - White sheets product image
- **`King Uniforms Logo.png`** - Company logo
- **`King-Uniforms-Icon.png`** - Company icon

#### Test Files
- **`test-integration.js`** - Integration testing utilities

### Tests Directory (`tests/`)
- Contains test files and testing utilities

## Key Features

### Core Business Processes
1. **Laundry Ticket Management** - Complete lifecycle from pickup to delivery
2. **Client Management** - Client profiles, preferences, and history
3. **Product Management** - Product catalog and pricing
4. **Driver Assignment** - Automated and manual driver assignment
5. **Billing System** - Invoice generation and management
6. **Real-time Monitoring** - Live activity dashboard and logging

### Technical Features
1. **Role-based Access Control** - User permissions and security
2. **Real-time Updates** - Firestore listeners for live data
3. **Printing System** - Configurable printing for tickets and invoices
4. **Email Notifications** - Automated email sending
5. **Mobile Responsive** - Bootstrap and Material-UI responsive design
6. **TypeScript** - Full type safety throughout the application

### User Roles
- **Owner** - Full system access
- **Admin** - Administrative functions
- **Supervisor** - Management and oversight
- **Driver** - Delivery and pickup operations
- **User** - Basic operational access

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material-UI** - Component library
- **Bootstrap** - CSS framework
- **Vite** - Build tool

### Backend
- **Firebase** - Backend as a Service
  - Firestore - Database
  - Storage - File storage
  - Authentication - User management
- **Express.js** - API server
- **Node.js** - Runtime environment

### Additional Libraries
- **html2pdf.js** - PDF generation
- **nodemailer** - Email sending
- **react-signature-canvas** - Digital signatures
- **react-router-dom** - Client-side routing

## Development Workflow

### Getting Started
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`

### Important Notes
- **Do not modify `vercel.json`** without approval - critical for deployment
- All Firebase configuration is in `src/firebase.ts`
- User permissions are managed in `src/permissions.ts`
- Type definitions are centralized in `src/types.ts`

### Recent Improvements ✅
- **Code Splitting Implemented** - Large components are now lazy-loaded for better performance
  - ActiveInvoices: 90.58 kB chunk
  - BillingPage: 51.39 kB chunk
  - Washing: 51.87 kB chunk
  - ShippingPage: 71.39 kB chunk
  - All components wrapped with Suspense for better UX
  
- **State Management Optimization (In Progress)** - Centralized state management
  - Created `useAppState` hook for centralized state management
  - Created `useBusinessLogic` hook for business operations
  - Started refactoring App.tsx to use new hook pattern
  - Reduces App.tsx complexity from 1900+ lines

- **Loading States & Error Handling** - Enhanced user experience
  - Created comprehensive loading state components (`LoadingStates.tsx`)
  - TableSkeleton, FormSkeleton, CardGridSkeleton, StatsSkeleton
  - Enhanced LoadingSpinner with multiple variants
  - ErrorFallback component for better error handling
  - DataStateWrapper for consistent loading/error/empty states

- **Mobile Experience Enhancement** - Mobile-first improvements
  - Created `useMobile` hook for device detection and responsive behavior
  - Built `MobileNavigation` component with bottom navigation
  - Added SpeedDial for secondary navigation options
  - Mobile-optimized floating action buttons (MobileFAB)
  - Touch-friendly interface improvements

- **Real-time Notifications System** - User feedback improvements
  - Created `useNotifications` hook for toast management
  - Built `ToastNotifications` component with stacked notifications
  - SimpleToast and LoadingToast for different use cases
  - Auto-dismiss with customizable duration
  - Action buttons in notifications for user interaction

- **ShippingPage Improvements (In Progress)** - Critical component optimization
  - Created `TruckCard` component for better truck display
  - Built `useShippingData` hook to extract business logic
  - Created `ShippingDashboard` component for mobile-optimized header
  - Started breaking down 3211-line monolithic component
  - Improved mobile experience with responsive design

## Deployment
- **Vercel** - Primary deployment platform
- **Firebase Hosting** - Alternative deployment option
- Environment variables configured for production email and Firebase

This index provides a comprehensive overview of the King Uniforms React application structure, helping developers understand the codebase organization and locate specific functionality. 