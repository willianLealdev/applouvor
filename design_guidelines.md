# Design Guidelines: Worship Music Management Platform

## Design Approach

**Selected Framework**: Design System Approach using **Linear** + **Notion** hybrid principles

**Justification**: This is a utility-focused productivity tool where efficiency, clarity, and quick access to information are paramount. Musicians and worship leaders need distraction-free interfaces that work flawlessly during time-sensitive rehearsals and services.

**Key Design Principles**:
- Clarity over decoration
- Fast navigation between services and songs
- Clear role-based information hierarchy
- Mobile-first for on-stage use

---

## Typography System

**Font Stack**: 
- Primary: Inter (Google Fonts) - for UI, navigation, labels
- Content: System UI stack - for lyrics and chord displays (maximum readability)

**Hierarchy**:
- Page titles: text-2xl, font-semibold
- Section headers: text-lg, font-medium  
- Body text: text-base, font-normal
- Lyrics display: text-lg to text-xl (larger for readability on stage)
- Chord notation: text-sm, font-mono, positioned above lyrics
- Metadata/labels: text-sm, font-medium

---

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, and 16

**Grid Structure**:
- Two-column dashboard layout (sidebar + main content)
- Sidebar: Fixed 64 width (w-64) on desktop, collapsible on mobile
- Main content: max-w-6xl with px-6 to px-8 padding
- Card spacing: gap-4 to gap-6 in grids
- Section spacing: py-8 to py-12

---

## Component Library

### Navigation & Layout

**Sidebar Navigation** (Leader & Member Views):
- Vertical menu with clear sections
- Active state highlighting
- Icons from Heroicons (outline style)
- Collapsible on mobile with hamburger menu
- Sections: Dashboard, Services, Song Library, Members (leader only), My Profile

**Top Bar**:
- Service selector dropdown (quick switch between upcoming services)
- Search bar for songs
- User profile menu
- Notification bell for new service assignments

### Core Components

**Service Planning Interface** (Leader View):
- Calendar view showing upcoming services
- Service card with date, time, type
- Drag-and-drop song list with reorder capability
- Add song button opens modal with search/import
- Each song row shows: title, artist, key, duration, action menu (edit key, remove)

**Song Display Card** (Member View):
- Clean, distraction-free layout
- Song metadata header: title, artist, original key, current key
- Toggle between "Chords & Lyrics" (musicians) and "Lyrics Only" (singers)
- Scroll-friendly with ample line-height (1.8 for lyrics)
- Transpose controls: +/- buttons, key selector dropdown
- Fullscreen mode for performance

**Song Library**:
- Grid of song cards (3 columns on desktop, 1 on mobile)
- Each card: thumbnail, title, artist, tags, last used date
- Search and filter bar at top
- Import song button (prominent, primary action)

**User Management Table** (Leader Only):
- Clean table with columns: name, email, role, status, actions
- Invite button sends email invitation
- Role badges (Musician/Singer) with distinct visual treatment
- Inline edit for role changes

**Import Song Modal**:
- Search input for internal database
- Results list with preview
- External import section (Cifra Club integration)
- Preview pane showing formatted lyrics/chords before saving

### Form Elements

**Inputs**: 
- Consistent h-10 to h-12 height
- Rounded borders (rounded-md)
- Focus states with ring-2
- Labels above inputs (text-sm, font-medium, mb-2)

**Buttons**:
- Primary: px-4 to px-6, py-2 to py-3, rounded-md, font-medium
- Secondary: outlined variant with border-2
- Icon buttons: square aspect ratio, p-2
- Loading states with spinner

**Dropdowns/Selects**:
- Custom styled to match input heights
- Clear visual feedback on open state
- Keyboard navigable

---

## Key User Flows

**Leader Dashboard**:
- Quick access to next 3 upcoming services
- Recent songs added to library
- Team member status overview
- Quick action buttons: Create Service, Add Song, Invite Member

**Member Dashboard**:
- Assigned services list (upcoming first)
- "Practice Mode" for each service (shows all songs in sequence)
- Personal song library favorites

**Service Detail Page**:
- Header with service info and edit button (leader)
- Song list with expandable view for each song
- Side panel for service notes/announcements
- Print/Export options

**Song View (Performance Mode)**:
- Fullscreen, minimal UI
- Large, readable text
- Auto-scroll option with speed control
- Quick transpose without leaving view
- Swipe between songs in service order

---

## Responsive Behavior

**Desktop (lg+)**: Full sidebar, multi-column layouts, hover states
**Tablet (md)**: Collapsible sidebar, 2-column max grids
**Mobile (base)**: Bottom navigation bar, single column, touch-optimized controls (larger tap targets: min-h-12)

---

## Images

**No large hero images** - This is an application dashboard, not a marketing site.

**Icon Usage**: Heroicons throughout for consistency (music note, calendar, users, settings, search, etc.)

**Avatar Placeholders**: User initials in colored circles for team members without photos

**Empty States**: Simple illustrations or icons with helpful text when no data exists (e.g., "No services scheduled", "Song library is empty")