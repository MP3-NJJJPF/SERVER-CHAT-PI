/**
 * Base URL for API requests
 * Uses environment variable VITE_BACKEND_URL or defaults to localhost:3000
 */
const API_URL = process.env.BACKEND_USER_URL ?? "http://localhost:3000";

/**
 * Type for request body - can be any JSON-serializable object
 */
type RequestBody = Record<string, unknown> | unknown[] | null | undefined;

/**
 * Type for API response - can be any JSON object
 */
type ApiResponse = Record<string, unknown> | unknown[] | null;

/**
 * API client for making HTTP requests to the backend
 * Provides a centralized way to handle authentication and API calls
 */
export const apiClient = {
    /**
     * Generic request method that handles all HTTP calls
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
     * @param {string} path - API endpoint path (e.g., "/users", "/auth/login")
     * @param {RequestBody} [body] - Request payload for POST/PUT requests
     * @param {string} [token] - JWT token for authenticated requests
     * @returns {Promise<ApiResponse>} Parsed JSON response from the server
     * @throws {Error} If the request fails or returns a non-2xx status code
     */
    async request(method: string, path: string, body?: RequestBody, token?: string): Promise<ApiResponse> {
        // Initialize headers with default Content-Type
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Add Authorization header if token is provided
        // Format: "Bearer <token>" (standard JWT authentication)
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const url = `${API_URL}${path}`;

        // Make the HTTP request to the backend
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined, // Convert body to JSON string
            credentials: "include", // Include cookies for cross-origin requests
        });

        // Handle error responses (status codes outside 200-299 range)
        if (!response.ok) {
            // Try to parse error message from response, fallback to empty object
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || "Request failed");
        }

        // Parse and return the JSON response
        // If parsing fails, return empty object instead of throwing
        return response.json().catch(() => ({}));
    },

    /**
     * Performs a GET request to fetch data
     * @param {string} path - API endpoint path
     * @param {string} [token] - JWT token for authenticated requests
     * @returns {Promise<ApiResponse>} Response data
     * @example
     * const users = await apiClient.get("/users", userToken);
     */
    async get(path: string, token?: string): Promise<ApiResponse> {
        return this.request("GET", path, null, token);
    },

    /**
     * Performs a POST request to create new resources
     * @param {string} path - API endpoint path
     * @param {RequestBody} [body] - Data to send in the request body
     * @param {string} [token] - JWT token for authenticated requests
     * @returns {Promise<ApiResponse>} Response data (usually the created resource)
     * @example
     * const newUser = await apiClient.post("/users", { name: "John" }, token);
     */
    async post(path: string, body?: RequestBody, token?: string): Promise<ApiResponse> {
        return this.request("POST", path, body, token);
    },

    /**
     * Performs a PUT request to update existing resources
     * @param {string} path - API endpoint path
     * @param {RequestBody} [body] - Updated data to send
     * @param {string} [token] - JWT token for authenticated requests
     * @returns {Promise<ApiResponse>} Response data (usually the updated resource)
     * @example
     * const updated = await apiClient.put("/users/123", { name: "Jane" }, token);
     */
    async put(path: string, body?: RequestBody, token?: string): Promise<ApiResponse> {
        return this.request("PUT", path, body, token);
    },

    /**
     * Performs a PATCH request to partially update existing resources
     * @param {string} path - API endpoint path
     * @param {RequestBody} [body] - Partial data to update
     * @param {string} [token] - JWT token for authenticated requests
     * @returns {Promise<ApiResponse>} Response data (usually the updated resource)
     * @example
     * const updated = await apiClient.patch("/users/123", { password: "new" }, token);
     */
    async patch(path: string, body?: RequestBody, token?: string): Promise<ApiResponse> {
        return this.request("PATCH", path, body, token);
    },

    /**
     * Performs a DELETE request to remove resources
     * @param {string} path - API endpoint path
     * @param {RequestBody} [body] - Request body (optional, for DELETE with body)
     * @param {string} [token] - JWT token for authenticated requests
     * @returns {Promise<ApiResponse>} Response data (usually confirmation message)
     * @example
     * await apiClient.delete("/users/123", null, token);
     * await apiClient.delete("/users/me", { password: "secret" }, token);
     */
    async delete(path: string, body?: RequestBody, token?: string): Promise<ApiResponse> {
        return this.request("DELETE", path, body, token);
    },
};