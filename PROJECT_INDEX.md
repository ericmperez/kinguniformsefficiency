# King Uniforms React Application - Project Index

## 📋 Project Overview
A comprehensive React-based laundry management system for King Uniforms, featuring real-time operations, mobile-optimized interfaces, and offline capabilities.

## 🏗️ Project Structure

### Root Files
- **`package.json`** - Dependencies and scripts (React 18, TypeScript, Vite, Material-UI, Firebase)
- **`vite.config.ts`** - Vite build configuration
- **`tsconfig.json`** - TypeScript configuration
- **`firebase.json`** - Firebase hosting and functions configuration
- **`firestore.rules`** - Firestore security rules
- **`firestore.indexes.json`** - Firestore query indexes
- **`storage.rules`** - Firebase Storage security rules
- **`vercel.json`** - Vercel deployment configuration

### Core Application Files
- **`src/App.tsx`** - Main application component with navigation and routing
- **`src/main.tsx`** - Application entry point
- **`src/firebase.ts`** - Firebase configuration and initialization
- **`src/permissions.ts`** - Role-based access control system
- **`src/types.ts`** - TypeScript type definitions

### Key Directories

#### `/src/components/` - React Components
**Core Components:**
- `ActiveInvoices.tsx` - Invoice management and display
- `BillingPage.tsx` - Billing operations interface
- `ShippingPage.tsx` - Delivery and truck management
- `Washing.tsx` - Laundry processing interface
- `Segregation.tsx` - Product segregation workflow
- `PickupWashing.tsx` - Pickup and washing operations

**Authentication & User Management:**
- `AuthContext.tsx` - Authentication context provider
- `LocalLoginForm.tsx` - Login interface
- `UserManagement.tsx` - User administration
- `DriverManagement.tsx` - Driver management

**Forms & Modals:**
- `ClientForm.tsx` - Client creation/editing
- `ProductForm.tsx` - Product management
- `InvoiceForm.tsx` - Invoice creation
- `SignatureModal.tsx` - **ENHANCED** - Digital signature capture with cart quantity display
- `OfflineSignatureModal.tsx` - **NEW** - Offline signature capture with sync capabilities
- `LaundryCartModal.tsx` - Cart management modal

**Reports & Analytics:**
- `ReportsPage.tsx` - Reporting interface
- `AnalyticsPage.tsx` - Analytics dashboard
- `ComprehensiveAnalyticsDashboard.tsx` - Advanced analytics
- `DailyProductAnalytics.tsx` - Product-specific analytics
- `GlobalActivityLog.tsx` - Activity tracking
- `RealTimeActivityDashboard.tsx` - Live monitoring

**UI Components:**
- `LoadingStates.tsx` - **NEW** - Loading spinners and skeleton components
- `MobileNavigation.tsx` - **NEW** - Mobile-optimized navigation
- `ToastNotifications.tsx` - **NEW** - Notification system
- `ColorModeSelect.tsx` - Theme selection
- `DeleteConfirmationModal.tsx` - Confirmation dialogs

**Shipping Components:**
- `shipping/TruckCard.tsx` - **NEW** - Individual truck display component
- `shipping/ShippingDashboard.tsx` - **NEW** - Shipping dashboard header

**Examples:**
- `examples/SignatureModalExample.tsx` - **NEW** - Demo of signature modals with cart info

#### `/src/hooks/` - Custom React Hooks
- `useAppState.ts` - **NEW** - Centralized application state management
- `useBusinessLogic.ts` - **NEW** - Business logic operations
- `useMobile.ts` - **NEW** - Mobile device detection and responsive utilities
- `useNotifications.ts` - **NEW** - Toast notification management
- `useOfflineSignatures.ts` - **NEW** - Offline signature management
- `useShippingData.ts` - **NEW** - Shipping data and operations
- `index.ts` - Hook exports

#### `/src/services/` - Business Logic Services
- `firebaseService.ts` - Firebase operations and data management
- `emailService.ts` - Email functionality
- `pdfService.tsx` - PDF generation
- `taskScheduler.ts` - Automated task scheduling
- `themeService.ts` - Theme management
- `offlineSignatureService.ts` - **NEW** - IndexedDB-based offline signature storage and sync

#### `/src/config/` - Configuration
- `api.ts` - API configuration

#### `/src/utils/` - Utility Functions
- `dateFormatter.ts` - Date formatting utilities

#### `/api/` - Backend API Functions
- `lib/firebase.js` - Firebase utilities
- `lib/truckAssignmentNotifier.js` - Truck assignment notifications
- `cron/truck-assignment-check.js` - Automated truck assignment checks
- `send-invoice.js` - Invoice email functionality
- `send-test-email.js` - Email testing

#### `/scripts/` - Database Scripts
- `debugSkipButton.ts` - Debug utilities
- `debugTunnelOrdering.ts` - Tunnel ordering debugging
- `fixSegregatedCartsForTunnelClients.ts` - Data migration
- `migrateClientsWashingType.ts` - Client washing type migration
- `migratePickupEntryTimestamps.ts` - Timestamp migration
- `migratePickupGroupTimestamps.ts` - Group timestamp migration
- `seedPickupGroups.ts` - Data seeding
- `testOrdering.ts` - Ordering tests
- `testSignature.ts` - Signature functionality tests

#### `/public/` - Static Assets
- `images/` - Application images and logos
- `test-integration.js` - Integration testing

## 🚀 Key Features

### 1. **Enhanced Signature System** ⭐ **RECENTLY IMPROVED**
- **Cart Quantity Display**: Both signature modals now show delivery details including:
  - Number of carts being delivered
  - Total items across all carts
  - Total delivery value
  - Detailed cart breakdown with item counts
- **Offline Signature Capture**: IndexedDB-based storage with automatic sync when online
- **Mobile Optimization**: Landscape orientation support, touch-optimized interface
- **Confirmation Dialogs**: Prevents accidental data loss

### 2. **Real-time Operations**
- Live invoice tracking
- Real-time driver assignments
- Instant notifications
- Live activity monitoring

### 3. **Mobile-First Design**
- Responsive layouts
- Touch-optimized interfaces
- Mobile navigation components
- Offline capabilities

### 4. **Role-Based Access Control**
- User permission system
- Component-level access control
- Role-specific interfaces

### 5. **Advanced Analytics**
- Comprehensive reporting
- Real-time dashboards
- Product analytics
- Activity logging

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Material-UI (MUI)** - Component library
- **Bootstrap** - CSS framework for legacy components

### Backend & Services
- **Firebase** - Backend as a Service
  - **Firestore** - NoSQL database
  - **Firebase Storage** - File storage
  - **Firebase Functions** - Serverless functions
  - **Firebase Auth** - Authentication

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

### Additional Libraries
- **idb** - IndexedDB wrapper for offline storage
- **react-signature-canvas** - Signature capture
- **react-router-dom** - Client-side routing

## 👥 User Roles & Permissions

### Role Hierarchy
1. **Owner** - Full system access
2. **Admin** - Administrative functions
3. **Supervisor** - Management oversight
4. **Driver** - Delivery operations
5. **User** - Basic operations

### Component Access Matrix
- **ActiveInvoices**: All roles
- **BillingPage**: Admin, Owner, Supervisor
- **ShippingPage**: All roles (primary for Drivers)
- **UserManagement**: Admin, Owner
- **Reports**: Admin, Owner, Supervisor
- **Analytics**: Admin, Owner, Supervisor

## 📱 Mobile Experience

### Responsive Design
- Mobile-first approach
- Touch-optimized interfaces
- Landscape orientation support for signature capture
- Adaptive navigation

### Offline Capabilities
- IndexedDB storage for signatures
- Automatic sync when connection restored
- Offline-first signature capture
- Progressive Web App features

## 🔧 Recent Improvements

### Code Splitting & Performance
- Lazy loading for large components
- Bundle optimization
- Suspense boundaries for loading states

### State Management
- Centralized state with custom hooks
- Business logic separation
- Real-time data synchronization

### Loading States & Error Handling
- Skeleton loaders
- Error boundaries
- Loading spinners
- Toast notifications

### Signature System Enhancement
- **Cart quantity information display**
- **Offline signature capture with sync**
- **Mobile landscape optimization**
- **Confirmation dialogs**

## 📊 Data Models

### Core Entities
- **Client** - Customer information and preferences
- **Product** - Laundry items and pricing
- **Invoice** - Orders with carts and items
- **Cart** - Grouped items for delivery
- **User** - System users with roles
- **Driver** - Delivery personnel

### Relationships
- Clients have multiple invoices
- Invoices contain multiple carts
- Carts contain multiple items
- Items reference products
- Users have specific roles and permissions

## 🔐 Security & Permissions

### Firestore Rules
- Role-based document access
- User-specific data filtering
- Secure CRUD operations

### Authentication
- Firebase Auth integration
- Role-based login
- Session management

## 🚀 Deployment

### Environments
- **Development** - Local development
- **Production** - Vercel deployment
- **Firebase Hosting** - Static asset hosting

### Build Process
- TypeScript compilation
- Vite bundling
- Code splitting
- Asset optimization

## 📈 Performance Optimizations

### Code Splitting
- Route-based splitting
- Component lazy loading
- Dynamic imports

### Caching
- IndexedDB for offline data
- Browser caching
- Firebase offline persistence

### Bundle Optimization
- Tree shaking
- Dead code elimination
- Asset compression

## 🔄 Development Workflow

### Code Organization
- Feature-based component structure
- Shared hooks and utilities
- Service layer separation
- Type safety throughout

### Testing Strategy
- Component testing
- Integration testing
- End-to-end testing
- Performance monitoring

## 📝 Documentation

### Code Documentation
- TypeScript interfaces
- JSDoc comments
- README files
- Component documentation

### User Documentation
- Feature guides
- Role-specific instructions
- Troubleshooting guides

## 🎯 Future Enhancements

### Planned Features
- Advanced analytics dashboard
- Mobile app development
- API rate limiting
- Enhanced offline capabilities
- Real-time collaboration features

### Technical Debt
- TypeScript strict mode
- Component testing coverage
- Performance monitoring
- Accessibility improvements

---

## 📞 Support & Maintenance

### Contact Information
- **Developer**: Eric Perez
- **Project**: King Uniforms Management System
- **Version**: React 18 + TypeScript + Firebase

### Maintenance Notes
- Regular dependency updates
- Security patch monitoring
- Performance optimization
- User feedback integration

---

*Last Updated: December 2024*
*Project Status: Active Development* 