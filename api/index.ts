import express from "express";
import cors from "cors";
import "dotenv/config";
// import db from "./config/database";
// import routes from "./routes/routes";
// import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Middleware configuration
 * - Parse JSON request bodies
 * - Parse URL-encoded request bodies
 * - Enable Cross-Origin Resource Sharing (CORS)
 */
const allowedOrigins = process.env.ORIGIN?.split(",").map(s => s.trim()).filter(Boolean);
app.use(
  // allowedOrigins && allowedOrigins.length > 0
  //   ? cors({ origin: allowedOrigins })
  //   : cors() 
  cors({ 
    origin: allowedOrigins, // Permitir localhost y el dominio de producción
    credentials: true // Permitir el envío de cookies
}));

// Permitir el envío de cookies
// app.use(cookieParser());

/**
 * Initialize database connection.
 * Exits the process if the connection fails.
 */
//db.connectDB();

/**
 * Mount the API routes.
 * All feature routes are grouped under `/api/v1`.
 */
//app.use("/api/v1", routes);

/**
 * Health check endpoint.
 * Useful to verify that the server is up and running.
 */
//app.get("/", (req, res) => res.send("Server is running"));

/**
 * Start the server only if this file is run directly
 * (prevents multiple servers when testing with imports).
 */
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}