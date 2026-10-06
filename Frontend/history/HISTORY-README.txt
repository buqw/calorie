Calorie History
==============
Put history.html, history.css and history.js in the SAME directory as dashboard.html and add-meal.html. Open history.html with Live Server.
The existing Dashboard History and View meals links already point to history.html. The sidebar Dashboard points to dashboard.html; Meals and Add Meal point to add-meal.html. The exact inline leaf logo is copied from Dashboard.

API SETUP
Edit HISTORY_API at the top of history.js:
historyUrl: your GET history endpoint
logoutUrl: your POST logout endpoint
getHeaders: the same authentication headers as the other pages
credentials: include (cookie-based auth; adjust to your backend)
No API key belongs in this frontend.

The endpoint contract below is proposed because your actual history response was not supplied. Adapt normalizeResponse if it differs.
GET historyUrl?from=<ISO timestamp>&to=<ISO timestamp>
Last 7 Days includes today and the preceding 6 local calendar days. Last 30 Days includes today and the preceding 29. All History omits from. to is the end of today in the user's local timezone. The frontend also filters returned meals to that range.
The backend must return all matching meals, not only the first pagination page. Add pagination/loading if your backend paginates.

Expected JSON:
{
  "success": true,
  "meals": [
    {
      "name": "Eggs and toast",
      "mealType": "breakfast",
      "createdAt": "2026-10-06T05:30:00.000Z",
      "ingredients": [{"name": "Eggs"}, {"name": "Bread"}, {"name": "Coffee"}],
      "nutrition": {"calories": 520, "protein": 30, "carbs": 55, "fat": 20}
    }
  ]
}
Ingredients may alternatively be strings, e.g. ["Eggs", "Bread"]. They are optional for meals entered By Nutrition or By Photo. Only returned ingredients are displayed.
Use the server-created timestamp createdAt (loggedAt also supported), including Z or an explicit timezone offset. It is converted to the device timezone for day grouping and time labels. No manually entered date/time is added to meal logging.
Nutrition values must be nonnegative JSON numbers, in kcal and grams. Missing/invalid nutrition values show a dash, not an invented zero. A day total shows a dash when any meal's calories are unavailable.
Use {"success":true,"meals":[]} for no meals. Errors may return {"success":false,"message":"..."} with the appropriate HTTP status.

Each day expands/collapses independently using native HTML details/summary with keyboard support. No Bootstrap JavaScript is required. The newest day opens initially. Days sort newest first and meals sort by time within each day. The page has no demo data; it loads your saved meals from the API.
