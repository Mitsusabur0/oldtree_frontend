document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // IMPORTANT: Replace this with your live Render API URL!
    const API_BASE_URL = 'https://oldtree-api.onrender.com'; // <<-- YOUR URL HERE

    // --- ELEMENT SELECTORS ---
    const stockTableBody = document.getElementById('stock-table-body');
    const movementForm = document.getElementById('movement-form');
    const variantSelect = document.getElementById('variant-select');
    const locationSelect = document.getElementById('location-select');
    const submitButton = document.getElementById('submit-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const emptyState = document.getElementById('empty-state');
    const refreshButton = document.getElementById('refresh-button');

    // --- HELPER FUNCTIONS FOR UI STATE ---

    const showLoading = (isLoading) => {
        loadingSpinner.style.display = isLoading ? 'block' : 'none';
        stockTableBody.style.display = isLoading ? 'none' : '';
    };

    const showEmptyState = (isEmpty) => {
        emptyState.style.display = isEmpty ? 'block' : 'none';
    };

    // --- API FUNCTIONS ---

    const fetchAndPopulateTable = async () => {
        showLoading(true);
        showEmptyState(false);
        try {
            const response = await fetch(`${API_BASE_URL}/api/stock-levels/`);
            if (!response.ok) throw new Error('Network response was not ok');
            const stockLevels = await response.json();

            stockTableBody.innerHTML = ''; // Clear existing data

            if (stockLevels.length === 0) {
                showEmptyState(true);
            } else {
                stockLevels.sort((a, b) => a.product_variant.product.localeCompare(b.product_variant.product)); // Sort by product name
                stockLevels.forEach(item => {
                    const row = `
                        <tr>
                            <td>${item.product_variant.product}</td>
                            <td><small class="text-muted">${item.product_variant.size} / ${item.product_variant.color}</small></td>
                            <td>${item.location.name}</td>
                            <td class="text-end fw-bold">${item.quantity}</td>
                        </tr>
                    `;
                    stockTableBody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error fetching stock levels:', error);
            Swal.fire({
                icon: 'error',
                title: 'Failed to Load Stock Data',
                text: 'Could not connect to the server. Please try again later.',
            });
            showEmptyState(true);
        } finally {
            showLoading(false);
        }
    };

    const fetchAndPopulateDropdowns = async () => {
        try {
            const [variantsRes, locationsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/variants/`),
                fetch(`${API_BASE_URL}/api/locations/`)
            ]);
            if (!variantsRes.ok || !locationsRes.ok) throw new Error('Failed to fetch form data');
            
            const variants = await variantsRes.json();
            const locations = await locationsRes.json();

            variantSelect.innerHTML = '<option value="" disabled selected>Select a variant</option>';
            variants.forEach(v => {
                const optionText = `${v.product} - ${v.size}/${v.color} (${v.unique_sku})`;
                variantSelect.innerHTML += `<option value="${v.id}">${optionText}</option>`;
            });

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

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        
        // Visual feedback for submission
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Submitting...
        `;

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }
            
            movementForm.reset();
            await fetchAndPopulateTable();

            Swal.fire({
                icon: 'success',
                title: 'Movement Registered!',
                showConfirmButton: false,
                timer: 1500
            });

        } catch (error) {
            console.error('Form submission error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: 'There was an error submitting the movement. Please check the data and try again.',
            });
        } finally {
            // Restore button state
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="bi bi-check-circle-fill"></i> Submit Movement';
        }
    };

    // --- EVENT LISTENERS ---
    movementForm.addEventListener('submit', handleFormSubmit);
    refreshButton.addEventListener('click', fetchAndPopulateTable);

    // --- INITIALIZATION ---
    fetchAndPopulateTable();
    fetchAndPopulateDropdowns();
});