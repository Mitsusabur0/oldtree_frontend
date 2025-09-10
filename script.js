document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // IMPORTANT: Replace this with your actual Render API URL!
    const API_BASE_URL = 'https://oldtree-api.onrender.com'; // Example URL

    // --- ELEMENT SELECTORS ---
    const stockTableBody = document.getElementById('stock-table-body');
    const movementForm = document.getElementById('movement-form');
    const variantSelect = document.getElementById('variant-select');
    const locationSelect = document.getElementById('location-select');
    const submitButton = document.getElementById('submit-button');

    // --- API HELPER FUNCTIONS ---

    /**
     * Fetches current stock levels and populates the main table.
     */
    const fetchAndPopulateTable = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/stock-levels/`);
            if (!response.ok) throw new Error('Network response was not ok');
            const stockLevels = await response.json();

            // Clear the "loading..." message or any existing data
            stockTableBody.innerHTML = '';

            if (stockLevels.length === 0) {
                stockTableBody.innerHTML = '<tr><td colspan="4">No stock data found.</td></tr>';
                return;
            }

            // Populate the table with data
            stockLevels.forEach(item => {
                const row = `
                    <tr>
                        <td>${item.product_variant.product}</td>
                        <td>Size: ${item.product_variant.size}, Color: ${item.product_variant.color}</td>
                        <td>${item.location.name}</td>
                        <td><strong>${item.quantity}</strong></td>
                    </tr>
                `;
                stockTableBody.innerHTML += row;
            });

        } catch (error) {
            console.error('Error fetching stock levels:', error);
            stockTableBody.innerHTML = '<tr><td colspan="4">Failed to load data. Please try again later.</td></tr>';
        }
    };

    /**
     * Fetches product variants and locations to populate the form's dropdowns.
     */
    const fetchAndPopulateDropdowns = async () => {
        try {
            // Fetch variants and locations in parallel for efficiency
            const [variantsRes, locationsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/variants/`),
                fetch(`${API_BASE_URL}/api/locations/`)
            ]);

            if (!variantsRes.ok || !locationsRes.ok) throw new Error('Failed to fetch form data');
            
            const variants = await variantsRes.json();
            const locations = await locationsRes.json();

            // Populate Variants Dropdown
            variantSelect.innerHTML = '<option value="" disabled selected>Select a variant</option>';
            variants.forEach(v => {
                const optionText = `${v.product} - ${v.size}/${v.color} (${v.unique_sku})`;
                variantSelect.innerHTML += `<option value="${v.id}">${optionText}</option>`;
            });

            // Populate Locations Dropdown
            locationSelect.innerHTML = '<option value="" disabled selected>Select a location</option>';
            locations.forEach(loc => {
                locationSelect.innerHTML += `<option value="${loc.id}">${loc.name}</option>`;
            });

        } catch (error) {
            console.error('Error fetching dropdown data:', error);
            variantSelect.innerHTML = '<option value="" disabled>Error loading variants</option>';
            locationSelect.innerHTML = '<option value="" disabled>Error loading locations</option>';
        }
    };

    /**
     * Handles the form submission to create a new stock movement.
     */
    const handleFormSubmit = async (event) => {
        event.preventDefault(); // Prevent the default browser refresh

        // Show loading state
        submitButton.setAttribute('aria-busy', 'true');
        submitButton.disabled = true;

        const formData = new FormData(movementForm);
        const data = {
            product_variant: formData.get('product_variant'),
            location: formData.get('location'),
            quantity_change: formData.get('quantity_change'),
            notes: formData.get('notes'),
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/stock-movements/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to submit movement: ${JSON.stringify(errorData)}`);
            }
            
            // It worked!
            movementForm.reset(); // Clear the form for the next entry
            await fetchAndPopulateTable(); // Refresh the table to show the new stock level instantly!

        } catch (error) {
            console.error('Form submission error:', error);
            alert('There was an error submitting the movement. Please check the console for details.');
        } finally {
            // Restore button to normal state
            submitButton.removeAttribute('aria-busy');
            submitButton.disabled = false;
        }
    };

    // --- INITIALIZATION ---
    
    // Add event listener for the form
    movementForm.addEventListener('submit', handleFormSubmit);

    // Initial data load when the page is ready
    fetchAndPopulateTable();
    fetchAndPopulateDropdowns();
});