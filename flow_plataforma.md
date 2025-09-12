### **The Architecture: A High-Level Overview**

The system we built is a **decoupled application**.
*   The **Frontend** (HTML, CSS, JavaScript) is a "static site" hosted on GitHub Pages. It contains no business logic; its only job is to display data and send user input.
*   The **Backend** (Django, DRF) is a "headless" API hosted on Render. Its only job is to manage data, enforce business rules, and respond to requests with JSON.

They are two separate applications that communicate exclusively through the API. This is a modern, professional, and scalable architecture.

---

### **Flow 1: The "Read" Operation - Viewing the Inventory**

This is the complete sequence of events that happens when a user first loads the application.

#### **Step 1: The Browser Loads the Frontend**

The user navigates to your GitHub Pages URL. The browser downloads and reads `index.html`. This file is the skeleton of the application. The most important line is at the very bottom:

```html
<!-- index.html -->
<!-- Our custom JavaScript -->
<script src="script.js"></script>
```

This tells the browser to download and execute our `script.js` file. The script waits for the entire HTML document to be ready before it runs, thanks to this wrapper:

```javascript
// script.js
document.addEventListener('DOMContentLoaded', () => {
    // ... all our code is inside here
});
```

#### **Step 2: The JavaScript Initializes and Makes API Calls**

As soon as the page is ready, the script immediately calls two functions to fetch the necessary data from our live backend. These requests happen at the same time (asynchronously) to make the application load faster.

```javascript
// script.js
// --- INITIALIZATION ---
fetchAndPopulateTable();
fetchAndPopulateDropdowns();
```

Let's trace one of these calls, `fetchAndPopulateTable`. The function begins by showing a loading spinner and then makes a `GET` request to our API endpoint using the browser's `fetch` API.

```javascript
// script.js
const API_BASE_URL = 'https://oldtree-api.onrender.com'; // Your live backend URL

const fetchAndPopulateTable = async () => {
    showLoading(true); // Shows the spinner
    try {
        // This is a network request to our live Django API
        const response = await fetch(`${API_BASE_URL}/api/stock-levels/`);
        // ...
```

#### **Step 3: The Backend Receives the Request**

The request travels over the internet to our Render server. The Django application receives it and uses its URL configuration to figure out what to do.

First, the main project router (`oldtree_project/urls.py`) sees that the URL starts with `/api/` and passes the request to our app's router.

```python
# oldtree_project/urls.py
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('stock_api.urls')), // <-- Hands off to the app
]
```

Next, the app router (`stock_api/urls.py`) matches `/stock-levels/` to the `StockLevelViewSet`.

```python
# stock_api/urls.py
router = DefaultRouter()
router.register(r'stock-levels', StockLevelViewSet, basename='stocklevel')
```

This directs the request to the `StockLevelViewSet` in our `views.py` file. This view is the "brain" for this request. It performs two actions:
1.  It queries the database for all `StockLevel` objects.
2.  It uses the `StockLevelSerializer` to translate these objects into JSON.

```python
# stock_api/views.py
class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    # 1. This queryset gets all stock levels from the PostgreSQL database.
    #    .select_related() is a performance optimization.
    queryset = StockLevel.objects.select_related('product_variant', 'location', 'product_variant__product').all()
    
    # 2. This tells DRF to use our serializer to format the data.
    serializer_class = StockLevelSerializer
```

The `StockLevelSerializer` is the "translator." It takes the raw data from the database and formats it into clean, nested JSON, which is perfect for our frontend.

```python
# stock_api/serializers.py
class StockLevelSerializer(serializers.ModelSerializer):
    # These lines tell the serializer to include the full details
    # of the variant and location, not just their IDs.
    product_variant = ProductVariantSerializer(read_only=True)
    location = LocationSerializer(read_only=True)

    class Meta:
        model = StockLevel
        fields = ['id', 'product_variant', 'location', 'quantity']
```

The final result is a JSON response sent back across the internet to the user's browser.

#### **Step 4: The Frontend Renders the Received Data**

Back in `script.js`, the `await` is resolved, and the `response` is received. The script parses the JSON and then loops through it to dynamically build the HTML for the table.

```javascript
// script.js (inside fetchAndPopulateTable)
const stockLevels = await response.json(); // Parse the JSON data

stockTableBody.innerHTML = ''; // Clear the table first

if (stockLevels.length === 0) {
    showEmptyState(true); // Show a "No data" message
} else {
    // Loop through each item in the data array
    stockLevels.forEach(item => {
        // Create an HTML table row using the data
        const row = `
            <tr>
                <td>${item.product_variant.product_name}</td>
                <td><small class="text-muted">${item.product_variant.size} / ${item.product_variant.color}</small></td>
                <td>${item.location.name}</td>
                <td class="text-end fw-bold">${item.quantity}</td>
            </tr>
        `;
        // Add the new row to the table in the HTML
        stockTableBody.innerHTML += row;
    });
}
```At this point, the loading spinner is hidden, and the user sees the fully populated stock table. The exact same flow happens for `fetchAndPopulateDropdowns` to fill the form.

---

### **Flow 2: The "Write" Operation - Registering a Stock Movement**

This is the core functional flow of the application, triggered when the user submits the form.

#### **Step 1: The User Submits the Form**

A JavaScript event listener is waiting for the user to click the submit button.

```javascript
// script.js
movementForm.addEventListener('submit', handleFormSubmit);
```

When the form is submitted, the `handleFormSubmit` function immediately runs. Its first and most important job is to stop the browser from doing a default page refresh.

```javascript
// script.js
const handleFormSubmit = async (event) => {
    event.preventDefault(); // Prevents the page from reloading
    // ...
```

#### **Step 2: The Frontend Packages and Sends the Data**

The function then gathers the data from the form inputs, structures it into a JavaScript object, and sends it to the backend as a `POST` request.

```javascript
// script.js (inside handleFormSubmit)
const formData = new FormData(movementForm);
const data = {
    product_variant: formData.get('product_variant'),
    location: formData.get('location'),
    quantity_change: formData.get('quantity_change'),
    notes: formData.get('notes'),
};

try {
    const response = await fetch(`${API_BASE_URL}/api/stock-movements/`, {
        method: 'POST', // Specifies this is a "write" operation
        headers: {
            'Content-Type': 'application/json', // Tells the server we are sending JSON
        },
        body: JSON.stringify(data), // Converts the JS object to a JSON string
    });
    // ...
```

#### **Step 3: The Backend Receives and Processes the Data**

The Django backend receives this `POST` request. The URL routing directs it to our `StockMovementCreateView`.

```python
# stock_api/urls.py
urlpatterns = [
    // ...
    path('stock-movements/', StockMovementCreateView.as_view(), name='create-stock-movement'),
]
```

This view is a `CreateAPIView`, specifically designed to handle the creation of new objects. It uses the `StockMovementSerializer` to validate the incoming JSON. If any data is missing or incorrect, it automatically sends back an error.

If the data is valid, Django REST Framework calls the `.save()` method. This is where we inserted our core business logic.

#### **Step 4: The Core Business Logic Executes**

Instead of a normal save, our custom `save()` method in the `StockMovement` model is executed. This is the heart of the entire application.

```python
# stock_api/models.py
class StockMovement(models.Model):
    # ... fields ...

    def save(self, *args, **kwargs):
        # 1. Start a database transaction. If any step fails, everything is rolled back.
        with transaction.atomic():
            # 2. Find the correct StockLevel for this variant and location.
            #    If it doesn't exist, create a new one starting at quantity 0.
            stock_level, created = StockLevel.objects.get_or_create(
                product_variant=self.product_variant,
                location=self.location,
                defaults={'quantity': 0}
            )

            # 3. THE CRITICAL STEP: Update the quantity.
            #    If quantity_change is -1, this subtracts. If it's 10, it adds.
            stock_level.quantity += self.quantity_change
            stock_level.save()

            # 4. Only after the stock level is updated, save the movement log itself.
            super().save(*args, **kwargs)```

This method guarantees that the inventory is always accurate and provides a perfect audit trail.

#### **Step 5: The Full Circle - Response and UI Refresh**

After the `save` method succeeds, the API sends a success response (e.g., `201 Created`) back to the frontend.

The JavaScript in our `handleFormSubmit` function receives this success response and completes the flow:

```javascript
// script.js (inside the 'try' block of handleFormSubmit)
movementForm.reset(); // Clear the form for the next entry
await fetchAndPopulateTable(); // IMPORTANT: Re-run Flow 1 to get the fresh data

// Show a professional success pop-up to the user
Swal.fire({
    icon: 'success',
    title: 'Movement Registered!',
    showConfirmButton: false,
    timer: 1500
});
```

The user sees a success message, and the stock table on the left instantly updates to reflect the change they just made. This immediate feedback is what makes the application feel responsive and reliable.