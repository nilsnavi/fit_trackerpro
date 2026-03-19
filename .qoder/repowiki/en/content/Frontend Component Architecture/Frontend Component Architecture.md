# Frontend Component Architecture

<cite>
**Referenced Files in This Document**
- [App.tsx](file://frontend/src/App.tsx)
- [main.tsx](file://frontend/src/main.tsx)
- [Navigation.tsx](file://frontend/src/components/common/Navigation.tsx)
- [homeStore.ts](file://frontend/src/stores/homeStore.ts)
- [userStore.ts](file://frontend/src/stores/userStore.ts)
- [index.ts](file://frontend/src/components/ui/index.ts)
- [Button.tsx](file://frontend/src/components/ui/Button.tsx)
- [Card.tsx](file://frontend/src/components/ui/Card.tsx)
- [Input.tsx](file://frontend/src/components/ui/Input.tsx)
- [ProgressBar.tsx](file://frontend/src/components/ui/ProgressBar.tsx)
- [api.ts](file://frontend/src/services/api.ts)
- [useTelegram.ts](file://frontend/src/hooks/useTelegram.ts)
- [useTelegramWebApp.ts](file://frontend/src/hooks/useTelegramWebApp.ts)
- [telegram.ts](file://frontend/src/types/telegram.ts)
- [cn.ts](file://frontend/src/utils/cn.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the FitTracker Pro frontend component architecture built with React and TypeScript. It covers the application structure, routing and navigation, page layouts, component composition patterns, the internal design system (Button, Card, Input, ProgressBar), state management using Zustand stores and custom hooks, integration with Telegram WebApp SDK, API services, and best practices for responsiveness and accessibility.

## Project Structure
The frontend is organized around a clear separation of concerns:
- Pages: route-driven screens such as Home, Workouts, Health, Profile, and Analytics
- Components: reusable UI building blocks grouped by domain (common, ui, health, workout, etc.)
- Stores: state containers powered by Zustand for user and home-related state
- Hooks: Telegram WebApp integration and shared utilities
- Services: API client with interceptors and typed error handling
- Utilities: Tailwind-based class merging helper

```mermaid
graph TB
subgraph "Entry Point"
MAIN["main.tsx"]
APP["App.tsx"]
end
subgraph "Routing"
ROUTES["Routes & Paths"]
NAV["Navigation.tsx"]
end
subgraph "Pages"
HOME["HomePage.tsx"]
WORKOUTS["WorkoutsPage.tsx"]
HEALTH["HealthPage.tsx"]
PROFILE["ProfilePage.tsx"]
ANALYTICS["Analytics.tsx"]
end
subgraph "Common Components"
NAVCOMP["Navigation.tsx"]
end
subgraph "UI Library"
BTN["Button.tsx"]
CARD["Card.tsx"]
INPUT["Input.tsx"]
PROGRESS["ProgressBar.tsx"]
UILIB["ui/index.ts"]
end
subgraph "State Management"
HOMESTORE["homeStore.ts"]
USERSTORE["userStore.ts"]
end
subgraph "Integrations"
TGHOOK["useTelegram.ts"]
TGHOOK["useTelegramWebApp.ts"]
TYPES["telegram.ts"]
API["api.ts"]
end
MAIN --> APP
APP --> ROUTES
ROUTES --> HOME
ROUTES --> WORKOUTS
ROUTES --> HEALTH
ROUTES --> PROFILE
ROUTES --> ANALYTICS
APP --> NAVCOMP
NAVCOMP --> NAV
UILIB --> BTN
UILIB --> CARD
UILIB --> INPUT
UILIB --> PROGRESS
HOMESTORE --> HOME
USERSTORE --> PROFILE
TGHOOK --> APP
TGHOOK --> APP
TYPES --> TGHOOK
API --> HOME
```

**Diagram sources**
- [main.tsx:1-23](file://frontend/src/main.tsx#L1-L23)
- [App.tsx:1-35](file://frontend/src/App.tsx#L1-L35)
- [Navigation.tsx:1-38](file://frontend/src/components/common/Navigation.tsx#L1-L38)
- [homeStore.ts:1-206](file://frontend/src/stores/homeStore.ts#L1-L206)
- [userStore.ts:1-31](file://frontend/src/stores/userStore.ts#L1-L31)
- [index.ts:1-25](file://frontend/src/components/ui/index.ts#L1-L25)
- [Button.tsx:1-184](file://frontend/src/components/ui/Button.tsx#L1-L184)
- [Card.tsx:1-175](file://frontend/src/components/ui/Card.tsx#L1-L175)
- [Input.tsx:1-301](file://frontend/src/components/ui/Input.tsx#L1-L301)
- [ProgressBar.tsx:1-225](file://frontend/src/components/ui/ProgressBar.tsx#L1-L225)
- [useTelegram.ts:1-47](file://frontend/src/hooks/useTelegram.ts#L1-L47)
- [useTelegramWebApp.ts:1-509](file://frontend/src/hooks/useTelegramWebApp.ts#L1-L509)
- [telegram.ts:1-390](file://frontend/src/types/telegram.ts#L1-L390)
- [api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)

**Section sources**
- [main.tsx:1-23](file://frontend/src/main.tsx#L1-L23)
- [App.tsx:1-35](file://frontend/src/App.tsx#L1-L35)

## Core Components
This section documents the internal design system and key state management patterns.

- UI Library exports and types:
  - Button, Card, Input, ProgressBar, Chip, Modal, Timer are exported from the UI library index.
  - Each component defines its own props and variants, enabling consistent composition across pages.

- State management:
  - Zustand stores encapsulate domain-specific state and actions.
  - Persistence is applied selectively to avoid bloating local storage.
  - Stores expose typed setters and derived actions (e.g., refreshers) to keep components decoupled from data fetching.

- Telegram integration:
  - Two complementary hooks provide different levels of abstraction:
    - A lightweight hook wraps the official SDK to configure UI and expose haptic feedback and main button controls.
    - A comprehensive hook exposes the full Telegram WebApp API surface with typed events, cloud storage, and UI controls.

- API service:
  - Axios-based client with request/response interceptors for auth tokens and error logging.
  - Typed error shape enables consistent error handling across components.

**Section sources**
- [index.ts:1-25](file://frontend/src/components/ui/index.ts#L1-L25)
- [Button.tsx:1-184](file://frontend/src/components/ui/Button.tsx#L1-L184)
- [Card.tsx:1-175](file://frontend/src/components/ui/Card.tsx#L1-L175)
- [Input.tsx:1-301](file://frontend/src/components/ui/Input.tsx#L1-L301)
- [ProgressBar.tsx:1-225](file://frontend/src/components/ui/ProgressBar.tsx#L1-L225)
- [homeStore.ts:1-206](file://frontend/src/stores/homeStore.ts#L1-L206)
- [userStore.ts:1-31](file://frontend/src/stores/userStore.ts#L1-L31)
- [useTelegram.ts:1-47](file://frontend/src/hooks/useTelegram.ts#L1-L47)
- [useTelegramWebApp.ts:1-509](file://frontend/src/hooks/useTelegramWebApp.ts#L1-L509)
- [api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)

## Architecture Overview
The runtime architecture centers on React Router for navigation, Zustand for state, and Telegram WebApp APIs for immersive UI integration. The Query Client provider enables caching and optimistic updates for data-heavy pages.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Main as "main.tsx"
participant Provider as "QueryClientProvider"
participant App as "App.tsx"
participant Router as "React Router"
participant Page as "Page Component"
participant Store as "Zustand Store"
participant API as "api.ts"
participant Telegram as "Telegram WebApp"
Browser->>Main : Load app
Main->>Provider : Wrap with QueryClientProvider
Provider->>App : Render App
App->>Router : Define routes
Router->>Page : Render selected page
Page->>Store : Read/write state
Page->>API : Fetch/Persist data
API-->>Page : Return typed data
Page->>Telegram : Configure UI and haptics
Telegram-->>Page : Theme/UI updates
```

**Diagram sources**
- [main.tsx:1-23](file://frontend/src/main.tsx#L1-L23)
- [App.tsx:1-35](file://frontend/src/App.tsx#L1-L35)
- [homeStore.ts:147-206](file://frontend/src/stores/homeStore.ts#L147-L206)
- [userStore.ts:15-31](file://frontend/src/stores/userStore.ts#L15-L31)
- [api.ts:6-69](file://frontend/src/services/api.ts#L6-L69)
- [useTelegramWebApp.ts:160-176](file://frontend/src/hooks/useTelegramWebApp.ts#L160-L176)

## Detailed Component Analysis

### Navigation System
The bottom navigation bar provides five primary destinations: Home, Catalog, Workouts, Stats, and Profile. It uses React Router’s NavLink to reflect active routes and applies Tailwind-based active/inactive styles. The Navigation component is fixed at the bottom and overlays page content.

```mermaid
flowchart TD
Start(["Render Navigation"]) --> MapNav["Map navItems to links"]
MapNav --> NavLink["Create NavLink per item"]
NavLink --> Active{"Is active?"}
Active --> |Yes| ApplyActive["Apply active styles"]
Active --> |No| ApplyInactive["Apply inactive styles"]
ApplyActive --> End(["Render"])
ApplyInactive --> End
```

**Diagram sources**
- [Navigation.tsx:5-38](file://frontend/src/components/common/Navigation.tsx#L5-L38)

**Section sources**
- [Navigation.tsx:1-38](file://frontend/src/components/common/Navigation.tsx#L1-L38)
- [App.tsx:17-29](file://frontend/src/App.tsx#L17-L29)

### Page Layouts and Composition Patterns
- App wraps all pages in a single-page layout with a fixed bottom navigation bar.
- Pages are route-driven and rendered inside the Routes container.
- Composition follows a pattern where domain-specific pages import UI components from the design system and consume Zustand stores.

```mermaid
graph TB
APP["App.tsx"] --> LAYOUT["Main container<br/>min-h-screen bg-white"]
LAYOUT --> ROUTES["Routes"]
ROUTES --> PAGE_HOME["HomePage"]
ROUTES --> PAGE_WORKOUTS["WorkoutsPage"]
ROUTES --> PAGE_HEALTH["HealthPage"]
ROUTES --> PAGE_PROFILE["ProfilePage"]
ROUTES --> PAGE_ANALYTICS["Analytics"]
APP --> NAV["Navigation"]
```

**Diagram sources**
- [App.tsx:12-32](file://frontend/src/App.tsx#L12-L32)

**Section sources**
- [App.tsx:1-35](file://frontend/src/App.tsx#L1-L35)

### Design System: Button, Card, Input, ProgressBar
These components share consistent patterns:
- Props define variants, sizes, and optional accessibility attributes.
- Internal state handles interactive behaviors (e.g., password reveal, loading spinners).
- Haptic feedback integrates with Telegram WebApp for mobile touch interactions.
- Accessibility: roles, ARIA attributes, keyboard support for interactive elements.

```mermaid
classDiagram
class Button {
+variant : "primary|secondary|tertiary|emergency|ghost"
+size : "sm|md|lg"
+isLoading : boolean
+leftIcon : ReactNode
+rightIcon : ReactNode
+fullWidth : boolean
+haptic : "light"|...|false
+onClick(event)
}
class Card {
+variant : "workout|exercise|stats|info"
+title : string
+subtitle : string
+onClick() : void
+disableHover : boolean
+haptic : "light"|...|false
}
class Input {
+type : "text|number|password|search"
+label : string
+error : string
+helperText : string
+leftIcon : ReactNode
+rightIcon : ReactNode
+validationState : "default|error|success"
+fullWidth : boolean
+haptic : boolean
}
class ProgressBar {
+value : number
+max : number
+color : "primary|success|warning|danger|gradient"
+showLabel : boolean
+animated : boolean
+size : "sm|md|lg"
+labelFormat : "percent|value|fraction"
+customLabel : string
+hapticOnComplete : boolean
}
```

**Diagram sources**
- [Button.tsx:4-22](file://frontend/src/components/ui/Button.tsx#L4-L22)
- [Card.tsx:4-21](file://frontend/src/components/ui/Card.tsx#L4-L21)
- [Input.tsx:4-26](file://frontend/src/components/ui/Input.tsx#L4-L26)
- [ProgressBar.tsx:4-25](file://frontend/src/components/ui/ProgressBar.tsx#L4-L25)

**Section sources**
- [Button.tsx:1-184](file://frontend/src/components/ui/Button.tsx#L1-L184)
- [Card.tsx:1-175](file://frontend/src/components/ui/Card.tsx#L1-L175)
- [Input.tsx:1-301](file://frontend/src/components/ui/Input.tsx#L1-L301)
- [ProgressBar.tsx:1-225](file://frontend/src/components/ui/ProgressBar.tsx#L1-L225)

### State Management with Zustand
- Home store manages user health metrics, hydration goals, workout templates, and loading states. It includes a refresh action that simulates data fetching and updates last-updated timestamps.
- User store manages authentication state, loading, and errors with a logout action.
- Both stores use persistence to maintain small subsets of state across sessions.

```mermaid
flowchart TD
Start(["Refresh Data"]) --> SetRefreshing["Set isRefreshing = true"]
SetRefreshing --> CallMock["Call mock fetch"]
CallMock --> Success{"Fetch ok?"}
Success --> |Yes| MergeState["Merge returned data"]
MergeState --> UpdateTimestamp["Set lastUpdated now"]
UpdateTimestamp --> ResetRefresh["Set isRefreshing = false"]
Success --> |No| LogError["Log error"]
LogError --> ResetRefresh
ResetRefresh --> End(["Done"])
```

**Diagram sources**
- [homeStore.ts:180-193](file://frontend/src/stores/homeStore.ts#L180-L193)

**Section sources**
- [homeStore.ts:1-206](file://frontend/src/stores/homeStore.ts#L1-L206)
- [userStore.ts:1-31](file://frontend/src/stores/userStore.ts#L1-L31)

### Telegram WebApp Integration
Two hooks provide Telegram integration:
- useTelegram: minimal wrapper around the official SDK to configure UI and expose haptic feedback and main button helpers.
- useTelegramWebApp: comprehensive hook exposing the full Telegram WebApp API surface, including theme events, cloud storage, and UI controls.

```mermaid
sequenceDiagram
participant Comp as "Component"
participant Hook as "useTelegramWebApp"
participant WebApp as "Telegram.WebApp"
participant Haptics as "HapticFeedback"
Comp->>Hook : Initialize and subscribe to theme
Hook->>WebApp : ready(), setHeaderColor(), setBackgroundColor()
Comp->>Hook : hapticFeedback({type : 'impact'|'notification'|'selection'})
Hook->>Haptics : impactOccurred/notificationOccurred/selectionChanged
Comp->>Hook : showMainButton(text, onClick)
Hook->>WebApp : MainButton.setText()/show()
Comp->>Hook : cloudStorage.getItem(key)
Hook->>WebApp : CloudStorage.getItem()
WebApp-->>Hook : value
Hook-->>Comp : value
```

**Diagram sources**
- [useTelegramWebApp.ts:160-176](file://frontend/src/hooks/useTelegramWebApp.ts#L160-L176)
- [useTelegramWebApp.ts:200-216](file://frontend/src/hooks/useTelegramWebApp.ts#L200-L216)
- [useTelegramWebApp.ts:235-245](file://frontend/src/hooks/useTelegramWebApp.ts#L235-L245)
- [useTelegramWebApp.ts:404-426](file://frontend/src/hooks/useTelegramWebApp.ts#L404-L426)
- [telegram.ts:251-328](file://frontend/src/types/telegram.ts#L251-L328)

**Section sources**
- [useTelegram.ts:1-47](file://frontend/src/hooks/useTelegram.ts#L1-L47)
- [useTelegramWebApp.ts:1-509](file://frontend/src/hooks/useTelegramWebApp.ts#L1-L509)
- [telegram.ts:1-390](file://frontend/src/types/telegram.ts#L1-L390)

### API Services
The API service centralizes HTTP requests with:
- Base URL from environment variables
- Request interceptor adding Authorization header when present
- Response interceptor logging errors and propagating typed errors
- Convenience methods for GET, POST, PUT, DELETE

```mermaid
flowchart TD
Start(["API Call"]) --> BuildConfig["Build Axios config"]
BuildConfig --> AddToken["Add Bearer token if exists"]
AddToken --> Send["Send request"]
Send --> Resp{"Response ok?"}
Resp --> |Yes| ReturnData["Return data"]
Resp --> |No| LogError["Log error and reject"]
ReturnData --> End(["Done"])
LogError --> End
```

**Diagram sources**
- [api.ts:21-45](file://frontend/src/services/api.ts#L21-L45)
- [api.ts:47-65](file://frontend/src/services/api.ts#L47-L65)

**Section sources**
- [api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)

### Component Prop Interfaces and Event Handling Patterns
- Button: supports variants, sizes, icons, loading states, and haptic feedback. Uses forwardRef and merges Tailwind classes via a helper.
- Card: supports click handlers, haptic feedback, and accessibility roles for keyboard navigation.
- Input: supports validation states, left/right icons, password reveal, and ARIA attributes for labeling and error reporting.
- ProgressBar: supports animated fills, haptic feedback on completion, and multiple label formats.

Reusability guidelines:
- Prefer variant and size props to minimize duplication.
- Centralize styling with a class merging helper to avoid conflicts.
- Expose minimal, focused props; compose higher-order wrappers for domain-specific behaviors.

Accessibility considerations:
- Use ARIA attributes (aria-invalid, aria-describedby, role="progressbar") where applicable.
- Provide keyboard support for interactive elements (Enter/Space activation).
- Ensure sufficient color contrast and focus indicators.

**Section sources**
- [Button.tsx:1-184](file://frontend/src/components/ui/Button.tsx#L1-L184)
- [Card.tsx:1-175](file://frontend/src/components/ui/Card.tsx#L1-L175)
- [Input.tsx:1-301](file://frontend/src/components/ui/Input.tsx#L1-L301)
- [ProgressBar.tsx:1-225](file://frontend/src/components/ui/ProgressBar.tsx#L1-L225)
- [cn.ts:1-7](file://frontend/src/utils/cn.ts#L1-L7)

## Dependency Analysis
Key dependencies and their roles:
- Routing: react-router-dom for declarative navigation
- State: zustand for lightweight, typed stores with optional persistence
- UI: lucide-react for icons; Tailwind CSS for styling; clsx/tailwind-merge for class composition
- Networking: axios with interceptors
- Telegram: @telegram-apps/sdk-react and custom WebApp hook
- Querying: @tanstack/react-query for caching and optimistic updates

```mermaid
graph LR
RRD["react-router-dom"] --> APP["App.tsx"]
ZUSTAND["zustand"] --> HOMESTORE["homeStore.ts"]
ZUSTAND --> USERSTORE["userStore.ts"]
AXIOS["axios"] --> API["api.ts"]
REACTQUERY["@tanstack/react-query"] --> MAIN["main.tsx"]
TGLIGHT["@telegram-apps/sdk-react"] --> USETG["useTelegram.ts"]
TGWEBAPP["useTelegramWebApp.ts"] --> TYPES["telegram.ts"]
CLX["clsx + tailwind-merge"] --> CN["cn.ts"]
UI["UI Components"] --> UILIB["ui/index.ts"]
```

**Diagram sources**
- [App.tsx:1-10](file://frontend/src/App.tsx#L1-L10)
- [homeStore.ts:1-2](file://frontend/src/stores/homeStore.ts#L1-L2)
- [userStore.ts:1-2](file://frontend/src/stores/userStore.ts#L1-L2)
- [api.ts:1](file://frontend/src/services/api.ts#L1)
- [main.tsx:3](file://frontend/src/main.tsx#L3)
- [useTelegram.ts:1](file://frontend/src/hooks/useTelegram.ts#L1)
- [useTelegramWebApp.ts:1-13](file://frontend/src/hooks/useTelegramWebApp.ts#L1-L13)
- [telegram.ts:1-4](file://frontend/src/types/telegram.ts#L1-L4)
- [cn.ts:1-7](file://frontend/src/utils/cn.ts#L1-L7)
- [index.ts:1-25](file://frontend/src/components/ui/index.ts#L1-L25)

**Section sources**
- [App.tsx:1-35](file://frontend/src/App.tsx#L1-L35)
- [main.tsx:1-23](file://frontend/src/main.tsx#L1-L23)
- [homeStore.ts:1-206](file://frontend/src/stores/homeStore.ts#L1-L206)
- [userStore.ts:1-31](file://frontend/src/stores/userStore.ts#L1-L31)
- [api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)
- [useTelegram.ts:1-47](file://frontend/src/hooks/useTelegram.ts#L1-L47)
- [useTelegramWebApp.ts:1-509](file://frontend/src/hooks/useTelegramWebApp.ts#L1-L509)
- [telegram.ts:1-390](file://frontend/src/types/telegram.ts#L1-L390)
- [cn.ts:1-7](file://frontend/src/utils/cn.ts#L1-L7)
- [index.ts:1-25](file://frontend/src/components/ui/index.ts#L1-L25)

## Performance Considerations
- Use React Query for caching and background refetching to reduce network overhead.
- Persist only essential slices of state in stores to minimize local storage usage.
- Keep component props minimal and reuse variants to reduce re-renders.
- Defer non-critical UI updates (e.g., haptic feedback) to avoid blocking interactions.
- Lazy-load heavy pages or components when appropriate.

## Troubleshooting Guide
- Navigation not highlighting:
  - Verify NavLink paths match route paths and that the active class is applied conditionally.
- Telegram UI not updating:
  - Ensure WebApp is initialized and theme change listeners are attached.
- API errors:
  - Inspect response interceptor logs and ensure Authorization header is present when tokens are stored.
- Haptic feedback not triggering:
  - Confirm Telegram WebApp is available and HapticFeedback methods are supported.

**Section sources**
- [Navigation.tsx:17-33](file://frontend/src/components/common/Navigation.tsx#L17-L33)
- [useTelegramWebApp.ts:160-176](file://frontend/src/hooks/useTelegramWebApp.ts#L160-L176)
- [api.ts:35-44](file://frontend/src/services/api.ts#L35-L44)

## Conclusion
FitTracker Pro’s frontend leverages a clean, modular architecture with a strong design system, robust state management, and deep Telegram WebApp integration. The combination of route-driven pages, reusable UI components, and typed stores ensures maintainability and scalability. Following the documented patterns and guidelines will help preserve consistency and improve developer productivity.

## Appendices
- Responsive design:
  - Use Tailwind utilities for responsive breakpoints and adaptive spacing.
  - Test navigation and forms across device sizes; ensure touch targets meet minimum sizes.
- Accessibility:
  - Maintain ARIA attributes and keyboard navigation support.
  - Provide clear focus states and sufficient color contrast.