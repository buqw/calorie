Calorie AI Assistant
====================
FILES
Place chatbot.html, chatbot.css and chatbot.js alongside dashboard.html, add-meal.html and history.html. Open chatbot.html with Live Server. The existing Dashboard, Meals and History scripts already route AI Assistant to chatbot.html. The exact leaf logo and sidebar are copied from the existing pages.

DEMO
CHAT_CONFIG.mode defaults to "mock". No backend is required to chat in demo mode. Suggestions send messages, Enter sends, Shift+Enter adds a line, and Thinking appears while a response loads. Responses and nutrition numbers are clearly marked as examples. They do not use real account data. Conversation is in memory and resets on reload. There is no OpenAI key, no direct OpenAI request, and no external AI SDK in the frontend.

BACKEND
Change CHAT_CONFIG.mode to "api" and set apiUrl to your backend URL (default /api/chat). If Live Server and the backend use different origins, provide the full backend URL and configure authentication/CORS on your backend. getHeaders and credentials should match your existing app authentication.
The request is:
POST /api/chat
Content-Type: application/json
{"message":"What should I eat for dinner?"}
For text-only messages, only the user's message is sent in the JSON body. No user profile, user ID, nutrition values, preferences or chat history is sent. The backend identifies the signed-in user via existing authentication, retrieves relevant account data from the database, and communicates with the AI. API secrets stay on the backend.
Expected proposed response:
{"success":true,"reply":"Your assistant response..."}
For errors use an appropriate status and optionally {"success":false,"message":"..."}. If your backend uses a different response shape, adapt requestReply's response mapping. Rendering uses plain text, so both user and backend messages cannot inject HTML.
Requests time out after 30 seconds. Empty messages are ignored, length is capped at 2,000 characters, simultaneous sends are blocked, failures retain the user bubble and offer Try again. Retrying does not duplicate the user bubble. Typing a draft during a pending request is allowed, but it cannot be sent until the current response completes.

LOGOUT
Set CHAT_CONFIG.logoutUrl to the existing POST logout endpoint. Redirect to login.html happens only after a successful response.

RESPONSIVE
Desktop sidebar becomes a compact navigation menu on tablet/mobile. Chat has its own scroll area, multiline input grows up to 120px, and the send icon retains an accessible label on small screens. Reduced-motion settings disable animated dots.

PHOTO ATTACHMENTS
The visible Upload meal photo file input opens a JPG/PNG/WebP picker (max 10 MB). A preview and Remove button appear before sending. Image-only and image-with-text messages are supported. The sent image appears in the user bubble. Retry retains the photo without duplicating the user message.
Demo mode displays the image but explicitly does not analyze its contents. Real photo suggestions require the backend and a vision-capable AI integration.
For photo messages, POST to the same apiUrl with multipart/form-data fields:
message: user text, possibly empty
image: the uploaded image file
Content-Type is supplied by the browser with its multipart boundary. Existing auth headers are preserved. The backend must support JSON text requests and multipart photo requests, validate the actual file content/size, authenticate the user, retrieve account context from the database, then process the photo with AI. Response remains {success:true,reply:"..."}. Adjust the proposed contract if your backend differs. No OpenAI key belongs in this frontend.

COMPOSER CONTROLS
The composer now matches the requested layout: message area above, Upload Image, Take Photo, Voice Input and Send underneath. Upload and camera controls use native transparent file inputs over styled labels. Take Photo requests the rear camera on supported mobile devices; desktop browsers may open the file picker. Voice Input uses SpeechRecognition when exposed by the browser; otherwise it shows an unsupported message. Microphone access may require a secure origin (HTTPS or localhost). Recognized words are placed in the editable draft and are not automatically sent. Browser speech services may process voice externally; the application backend still receives only the submitted text/image.
