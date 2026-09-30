Calorie — Welcome + Login + 8 independent setup pages

Start
1. Extract the ZIP into one folder.
2. Open the folder in VS Code.
3. Right-click index.html and choose Open with Live Server.
4. Click Sign Up to open signup.html, or Login to open login.html.

Pages
index.html       Welcome (uses style.css and script.js)
signup.html      Step 1 of 8 — Username, email, password, confirmation
weight.html      Step 2 of 8 — kg / lb
height.html      Step 3 of 8 — cm / in
birthdate.html   Step 4 of 8 — Year / Month / Day
gender.html      Step 5 of 8 — Male / Female
activity.html    Step 6 of 8 — Activity Level
goal.html        Step 7 of 8 — Goal
diet.html        Step 8 of 8 — Preferred Diet
login.html       Login with Email and Password, plus password-reset view
login.css        Login styles; imports signup.css to preserve the shared design
login.js         Login validation, password eye toggle and reset view
signup.css       Shared styles for every step
signup.js        Shared behavior for every step

The logo is exactly the same inline SVG used by the supplied Welcome code.
All pages use Arial, Helvetica, sans-serif. No external fonts or image downloads.
Responsive layouts adapt at 900px and 560px. Mobile form fields use 16px text.
Number pickers support wheel, swipe, tap, arrow buttons and keyboard navigation.
Year, month and day use valid calendar dates, including leap years.
A unit switch preserves the canonical measurement, avoiding conversion drift.
Selections persist in sessionStorage for this browser tab; passwords never do.
Back/Next links preserve selections, and incomplete steps cannot be skipped.
The final page shows a summary; a dashboard is not included.

Preview vs real accounts
By default the frontend is in clearly labeled preview mode. It validates the
signup form and moves through the steps, but does not create a real account.
Duplicate email/username cannot be detected reliably by frontend-only code.
Duplicate-field messages are implemented for actual backend responses.
The first signup step is the only page requiring typed account credentials.
All later profile pages use selections rather than text entry.

Backend wiring
Edit CONFIG at the top of signup.js:
  registerUrl: "/api/auth/register"
  profileUrl: "/api/users/me/profile"
  loginUrl: "login.html"
  dashboardUrl: "dashboard.html"
Only assign routes after implementing them.
The backend must authenticate requests; the browser draft is only UI state.
Use secure HttpOnly session cookies, server-side validation and password hashing.
Set unique constraints for email and username in the database.

POST /api/auth/register receives:
  { "username": "mustafa", "email": "user@example.com", "password": "..." }
Success: HTTP 201 with JSON, and a session cookie.
Duplicate email: HTTP 409 { "code": "EMAIL_EXISTS" }
Duplicate username: HTTP 409 { "code": "USERNAME_EXISTS" }
Validation errors: HTTP 422 { "errors": { "email": "Please enter a valid email address." } }
Use errors objects for username, email, password or confirmPassword fields.
Messages must not contain database internals or sensitive information.

PUT /api/users/me/profile receives:
  {
    "weightKg": 63,
    "heightCm": 173,
    "dateOfBirth": "2006-01-01",
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "build-muscle",
    "dietaryPreference": "vegetarian",
    "preferredUnits": { "weight": "kg", "height": "cm" }
  }
Success: HTTP 200 with JSON.
On server errors, the current page keeps selections and offers retry.
If dashboardUrl is configured, successful live setup goes to that page.
For production deployments, serve the frontend and backend on the same origin,
or configure CORS, cookies and CSRF protections appropriately on the server.

Welcome integration
script.js now has signup: "signup.html".
script.js now has login: "login.html".
The Sign Up Login link also opens login.html.
Login links back to Sign Up and Welcome.

Validation performed
- JavaScript syntax checks
- Unit conversion preservation and picker bounds
- Leap years, month lengths and future-date constraints
- Signup required fields, email validity and password confirmation
- Duplicate email/username response handling and API errors
- Draft storage contains no passwords
- Eight page numbers, resource links, Back links and SVG syntax
A browser render was unavailable in this execution environment; visually check
with Live Server on your target devices before final project submission.

Login and password reset
At the top of login.js configure LOGIN_CONFIG:
  loginUrl: "/api/auth/login"
  forgotPasswordUrl: "/api/auth/forgot-password"
  dashboardUrl: "dashboard.html"
Default null means preview only: no real login and no email is sent.

POST /api/auth/login receives { "email": "user@example.com", "password": "..." }.
Successful HTTP 200/204 must set a secure HttpOnly session cookie.
HTTP 400/401/403 shows Incorrect email or password.
HTTP 429 shows a rate-limit message. Other errors allow retry.
Login credentials are never stored in localStorage or sessionStorage.

POST /api/auth/forgot-password receives { "email": "user@example.com" }.
The server should return the same HTTP success response whether or not the email
exists. The frontend displays a generic confirmation only after a real success.
The backend must generate, expire and verify reset tokens and send the email;
this frontend does not implement the email service or a new-password token page.

Login checks completed: required fields, email validity, password visibility,
reset-view navigation, preview feedback, mocked API success/failure responses,
rate limits, timeout errors, and existing Welcome/Sign Up link integration.
