# Requirements Document

## 1. Application Overview

**Application Name**: Trust Me AI Builder

**Application Description**: Complete AI-powered development platform enabling users to generate applications through natural language prompts, preview changes in real-time, automatically fix errors, publish live applications, discover apps in marketplace, earn referral rewards, and access student discounts.

## 2. Users and Usage Scenarios

### 2.1 Target Users
- Developers seeking rapid prototyping tools
- Students learning application development
- Non-technical users wanting to create applications
- Teams needing quick MVP deployment

### 2.2 Core Usage Scenarios
- Generate application from text prompt
- Preview and iterate on live changes
- Publish application to public URL
- Update existing published applications
- Discover and clone applications from marketplace
- Refer friends to earn credits
- Verify student status for discounts
- Upload files (images, documents, code) for AI analysis
- Screenshot-based development and debugging
- One-click re-deploy to update live applications

## 3. Page Structure and Functionality

### Page Hierarchy
```
Trust Me AI Builder
├── Main Workspace
│   ├── Top Bar
│   ├── Left Panel (AI Agent Workspace)
│   ├── Center Panel (Live Preview)
│   └── Right Panel (Changes & Deploy)
├── Marketplace
│   ├── App Listing
│   └── App Details Page
├── User Dashboard
├── Pricing Page
├── Student Verification Page
└── Referral System
```

### 3.1 Main Workspace

#### 3.1.1 Top Bar
- Left: Trust Me AI Builder logo and branding
- Center: Tab switcher (Preview / Code / History)
- Right: 
  - Publish button (initial state) or Update button (after first publish)
  - Status indicators: AI Ready, Build Complete, Deployment Ready

#### 3.1.2 Left Panel — AI Agent Workspace
- **Prompt Input Area**: Textarea with send button
- **File Upload Section**:
  - Upload button with file type icons
  - Drag and drop zone
  - Mobile file picker support
  - Supported file types:
    - Images: JPG, PNG, WEBP
    - Documents: PDF, DOCX, TXT
    - Code Files: .js, .ts, .tsx, .py, .css, .html, etc.
    - ZIP Projects
  - Multiple file upload simultaneously
  - File preview thumbnails
- **Uploaded Files Panel**:
  - Files list with file name, type, size
  - Images panel showing image thumbnails
  - Documents panel showing document icons
  - Search files functionality
  - Preview uploaded files inline
  - Delete file option
- **AI Chat History**: Display user messages and AI responses with streaming effect
- **Task Progress Display**: Animated step indicators
  - Analysis
  - Task Breakdown
  - Code Generation
  - Preview Update
  - Error Detection
  - Auto Fix
  - Publish Ready
- **Build Logs**: Terminal-style scrollable output with real-time updates
- **Error Fix Messages**: Auto-fix notifications and resolution status
- **AI Suggestions**: Quick prompt chips and clickable suggestion buttons

#### 3.1.3 Center Panel — Live Preview
- Iframe-based preview area with auto-refresh on code changes
- Device Switcher: Desktop / Tablet / Mobile modes with instant width adjustment
- Reload button

#### 3.1.4 Right Panel — Changes & Deploy
- **Changes Tab**:
  - Files Modified List: Display file names with change indicators
  - Code Changes: Diff-style display highlighting additions and deletions
  - AI Analysis Summary: Brief description of changes
  - Errors Fixed Log: List of automatically fixed errors
  - Version History: List of past builds with timestamps
- **Deploy Tab**:
  - Deployment Logs: Deployment status and history
  - Re-deploy Button: One-click button to overwrite existing deployment with latest preview HTML
  - Deployment Progress: Progress bar and status messages
  - Live URL Display: Show current deployment URL

#### 3.1.5 AI Generation Workflow
- User submits prompt
- AI analyzes prompt and identifies project type, pages, features, database needs, authentication requirements
- AI creates project plan with task breakdown
- AI generates code for identified components
- AI validates generated code
- AI auto-fixes detected errors
- Live preview displays generated application
- Display project analysis, task breakdown, files created, errors fixed, credits used

#### 3.1.6 AI File Understanding Workflow
- **Image Upload**:
  - User uploads UI screenshot or error screenshot
  - AI detects UI elements, layout, colors, components
  - User provides instruction (e.g., \"Add this button\", \"Change this color\", \"Fix this UI\", \"Make it responsive\")
  - AI generates exact code changes based on screenshot analysis
  - AI updates preview with changes
- **Document Upload**:
  - User uploads PDF, DOCX, TXT
  - AI reads and extracts content
  - AI summarizes document
  - AI answers questions about document content
- **Code File Upload**:
  - User uploads .js, .ts, .tsx, .py, .css, .html, etc.
  - AI reads project structure
  - AI finds bugs and errors
  - AI generates fixes and refactoring suggestions
  - AI generates code patches
- **ZIP Project Upload**:
  - User uploads ZIP file
  - AI extracts and inspects project structure
  - AI analyzes codebase
  - AI provides insights and suggestions
- **Screenshot-Based Development**:
  - User uploads screenshot with message like \"Add dark mode\"
  - AI understands screenshot layout and structure
  - AI generates exact implementation code
  - User uploads error screenshot
  - AI reads error message, understands root cause
  - AI generates fix and applies changes
- **AI Response Format**:
  - Analysis: What AI detected in uploaded file
  - Root Cause: Problem identification (if applicable)
  - Files To Modify: List of files to change
  - Exact Code Changes: Code diff or patches
  - Implementation Steps: Step-by-step execution plan
- **AI Memory**:
  - Remember uploaded files during session
  - Reference previous uploads in conversation context
  - Maintain file context across multiple prompts

#### 3.1.7 Auto Error Fix System
- Error Detection: Identify issues in generated code
- Error Analysis: Determine root cause and fix strategy
- Automatic Fix: Apply corrections to code
- Rebuild: Regenerate affected components
- Retest: Validate fixes
- Preview Refresh: Update live preview
- Display: Show error type, fix applied, build status

#### 3.1.8 Publish System
- Publish Button Action:
  - Build project
  - Validate code
  - Deploy to hosting
  - Generate public URL (apps.trustmeai.com/project-id)
  - Save deployment record
  - Display success modal with:
    - App Published Successfully message
    - Copy Link button
    - Open App button
    - Update Existing App button
  - Change button state from Publish to Update
- Published app requirements:
  - Accessible in all browsers
  - Mobile and desktop compatible
  - Publicly accessible
  - Fast loading

#### 3.1.9 Update System
- For published projects, display Update & Publish button
- Update Action:
  - Save changes
  - Rebuild project
  - Redeploy to same URL
  - Update live application
  - Maintain existing public URL

#### 3.1.10 Re-deploy System
- Re-deploy Button in Deploy Panel
- Re-deploy Action:
  - Overwrite existing deployment with latest preview HTML
  - Show deployment progress bar
  - Display deployment logs in real-time
  - Update live URL after re-deploy completes
  - Maintain same public URL
  - Show success notification

### 3.2 Marketplace

#### 3.2.1 App Listing Page
- Categories:
  - Featured Apps
  - Trending Apps
  - New Apps
  - Most Viewed
  - Most Liked
- App Card Display:
  - App name
  - Creator name
  - Description
  - Category
  - Thumbnail image
  - View count
  - Like count
  - Open App button

#### 3.2.2 App Details Page
- Live Preview: Embedded preview of application
- App Information:
  - Description
  - Creator name
  - Publish date
  - View count
  - Like count
- Action Buttons:
  - Open App: Launch application in new tab
  - Like: Increment like count
  - Share: Share application link
  - Clone: Copy application to user's workspace

### 3.3 User Dashboard

#### 3.3.1 Dashboard Sections
- Projects: List of user's projects
- Published Apps: List of deployed applications
- Credits: Current credit balance and usage history
- Deployments: Deployment history and status
- Statistics:
  - Total views across published apps
  - Total likes received
- Referrals: Referral link and rewards earned
- Student Status: Verification status and discount eligibility

### 3.4 Pricing Page

#### 3.4.1 Premium Animated Banner
- Position: Floating banner above pricing cards
- Content: STUDENT SPECIAL OFFER
- Benefits Display:
  - 50% OFF on all plans
  - Bonus Credits
  - Student Badge
  - Priority Support
  - Exclusive Templates
- Animations: Glow pulse, floating particles, gradient border, hover zoom, sparkle effects, fade-in

#### 3.4.2 Student Verification Button
- Label: Verify Student Status
- Visual Effects: Glow border, ripple click, scale on hover, gradient transition

#### 3.4.3 Pricing Cards
- Basic Plan: ₹299
- Medium Plan: ₹999
- Gold Plan: ₹1999
- Platinum Plan: ₹4999
- All existing colors, gradients, animations, layouts preserved

#### 3.4.4 Enhanced Pricing Cards (For Verified Students)
- Display original price with strikethrough
- Show student discounted price:
  - Basic Plan: ₹299 → ₹149 (Save ₹150)
  - Medium Plan: ₹999 → ₹499 (Save ₹500)
  - Gold Plan: ₹1999 → ₹999 (Save ₹1000)
  - Platinum Plan: ₹4999 → ₹2499 (Save ₹2500)
- Show STUDENT OFFER badge
- Display You Save ₹X message
- Animations: Number counting, badge glow, hover elevation, gradient shimmer

#### 3.4.5 Founder Image
- Display image from: https://miaoda-conversation-file.s3cdn.medo.dev/user-85ne2d90sv0g/app-cnl3z6hzzs3l/20260629/Screenshot_20260629_094638.jpg

### 3.5 Student Verification Page

#### 3.5.1 Input Fields
- Full Name
- College Name
- Department
- Year
- Student ID Number
- College Email
- Mobile Number

#### 3.5.2 Upload Fields
- Student ID Card Front (image file)
- Student ID Card Back (image file)
- Supporting Document (image or pdf file)

#### 3.5.3 Submit Action
- Submit verification request
- Store uploaded files in Supabase Storage bucket: student-verification
- Store form data in Supabase Database table: student_verifications

#### 3.5.4 Verification Status Display
- Pending Status: Show Verification Pending message with submission timestamp
- Approved Status:
  - Show animated success screen: Verification Approved
  - Benefits Display: 50% Discount Applied, Student Badge Activated, Bonus Credits Added, Priority Support Enabled
  - Animations: Confetti burst, floating particles, success glow ring, badge pop, credit counter
- Rejected Status: Show rejection message with reviewer notes if available

### 3.6 Referral System

#### 3.6.1 Referral Link
- Format: trustmeai.com/ref/{user_id}
- Display in User Dashboard
- Copy link functionality

#### 3.6.2 Referral Rewards
- Friend signup: Referrer receives +45 credits, new user receives +10 credits
- Friend first deployment: Referrer receives +5 credits
- Friend first paid plan purchase: Referrer receives +50 credits
- Unlimited referrals allowed

#### 3.6.3 Referral Tracking
- Track referral source via URL parameter
- Record referral relationship in database
- Update credit balances upon qualifying events
- Display referral statistics in User Dashboard

### 3.7 Admin Dashboard

#### 3.7.1 Student Verification Management
- View all verification requests
- Display student information and uploaded documents
- Approve or reject verification
- Add reviewer notes
- Assign bonus credits
- Modify discount percentage

## 4. Business Rules and Logic

### 4.1 AI Generation System

#### 4.1.1 Prompt Analysis
- Analyze user prompt to identify:
  - Project type (web app, tool, game, etc.)
  - Required pages and components
  - Features and functionality
  - Database requirements
  - Authentication needs

#### 4.1.2 Code Generation Process
- Create project plan based on analysis
- Generate code for identified components
- Validate generated code
- Auto-fix detected errors
- Update live preview
- Track credits used for generation

#### 4.1.3 Error Handling
- Detect syntax errors, runtime errors, build failures
- Analyze error cause
- Generate and apply fix
- Rebuild affected components
- Retest and validate
- Update preview
- Log error and fix details

### 4.2 AI File Understanding System

#### 4.2.1 Image Analysis
- Detect UI elements, layout, colors, components from screenshots
- Identify error messages from error screenshots
- Generate code changes based on user instructions and screenshot analysis
- Apply changes to codebase and update preview

#### 4.2.2 Document Processing
- Extract text content from PDF, DOCX, TXT files
- Summarize document content
- Answer user questions about document
- Reference document content in conversation context

#### 4.2.3 Code File Analysis
- Parse code structure and syntax
- Identify bugs, errors, code smells
- Generate fixes and refactoring suggestions
- Create code patches for identified issues

#### 4.2.4 ZIP Project Inspection
- Extract ZIP contents
- Analyze project structure and dependencies
- Identify entry points and key files
- Provide codebase insights

#### 4.2.5 File Memory Management
- Store uploaded files in session context
- Maintain file references across conversation
- Allow AI to reference previous uploads in responses

### 4.3 Publishing System

#### 4.3.1 Publish Flow
- Build project files
- Validate code integrity
- Deploy to hosting infrastructure
- Generate unique public URL
- Save deployment record with timestamp
- Update project status to published
- Change Publish button to Update button

#### 4.3.2 Update Flow
- For published projects only
- Save code changes
- Rebuild project
- Redeploy to existing URL
- Update deployment record
- Maintain same public URL

#### 4.3.3 Re-deploy Flow
- Triggered by Re-deploy button in Deploy Panel
- Overwrite existing deployment with latest preview HTML
- Show deployment progress in real-time
- Display deployment logs
- Update live URL after completion
- Maintain same public URL
- Show success notification

### 4.4 Marketplace System

#### 4.4.1 App Visibility
- Published apps automatically appear in marketplace
- Apps categorized by type and popularity
- Display apps in Featured, Trending, New, Most Viewed, Most Liked sections

#### 4.4.2 App Interactions
- View count increments when user opens app details
- Like count increments when user clicks like button
- Clone creates copy of app in user's workspace
- Share generates shareable link

### 4.5 Referral System

#### 4.5.1 Referral Link Generation
- Generate unique referral link for each user: trustmeai.com/ref/{user_id}
- Track referral source when new user signs up via referral link

#### 4.5.2 Reward Distribution
- Friend signup: Award +45 credits to referrer, +10 credits to new user
- Friend first deployment: Award +5 credits to referrer
- Friend first paid plan: Award +50 credits to referrer
- Update credit balances in real-time
- Record reward transactions in database

#### 4.5.3 Abuse Prevention
- Prevent self-referrals (user cannot refer themselves)
- Prevent duplicate rewards (same event cannot trigger reward twice)
- Validate referral relationships before awarding credits

### 4.6 Student Discount System

#### 4.6.1 Discount Application
- Verified students receive 50% OFF on all plans
- Discount applies automatically when verification_status = approved
- Display original price, discount, student price, savings amount

#### 4.6.2 Verification Status Flow
- User submits verification → status = pending
- Admin approves → status = approved, discount activated
- Admin rejects → status = rejected, user can resubmit

### 4.7 Data Storage

#### 4.7.1 Supabase Database Tables
- profiles: User profile information
- projects: User projects and code
- deployments: Deployment records and URLs
- marketplace_apps: Published apps metadata
- app_views: App view tracking
- app_likes: App like tracking
- student_verifications: Student verification requests and status
- referrals: Referral relationships
- referral_rewards: Reward transaction history
- uploaded_files: Uploaded file metadata and references

#### 4.7.2 Supabase Storage
- Bucket: student-verification (Store: Student ID Card Front, Student ID Card Back, Supporting Document)
- Bucket: workspace-files (Store: User uploaded images, documents, code files, ZIP projects)

#### 4.7.3 Supabase Features
- Enable Row Level Security (RLS) on all tables
- Enable Realtime for live updates
- Configure Storage policies for file access

### 4.8 Credit System

#### 4.8.1 Credit Usage
- AI generation consumes credits based on complexity
- Display credits used for each generation
- Track credit balance in user profile

#### 4.8.2 Credit Earning
- Referral rewards add credits to balance
- Student verification bonus adds credits
- Paid plan purchases add credits

## 5. Exceptions and Edge Cases

| Scenario | Handling |
|----------|----------|
| AI generation fails | Show error message, allow retry, preserve user prompt |
| Preview iframe fails to load | Show error message, provide reload button |
| Code contains syntax errors | Auto-fix system detects and corrects automatically |
| Network error during AI request | Show error message, preserve conversation history, allow retry |
| Publish action fails | Show error message, maintain Publish button state, allow retry |
| Deployment URL generation fails | Retry with new URL, log error |
| User switches device mode during preview update | Complete current update, then apply device mode change |
| User submits verification without all required files | Show validation error, prevent submission |
| User submits with invalid email format | Show validation error for email field |
| File upload fails | Show error message, allow retry |
| User already has pending verification | Show existing verification status, prevent duplicate submission |
| User verification is rejected | Allow resubmission with corrected information |
| User attempts self-referral | Block referral, show error message |
| Duplicate referral reward attempt | Prevent duplicate reward, log attempt |
| User has insufficient credits for generation | Show insufficient credits message, prompt to purchase credits |
| Marketplace app fails to load | Show error message, provide retry option |
| Clone operation fails | Show error message, allow retry |
| Like/view count update fails | Retry update, log error if persistent |
| User accesses pricing page without login | Show normal pricing without student discount option |
| File upload exceeds size limit | Show error message with size limit information |
| Unsupported file type uploaded | Show error message listing supported file types |
| AI fails to analyze uploaded file | Show error message, allow retry |
| Multiple files uploaded simultaneously fail | Show individual error messages for each failed file |
| Drag and drop fails on mobile | Fallback to file picker |
| Re-deploy button clicked during active deployment | Disable button, show \"Deployment in progress\" message |
| Re-deploy fails | Show error message, allow retry, preserve previous deployment |
| Uploaded file preview fails | Show file icon with file name instead |
| ZIP extraction fails | Show error message, suggest re-uploading |
| AI memory exceeds session limit | Prioritize recent uploads, archive older files |

## 6. Acceptance Criteria

1. User opens Main Workspace and sees 3-panel layout with Top Bar, Left Panel (AI Agent Workspace with file upload section), Center Panel (Live Preview), Right Panel (Changes & Deploy)
2. User clicks upload button or drags image file into upload zone, file uploads successfully, thumbnail appears in uploaded files panel
3. User types \"Fix the button alignment\" with uploaded UI screenshot, AI analyzes screenshot, generates code changes, updates preview
4. User uploads error screenshot, AI reads error message, identifies root cause, generates fix, applies changes automatically
5. User uploads PDF document, AI extracts content, user asks question about document, AI answers based on document content
6. User uploads .js code file, AI detects bugs, generates fix suggestions, user approves fix, AI applies changes
7. User uploads ZIP project, AI inspects project structure, provides codebase insights
8. User switches to Deploy tab in Right Panel, sees Re-deploy button, clicks Re-deploy button
9. Deployment progress bar appears, deployment logs display in real-time, live URL updates after re-deploy completes
10. User opens Marketplace and sees Featured Apps, Trending Apps, New Apps with app cards showing name, creator, thumbnail, views, likes
11. User opens User Dashboard and sees projects, published apps, credits, deployments, views, likes, referrals, student status
12. User copies referral link from dashboard, friend signs up via link, user receives +45 credits, friend receives +10 credits

## 7. Out of Scope for This Release

- AI model training or fine-tuning capabilities
- Collaborative editing with multiple users
- Version control integration with Git
- Custom AI model selection
- Code export to external repositories
- Advanced debugging tools
- Performance profiling dashboard
- Automated testing framework
- CI/CD pipeline integration
- Custom domain mapping for published apps
- White-label branding options
- API access for external integrations
- Automatic verification through third-party education verification services
- Bulk verification upload for institutions
- Student verification expiration and renewal system
- Integration with external student database systems
- Multi-language support for verification form
- Email notifications for verification status changes
- Student referral program
- Analytics dashboard for student conversion rates
- A/B testing framework for pricing display variations
- Integration with payment gateway for automatic discount application
- Student community features or forums
- Verification appeal process for rejected applications
- Advanced marketplace filtering and search
- App rating and review system
- Monetization options for app creators
- Private app publishing
- Team collaboration features
- Advanced credit management and billing
- Webhook integrations
- Custom deployment configurations
- Advanced error reporting and monitoring
- Performance optimization tools
- SEO optimization for published apps
- Analytics for published apps
- Custom branding for published apps
- Advanced user role management
- Audit logs for admin actions
- File version control for uploaded files
- Batch file processing
- OCR for scanned documents
- Audio/video file upload and analysis
- Real-time collaborative file editing
- File encryption and security scanning
- Advanced file search with filters
- File tagging and categorization
- Automatic file backup and recovery
- Integration with cloud storage services
- File sharing with external users